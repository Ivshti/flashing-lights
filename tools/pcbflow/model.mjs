// Extract a flat copper/netlist model from tscircuit Circuit JSON.
import { rectPts } from "./geometry.mjs"

const LAYER = { top: "F.Cu", bottom: "B.Cu", inner1: "In1.Cu", inner2: "In2.Cu" }

export function layerNames(numLayers) {
  if (numLayers === 1) return ["F.Cu"]
  if (numLayers === 2) return ["F.Cu", "B.Cu"]
  return ["F.Cu", "In1.Cu", "In2.Cu", "B.Cu"]
}

/** Shapes for one pad, in board coordinates. Returns [{layer, shape}] */
export function padShapes(p, allLayers) {
  const out = []
  if (p.type === "pcb_smtpad") {
    const L = LAYER[p.layer]
    if (p.shape === "rect") out.push({ layer: L, shape: { kind: "poly", pts: rectPts(p.x, p.y, p.width, p.height) } })
    else if (p.shape === "rotated_rect")
      out.push({ layer: L, shape: { kind: "poly", pts: rectPts(p.x, p.y, p.width, p.height, p.ccw_rotation ?? 0) } })
    else if (p.shape === "circle") out.push({ layer: L, shape: { kind: "circle", c: { x: p.x, y: p.y }, r: p.radius } })
    else if (p.shape === "pill") {
      const r = Math.min(p.width, p.height) / 2
      const hx = p.width > p.height ? p.width / 2 - r : 0
      const hy = p.height >= p.width ? p.height / 2 - r : 0
      out.push({ layer: L, shape: { kind: "seg", a: { x: p.x - hx, y: p.y - hy }, b: { x: p.x + hx, y: p.y + hy }, r } })
    } else if (p.shape === "polygon") out.push({ layer: L, shape: { kind: "poly", pts: p.points } })
    else throw new Error(`smtpad shape ${p.shape}`)
  } else if (p.type === "pcb_plated_hole") {
    let shape
    if (p.shape === "circle") shape = { kind: "circle", c: { x: p.x, y: p.y }, r: p.outer_diameter / 2 }
    else if (p.shape === "circular_hole_with_rect_pad")
      shape = { kind: "poly", pts: rectPts(p.x, p.y, p.rect_pad_width, p.rect_pad_height, p.rect_ccw_rotation ?? 0) }
    else if (p.shape === "pill" || p.shape === "oval" || p.shape === "pill_hole_with_rect_pad") {
      const w = p.outer_width ?? p.rect_pad_width
      const h = p.outer_height ?? p.rect_pad_height
      if (p.shape === "pill_hole_with_rect_pad") shape = { kind: "poly", pts: rectPts(p.x, p.y, w, h) }
      else {
        const r = Math.min(w, h) / 2
        const hx = w > h ? w / 2 - r : 0
        const hy = h >= w ? h / 2 - r : 0
        shape = { kind: "seg", a: { x: p.x - hx, y: p.y - hy }, b: { x: p.x + hx, y: p.y + hy }, r }
      }
    } else throw new Error(`plated hole shape ${p.shape}`)
    for (const L of allLayers) out.push({ layer: L, shape })
  }
  return out
}

export function holeDiameter(p) {
  if (p.type === "pcb_hole") return p.hole_diameter ?? Math.max(p.hole_width ?? 0, p.hole_height ?? 0)
  if (p.type === "pcb_plated_hole") return p.hole_diameter ?? Math.max(p.hole_width ?? 0, p.hole_height ?? 0)
  return 0
}

export function buildModel(cj) {
  const byId = (t, k) => new Map(cj.filter((e) => e.type === t).map((e) => [e[k], e]))
  const board = cj.find((e) => e.type === "pcb_board")
  const allLayers = layerNames(board.num_layers ?? 2)
  const sPorts = byId("source_port", "source_port_id")
  const pPorts = byId("pcb_port", "pcb_port_id")
  const sComps = byId("source_component", "source_component_id")
  const pComps = byId("pcb_component", "pcb_component_id")
  const sNets = cj.filter((e) => e.type === "source_net")

  // net name per connectivity key
  const keyName = new Map()
  for (const n of sNets) if (n.subcircuit_connectivity_map_key) keyName.set(n.subcircuit_connectivity_map_key, n.name)
  // otherwise name the net after a trace on it (stable across rebuilds)
  for (const t of cj.filter((e) => e.type === "source_trace"))
    if (t.subcircuit_connectivity_map_key && !keyName.has(t.subcircuit_connectivity_map_key) && t.name)
      keyName.set(t.subcircuit_connectivity_map_key, t.name)
  // source traces carry the key too; use the trace name as a fallback net name
  const netOf = (sp) => {
    const k = sp?.subcircuit_connectivity_map_key
    if (!k) return null
    if (!keyName.has(k)) keyName.set(k, `N${keyName.size}`)
    return keyName.get(k)
  }

  const pads = []
  for (const e of cj) {
    if (e.type !== "pcb_smtpad" && e.type !== "pcb_plated_hole") continue
    const pp = e.pcb_port_id ? pPorts.get(e.pcb_port_id) : null
    const sp = pp ? sPorts.get(pp.source_port_id) : null
    const pc = pComps.get(e.pcb_component_id)
    const sc = pc ? sComps.get(pc.source_component_id) : null
    pads.push({
      id: e.type === "pcb_smtpad" ? e.pcb_smtpad_id : e.pcb_plated_hole_id,
      el: e,
      comp: sc?.name ?? "?",
      pin: sp ? String(sp.pin_number ?? sp.name) : "?",
      net: netOf(sp),
      shapes: padShapes(e, allLayers),
      drill: e.type === "pcb_plated_hole" ? holeDiameter(e) : 0,
    })
  }
  const holes = cj.filter((e) => e.type === "pcb_hole").map((h) => ({ x: h.x, y: h.y, d: holeDiameter(h), comp: h.pcb_component_id }))
  return { board, allLayers, pads, holes, keyName }
}

/** Copper items of traces/vias (with nets resolved by touching pads). */
export function traceItems(cj) {
  const items = []
  for (const t of cj.filter((e) => e.type === "pcb_trace")) {
    const r = t.route
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i]
      const b = r[i + 1]
      if (a.route_type !== "wire" || b.route_type !== "wire") continue
      if (a.layer !== b.layer) continue
      items.push({
        trace: t.pcb_trace_id,
        layer: LAYER[a.layer] ?? a.layer,
        net: t._net,
        shape: { kind: "seg", a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, r: (a.width ?? 0.2) / 2 },
      })
    }
  }
  for (const v of cj.filter((e) => e.type === "pcb_via"))
    for (const L of v.layers ?? ["top", "bottom"])
      items.push({
        via: v.pcb_via_id,
        layer: LAYER[L] ?? L,
        net: v._net,
        shape: { kind: "circle", c: { x: v.x, y: v.y }, r: v.outer_diameter / 2 },
      })
  return items
}
