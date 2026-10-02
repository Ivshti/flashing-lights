// Plane pours and fan-out stubs for multilayer boards.
import { buildModel } from "./model.mjs"
import { shapeDist } from "./geometry.mjs"

const circlePts = (x, y, r, n = 16) =>
  Array.from({ length: n }, (_, i) => {
    const a = (-2 * Math.PI * i) / n // clockwise for inner rings
    return { x: x + r * Math.cos(a), y: y + r * Math.sin(a) }
  })

function roundedRect(w, h, r, inset, segs = 8) {
  const W = w / 2 - inset
  const H = h / 2 - inset
  const R = Math.max(0.01, r - inset)
  const pts = []
  for (const [cx, cy, a0] of [
    [W - R, H - R, 0],
    [-(W - R), H - R, 90],
    [-(W - R), -(H - R), 180],
    [W - R, -(H - R), 270],
  ])
    for (let i = 0; i <= segs; i++) {
      const a = ((a0 + (90 * i) / segs) * Math.PI) / 180
      pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) })
    }
  return pts
}

/**
 * Solid plane on `layer` for `net`, with clearance rings around every
 * plated hole / via of another net, every non-plated hole and keepout rects.
 * planes: [{ net, layer: "inner1", clearance, edge, keepouts: [{x1,y1,x2,y2}] }]
 */
export function makePlanes(cj, planes, { cornerRadius }) {
  const m = buildModel(cj)
  const board = m.board
  const out = []
  for (const pl of planes) {
    const inner = []
    for (const p of m.pads) {
      if (p.el.type !== "pcb_plated_hole") continue
      if (p.net === pl.net) continue
      const r = Math.max(p.el.outer_diameter ?? 0, p.el.rect_pad_width ?? 0, p.el.rect_pad_height ?? 0, p.el.outer_width ?? 0, p.el.outer_height ?? 0) / 2
      inner.push(circlePts(p.el.x, p.el.y, r + pl.clearance))
    }
    for (const v of cj.filter((e) => e.type === "pcb_via"))
      if (v._net !== pl.net) inner.push(circlePts(v.x, v.y, v.outer_diameter / 2 + pl.clearance))
    for (const h of m.holes) inner.push(circlePts(h.x, h.y, h.d / 2 + pl.clearance + 0.2, 24))
    for (const k of pl.keepouts ?? [])
      inner.push([
        { x: k.x1, y: k.y1 },
        { x: k.x1, y: k.y2 },
        { x: k.x2, y: k.y2 },
        { x: k.x2, y: k.y1 },
      ])
    out.push({
      type: "pcb_copper_pour",
      pcb_copper_pour_id: `plane_${pl.layer}_${pl.net}`,
      layer: pl.layer,
      shape: "brep",
      source_net_id: pl.net,
      covered_with_solder_mask: true,
      brep_shape: {
        outer_ring: { vertices: roundedRect(board.width, board.height, cornerRadius, pl.edge ?? 0.5) },
        inner_rings: inner.map((pts) => ({ vertices: pts })),
      },
      _net: pl.net,
      _plane: true,
    })
  }
  return out
}

/**
 * Short pre-routed stubs from fine-pitch pads straight out of the package,
 * so wide power traces can attach away from neighbouring pins.
 * stubs: [{ comp, pins: ["13","14"], len: 1.0 }]
 */
export function makeStubs(cj, stubs) {
  const m = buildModel(cj)
  const pcomp = new Map(cj.filter((e) => e.type === "pcb_component").map((e) => [e.pcb_component_id, e]))
  const els = []
  let k = 0
  for (const st of stubs)
    for (const p of m.pads.filter((pp) => pp.comp === st.comp && st.pins.includes(pp.pin))) {
      if (!(p.el.width > 0 && p.el.height > 0)) continue // polygon pads: no stub
      const c = pcomp.get(p.el.pcb_component_id).center
      const dx = p.el.x - c.x
      const dy = p.el.y - c.y
      const horiz = Math.abs(dx) > Math.abs(dy)
      const halfLen = (horiz ? p.el.width : p.el.height) / 2
      const w = Math.min(p.el.width, p.el.height)
      const dir = horiz ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }
      const L = halfLen + (st.len ?? 1.0)
      const layer = p.el.layer ?? "top"
      els.push({
        type: "pcb_trace",
        pcb_trace_id: `stub_${k++}`,
        route: [
          { route_type: "wire", x: p.el.x, y: p.el.y, width: w, layer },
          { route_type: "wire", x: p.el.x + dir.x * L, y: p.el.y + dir.y * L, width: w, layer },
        ],
        _net: p.net,
      })
    }
  return els
}

