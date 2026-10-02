// Circuit JSON -> Specctra DSN for Freerouting, and Freerouting SES -> traces.
import { buildModel } from "./model.mjs"

const U = 1000 // DSN coordinates in um
const n = (v) => Math.round(v * U)
const q = (s) => `"${String(s).replace(/"/g, "'")}"`

/** Rounded-rect outline inset by `inset` mm, as DSN path coords. */
function roundedRectPath(w, h, r, inset, segs = 8) {
  const W = w / 2 - inset
  const H = h / 2 - inset
  const R = Math.max(0.01, r - inset)
  const pts = []
  const corners = [
    [W - R, H - R, 0],
    [-(W - R), H - R, 90],
    [-(W - R), -(H - R), 180],
    [W - R, -(H - R), 270],
  ]
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= segs; i++) {
      const a = ((a0 + (90 * i) / segs) * Math.PI) / 180
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)])
    }
  pts.push(pts[0])
  return pts.map(([x, y]) => `${n(x)} ${n(y)}`).join(" ")
}

/**
 * opts: {
 *   cornerRadius, edgeClearance, defaultWidth, clearance,
 *   classes: [{ name, match: RegExp, width, clearance }],
 *   holeClearance, protectExisting: true
 * }
 */
export function toDsn(cj, opts) {
  const m = buildModel(cj)
  const { board, allLayers } = m
  const L = []
  L.push(`(pcb ${q("board")}`)
  L.push(`  (parser (string_quote ") (space_in_quoted_tokens on) (host_cad "tscircuit") (host_version "pcbflow"))`)
  L.push(`  (resolution um 10)`, `  (unit um)`, `  (structure`)
  const planeLayers = new Set((opts.planes ?? []).map((p) => p.layer))
  allLayers.forEach((ly, i) => L.push(`    (layer ${ly} (type ${planeLayers.has(ly) ? "power" : "signal"}) (property (index ${i})))`))
  // Freerouting treats the pcb boundary as the routable area, so inset it by
  // the copper-to-edge clearance (the real outline comes from Circuit JSON)
  L.push(`    (boundary (path pcb 0 ${roundedRectPath(board.width, board.height, opts.cornerRadius, opts.edgeClearance)}))`)
  for (const p of opts.planes ?? [])
    L.push(`    (plane ${q(p.net)} (polygon ${p.layer} 0 ${roundedRectPath(board.width, board.height, opts.cornerRadius, opts.edgeClearance + 0.3)}))`)
  for (const h of m.holes)
    for (const ly of allLayers)
      L.push(`    (keepout "" (circle ${ly} ${n(h.d + 2 * opts.holeClearance)} ${n(h.x)} ${n(h.y)}))`)
  for (const k of opts.keepouts ?? [])
    for (const ly of k.layers ?? allLayers)
      L.push(
        `    (keepout "" (rect ${ly} ${n(k.x1)} ${n(k.y1)} ${n(k.x2)} ${n(k.y2)}))`,
      )
  const via = `Via_${n(opts.via?.d ?? 0.6)}_${n(opts.via?.drill ?? 0.3)}`
  L.push(`    (via ${q(via)})`)
  L.push(
    `    (rule (width ${n(opts.defaultWidth)}) (clearance ${n(opts.clearance)}) (clearance ${n(opts.clearance)} (type default_smd)) (clearance ${n(opts.smdClearance ?? opts.clearance)} (type smd_smd)))`,
  )
  L.push(`  )`)

  // one image per component, placed at the origin with absolute pin coords
  const comps = new Map()
  for (const p of m.pads) {
    if (!comps.has(p.comp)) comps.set(p.comp, [])
    comps.get(p.comp).push(p)
  }
  const padstacks = new Map()
  const psName = (p) => {
    const parts = p.shapes.map(({ layer, shape }) => {
      if (shape.kind === "circle") return `(circle ${layer} ${n(shape.r * 2)})`
      if (shape.kind === "seg") {
        const c = { x: (shape.a.x + shape.b.x) / 2, y: (shape.a.y + shape.b.y) / 2 }
        return `(path ${layer} ${n(shape.r * 2)} ${n(shape.a.x - c.x)} ${n(shape.a.y - c.y)} ${n(shape.b.x - c.x)} ${n(shape.b.y - c.y)})`
      }
      const cx = p.el.x
      const cy = p.el.y
      return `(polygon ${layer} 0 ${shape.pts.map((pt) => `${n(pt.x - cx)} ${n(pt.y - cy)}`).join(" ")})`
    })
    const key = parts.join(" ")
    if (!padstacks.has(key)) padstacks.set(key, { name: `PS${padstacks.size}`, parts })
    return padstacks.get(key).name
  }
  const pinName = new Map() // pad id -> "COMP-pinN"
  const images = []
  L.push(`  (placement`)
  for (const [comp, pads] of comps) {
    L.push(`    (component ${q(`IMG_${comp}`)} (place ${q(comp)} 0 0 front 0))`)
    const pins = pads.map((p, i) => {
      const nm = `p${i + 1}`
      pinName.set(p.id, `${comp}-${nm}`)
      const c = p.shapes[0].shape.kind === "seg" ? { x: (p.shapes[0].shape.a.x + p.shapes[0].shape.b.x) / 2, y: (p.shapes[0].shape.a.y + p.shapes[0].shape.b.y) / 2 } : { x: p.el.x, y: p.el.y }
      return `      (pin ${psName(p)} ${nm} ${n(c.x)} ${n(c.y)})`
    })
    images.push(`    (image ${q(`IMG_${comp}`)}\n${pins.join("\n")}\n    )`)
  }
  L.push(`  )`, `  (library`, ...images)
  for (const { name, parts } of padstacks.values())
    L.push(`    (padstack ${name} ${parts.map((p) => `(shape ${p})`).join(" ")} (attach off))`)
  L.push(
      `    (padstack ${q(via)} ${allLayers.map((ly) => `(shape (circle ${ly} ${n(opts.via?.d ?? 0.6)}))`).join(" ")} (attach off))`,
    )
  L.push(`  )`)

  // network
  const nets = new Map()
  for (const p of m.pads) {
    if (!p.net) continue
    if (!nets.has(p.net)) nets.set(p.net, [])
    nets.get(p.net).push(pinName.get(p.id))
  }
  L.push(`  (network`)
  for (const [net, pins] of nets) L.push(`    (net ${q(net)} (pins ${pins.join(" ")}))`)
  const assigned = new Set()
  for (const c of opts.classes ?? []) {
    const members = [...nets.keys()].filter((k) => !assigned.has(k) && c.match.test(k))
    members.forEach((k) => assigned.add(k))
    if (!members.length) continue
    L.push(
      `    (class ${q(c.name)} ${members.map(q).join(" ")} (circuit (use_via ${q(via)})) (rule (width ${n(c.width)}) (clearance ${n(c.clearance ?? opts.clearance)})))`,
    )
  }
  const rest = [...nets.keys()].filter((k) => !assigned.has(k))
  if (rest.length)
    L.push(
      `    (class ${q("default")} ${rest.map(q).join(" ")} (circuit (use_via ${q(via)})) (rule (width ${n(opts.defaultWidth)}) (clearance ${n(opts.clearance)})))`,
    )
  L.push(`  )`)

  // pre-routed copper
  const sTraces = new Map(cj.filter((e) => e.type === "source_trace").map((e) => [e.source_trace_id, e]))
  L.push(`  (wiring`)
  for (const t of cj.filter((e) => e.type === "pcb_trace")) {
    const st = sTraces.get(t.source_trace_id)
    const net = t._net ?? (st ? m.keyName.get(st.subcircuit_connectivity_map_key) : null)
    let seg = []
    const flush = () => {
      if (seg.length >= 2)
        L.push(
          `    (wire (path ${seg[0].layer} ${n(seg[0].width)} ${seg.map((p) => `${n(p.x)} ${n(p.y)}`).join(" ")})${net ? ` (net ${q(net)})` : ""} (type ${t._editable ? "route" : "protect"}))`,
        )
      seg = []
    }
    for (const pt of t.route) {
      if (pt.route_type !== "wire") {
        flush()
        continue
      }
      const layer = { top: "F.Cu", bottom: "B.Cu", inner1: "In1.Cu", inner2: "In2.Cu" }[pt.layer]
      if (seg.length && seg[0].layer !== layer) flush()
      seg.push({ ...pt, layer })
    }
    flush()
  }
  for (const v of cj.filter((e) => e.type === "pcb_via"))
    L.push(`    (via ${q(via)} ${n(v.x)} ${n(v.y)}${v._net ? ` (net ${q(v._net)})` : ""} (type ${v._editable ? "route" : "protect"}))`)
  L.push(`  )`, `)`)
  return { dsn: L.join("\n") + "\n", nets, model: m }
}

