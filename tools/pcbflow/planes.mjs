// Plane pours and fan-out stubs for multilayer boards.
import { buildModel } from "./model.mjs"

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