/**
 * Drop a via next to every SMD pad of `net` (the plane net) so the pad is tied
 * to the plane. Candidate spots are tried around the pad (outward first) and
 * the first one that clears all other copper, holes and keepouts is used.
 * opts: { net, via: {d, drill, layers}, clearance, keepouts, edgeInset, board:{w,h,r} }
 */
export function makePlaneVias(cj, opts) {
  const m = buildModel(cj)
  const pcomp = new Map(cj.filter((e) => e.type === "pcb_component").map((e) => [e.pcb_component_id, e]))
  const vr = opts.via.d / 2
  const clr = opts.clearance
  const obstacles = [] // {shape, net, layers:Set}
  for (const p of m.pads) for (const s of p.shapes) obstacles.push({ shape: s.shape, net: p.net, layer: s.layer })
  for (const t of cj.filter((e) => e.type === "pcb_trace"))
    for (let i = 0; i + 1 < t.route.length; i++) {
      const a = t.route[i]
      const b = t.route[i + 1]
      obstacles.push({ shape: { kind: "seg", a, b, r: a.width / 2 }, net: t._net, layer: { top: "F.Cu", bottom: "B.Cu" }[a.layer] })
    }
  const holes = m.holes
  const els = []
  const placed = []
  let k = 0
  const ok = (c, padLayer, stubShape) => {
    const via = { kind: "circle", c, r: vr }
    for (const o of obstacles) {
      if (o.net === opts.net) continue
      if (shapeDist(via, o.shape) < clr) return false
      if (o.layer === padLayer && shapeDist(stubShape, o.shape) < clr) return false
    }
    for (const h of holes) if (Math.hypot(h.x - c.x, h.y - c.y) < h.d / 2 + vr + 0.3) return false
    for (const v of placed) if (Math.hypot(v.x - c.x, v.y - c.y) < opts.via.d + 0.15) return false
    for (const kz of opts.keepouts ?? []) if (c.x > kz.x1 - vr && c.x < kz.x2 + vr && c.y > kz.y1 - vr && c.y < kz.y2 + vr) return false
    const { w, h, r } = opts.board
    const ex = Math.max(0, Math.abs(c.x) - (w / 2 - r))
    const ey = Math.max(0, Math.abs(c.y) - (h / 2 - r))
    if (Math.hypot(ex, ey) > r - vr - (opts.edgeInset ?? 0.5)) return false
    return true
  }
  // exposed pads (largest pad of a many-pin part): via grid inside the pad;
  // pins of the same net right next to it get an inward stub instead of a via
  const epOf = new Map()
  for (const [cid, pads] of Object.entries(Object.groupBy(m.pads.filter((p) => p.el.type === "pcb_smtpad"), (p) => p.el.pcb_component_id))) {
    if (pads.length < 8) continue
    const ep = pads.reduce((a, b) => (a.el.width * a.el.height > b.el.width * b.el.height ? a : b))
    if (ep.net === opts.net && ep.el.width * ep.el.height > 3) epOf.set(cid, ep)
  }
  const hasHoleInside = (pad) =>
    m.pads.some((q) => q.el.type === "pcb_plated_hole" && q.el.pcb_component_id === pad.el.pcb_component_id && Math.abs(q.el.x - pad.el.x) < pad.el.width / 2 && Math.abs(q.el.y - pad.el.y) < pad.el.height / 2)
  for (const ep of epOf.values()) {
    if (hasHoleInside(ep)) continue // footprint already has thermal vias
    const nx = Math.max(1, Math.floor((ep.el.width - 0.8) / 1.0) + 1)
    const ny = Math.max(1, Math.floor((ep.el.height - 0.8) / 1.0) + 1)
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const c = { x: ep.el.x + (i - (nx - 1) / 2) * 1.0, y: ep.el.y + (j - (ny - 1) / 2) * 1.0 }
        placed.push(c)
        els.push({ type: "pcb_via", pcb_via_id: `pv_ep_${k++}`, x: c.x, y: c.y, outer_diameter: opts.via.d, hole_diameter: opts.via.drill, layers: opts.via.layers, _net: opts.net })
      }
  }
  for (const p of m.pads) {
    if (p.net !== opts.net || p.el.type !== "pcb_smtpad") continue
    if (opts.skip?.includes(`${p.comp}.${p.pin}`)) continue // hand-placed via in the config
    const L = { top: "F.Cu", bottom: "B.Cu" }[p.el.layer]
    const ep = epOf.get(p.el.pcb_component_id)
    if (ep === p) continue
    if (ep) {
      // pin next to its exposed pad: short stub straight into the pad
      const gapX = Math.abs(p.el.x - ep.el.x) - ep.el.width / 2
      const gapY = Math.abs(p.el.y - ep.el.y) - ep.el.height / 2
      if (Math.max(gapX, gapY) < 1.2) {
        const tgt = gapX > gapY ? { x: ep.el.x + Math.sign(p.el.x - ep.el.x) * (ep.el.width / 2 - 0.1), y: p.el.y } : { x: p.el.x, y: ep.el.y + Math.sign(p.el.y - ep.el.y) * (ep.el.height / 2 - 0.1) }
        const w = Math.min(p.el.width, p.el.height)
        els.push({ type: "pcb_trace", pcb_trace_id: `pv_ep_stub_${k++}`, route: [{ route_type: "wire", x: p.el.x, y: p.el.y, width: w, layer: p.el.layer }, { route_type: "wire", x: tgt.x, y: tgt.y, width: w, layer: p.el.layer }], _net: opts.net })
        continue
      }
    }
    const comp = pcomp.get(p.el.pcb_component_id)
    const c0 = comp?.center ?? { x: p.el.x, y: p.el.y }
    let ux = p.el.x - c0.x
    let uy = p.el.y - c0.y
    const n0 = Math.hypot(ux, uy)
    ;[ux, uy] = n0 > 1e-6 ? [ux / n0, uy / n0] : [0, 1]
    const halfW = (p.el.width ?? 2 * (p.el.radius ?? 0.5)) / 2
    const halfH = (p.el.height ?? 2 * (p.el.radius ?? 0.5)) / 2
    let found = null
    const dirs = []
    for (let a = 0; a < 360; a += 30) {
      const t = Math.atan2(uy, ux) + (a * Math.PI) / 180
      dirs.push({ x: Math.cos(t), y: Math.sin(t) })
    }
    for (const extra of [0.25, 0.6, 1.0, 1.5])
      for (const d of dirs) {
        // distance from pad centre to its edge along d (rect)
        const edge = Math.min(Math.abs(d.x) > 1e-6 ? halfW / Math.abs(d.x) : 1e9, Math.abs(d.y) > 1e-6 ? halfH / Math.abs(d.y) : 1e9)
        const dist = edge + vr + extra
        const c = { x: p.el.x + d.x * dist, y: p.el.y + d.y * dist }
        const sw = Math.min(0.35, halfW * 2, halfH * 2)
        const stub = { kind: "seg", a: { x: p.el.x, y: p.el.y }, b: c, r: sw / 2 }
        if (ok(c, L, stub)) {
          found = { c, sw }
          break
        }
        if (found) break
      }
    if (!found) {
      console.warn(`plane via: no spot for ${p.comp}.${p.pin}`)
      continue
    }
    placed.push(found.c)
    els.push(
      {
        type: "pcb_trace",
        pcb_trace_id: `pv_stub_${k}`,
        route: [
          { route_type: "wire", x: p.el.x, y: p.el.y, width: found.sw, layer: p.el.layer },
          { route_type: "wire", x: found.c.x, y: found.c.y, width: found.sw, layer: p.el.layer },
        ],
        _net: opts.net,
      },
      {
        type: "pcb_via",
        pcb_via_id: `pv_${k++}`,
        x: found.c.x,
        y: found.c.y,
        outer_diameter: opts.via.d,
        hole_diameter: opts.via.drill,
        layers: opts.via.layers,
        _net: opts.net,
      },
    )
    obstacles.push({ shape: { kind: "circle", c: found.c, r: vr }, net: opts.net, layer: L })
  }
  return els
}