// ---------------------------------------------------------------- SES
function parseSexpr(s) {
  let i = 0
  const parse = () => {
    const out = []
    while (i < s.length) {
      const ch = s[i]
      if (ch === "(") {
        i++
        out.push(parse())
      } else if (ch === ")") {
        i++
        return out
      } else if (/\s/.test(ch)) i++
      else if (ch === '"') {
        let j = i + 1
        while (s[j] !== '"') j++
        out.push(s.slice(i + 1, j))
        i = j + 1
      } else {
        let j = i
        while (j < s.length && !/[\s()]/.test(s[j])) j++
        out.push(s.slice(i, j))
        i = j
      }
    }
    return out
  }
  return parse()[0]
}

const findAll = (node, key) => node.filter((x) => Array.isArray(x) && x[0] === key)
const find = (node, key) => findAll(node, key)[0]

const LAYER_TS = { "F.Cu": "top", "B.Cu": "bottom", "In1.Cu": "inner1", "In2.Cu": "inner2" }

/** Parse a Freerouting .ses into pcb_trace / pcb_via elements (mm). */
export function sesToElements(ses, { via } = {}) {
  const root = parseSexpr(ses)
  const routes = find(root, "routes")
  const res = find(routes, "resolution")
  const scale = 1 / (Number(res[2]) * (res[1] === "um" ? 1000 : res[1] === "mm" ? 1 : 1))
  const netOut = find(routes, "network_out") ?? []
  const els = []
  let k = 0
  for (const net of findAll(netOut, "net")) {
    const name = net[1]
    for (const w of findAll(net, "wire")) {
      const path = find(w, "path")
      const layer = LAYER_TS[path[1]]
      const width = Number(path[2]) * scale
      const coords = path.slice(3).map(Number)
      const route = []
      for (let j = 0; j + 1 < coords.length; j += 2)
        route.push({ route_type: "wire", x: coords[j] * scale, y: coords[j + 1] * scale, width, layer })
      els.push({ type: "pcb_trace", pcb_trace_id: `fr_trace_${k++}`, route, _net: name, source: "freerouting" })
    }
    for (const v of findAll(net, "via")) {
      els.push({
        type: "pcb_via",
        pcb_via_id: `fr_via_${k++}`,
        x: Number(v[2]) * scale,
        y: Number(v[3]) * scale,
        outer_diameter: via?.d ?? 0.6,
        hole_diameter: via?.drill ?? 0.3,
        layers: via?.layers ?? ["top", "bottom"],
        _net: name,
      })
    }
  }
  return els
}
