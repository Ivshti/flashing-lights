// Geometric DRC on routed Circuit JSON: every net must be one connected copper
// island, and copper of different nets must keep `clearance` apart.
import { bbox, shapeDist } from "./geometry.mjs"
import { buildModel, traceItems } from "./model.mjs"

class DSU {
  constructor(n) {
    this.p = Array.from({ length: n }, (_, i) => i)
  }
  find(i) {
    while (this.p[i] !== i) i = this.p[i] = this.p[this.p[i]]
    return i
  }
  union(a, b) {
    this.p[this.find(a)] = this.find(b)
  }
}

export function check(cj, { clearance = 0.2, eps = 0.005, holeClearance = 0.3, edgeClearance = 0.3, edgeExempt = [], minTrace = 0.127, minDrill = 0.2, minAnnular = 0.13, outerOnly = null } = {}) {
  const m = buildModel(cj)
  // items: one per (pad, layer) and per trace segment / via layer
  const items = []
  for (const p of m.pads)
    for (const s of p.shapes) items.push({ kind: "pad", ref: `${p.comp}.${p.pin}`, owner: p.id, net: p.net, layer: s.layer, shape: s.shape })
  for (const t of traceItems(cj)) items.push({ kind: t.via ? "via" : "trace", ref: t.trace ?? t.via, owner: t.trace ?? t.via, net: t.net, layer: t.layer, shape: t.shape })
  const boxes = items.map((it) => bbox(it.shape))

  // spatial hash
  const cell = 2
  const grid = new Map()
  items.forEach((it, i) => {
    const [x0, y0, x1, y1] = boxes[i]
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++)
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        const k = `${gx},${gy}`
        if (!grid.has(k)) grid.set(k, [])
        grid.get(k).push(i)
      }
  })
  const dsu = new DSU(items.length)
  // a pad's per-layer shapes (through-hole) belong together; so do via layers
  const ownerFirst = new Map()
  items.forEach((it, i) => {
    if (it.kind === "trace") return
    if (ownerFirst.has(it.owner)) dsu.union(i, ownerFirst.get(it.owner))
    else ownerFirst.set(it.owner, i)
  })

  // plane layers: everything of the plane's net that reaches the plane layer
  // (vias, plated holes) is connected through the pour
  const LNAME = { inner1: "In1.Cu", inner2: "In2.Cu", top: "F.Cu", bottom: "B.Cu" }
  for (const pl of cj.filter((e) => e.type === "pcb_copper_pour" && e._plane)) {
    let root = -1
    items.forEach((it, i) => {
      if (it.layer !== LNAME[pl.layer] || it.net !== pl._net) return
      if (root < 0) root = i
      else dsu.union(i, root)
    })
  }

  const violations = []
  const seen = new Set()
  for (const ids of grid.values())
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) {
        const i = ids[a]
        const j = ids[b]
        const key = i < j ? `${i}:${j}` : `${j}:${i}`
        if (seen.has(key)) continue
        seen.add(key)
        const A = items[i]
        const B = items[j]
        if (A.layer !== B.layer) continue
        const [ax0, ay0, ax1, ay1] = boxes[i]
        const [bx0, by0, bx1, by1] = boxes[j]
        if (ax1 + clearance < bx0 || bx1 + clearance < ax0 || ay1 + clearance < by0 || by1 + clearance < ay0) continue
        const d = shapeDist(A.shape, B.shape)
        if (d <= eps) {
          if (A.net && B.net && A.net !== B.net) violations.push({ type: "short", a: A.ref, b: B.ref, nets: [A.net, B.net], at: center(A.shape) })
          else dsu.union(i, j)
        } else if (d < clearance - eps && A.net !== B.net) {
          if (A.kind === "pad" && B.kind === "pad" && A.owner.split("_")[0] === B.owner.split("_")[0] && samePart(m, A, B)) continue
          violations.push({ type: "clearance", d: +d.toFixed(3), a: A.ref, b: B.ref, nets: [A.net, B.net], at: center(A.shape) })
        }
      }
  // traces without a known net inherit the net of what they touch
  // connectivity per net
  const unrouted = []
  const netPads = new Map()
  items.forEach((it, i) => {
    if (it.kind !== "pad" || !it.net) return
    if (!netPads.has(it.net)) netPads.set(it.net, [])
    netPads.get(it.net).push(i)
  })
  for (const [net, ids] of netPads) {
    const groups = new Map()
    for (const i of ids) {
      const r = dsu.find(i)
      if (!groups.has(r)) groups.set(r, new Set())
      groups.get(r).add(items[i].ref)
    }
    if (groups.size > 1) unrouted.push({ net, islands: [...groups.values()].map((s) => [...s]) })
  }
  // holes vs copper (a hole inside a pad is a wire/through hole of that pad's
  // net, so copper of the same net may touch it)
  for (const h of m.holes) {
    const hc = { kind: "circle", c: { x: h.x, y: h.y }, r: 0.001 }
    const host = items.find((it) => it.kind === "pad" && shapeDist(it.shape, hc) === 0)
    items.forEach((it) => {
      if (host && it.net && it.net === host.net) return
      // a footprint's own pegs/holes vs its own pads are the footprint's business
      if (h.comp && it.kind === "pad" && it.owner && m.pads.find((pp) => pp.id === it.owner)?.el.pcb_component_id === h.comp) return
      const d = shapeDist(it.shape, { kind: "circle", c: { x: h.x, y: h.y }, r: h.d / 2 })
      if (d < holeClearance) violations.push({ type: "hole", d: +d.toFixed(3), a: it.ref, at: { x: h.x, y: h.y } })
    })
  }
  // copper vs board outline (planes are generated with their own edge inset)
  const outline = cj.find((e) => e.type === "pcb_board")?.outline ?? []
  const edges = outline.map((a, i) => ({ kind: "seg", a, b: outline[(i + 1) % outline.length], r: 0 }))
  const eboxes = edges.map((e) => bbox(e))
  items.forEach((it, i) => {
    if (edgeExempt.some((c) => it.ref?.startsWith(`${c}.`))) return
    const [x0, y0, x1, y1] = boxes[i]
    let dmin = Infinity
    edges.forEach((e, j) => {
      const [ex0, ey0, ex1, ey1] = eboxes[j]
      if (x1 + edgeClearance < ex0 || ex1 + edgeClearance < x0 || y1 + edgeClearance < ey0 || ey1 + edgeClearance < y0) return
      dmin = Math.min(dmin, shapeDist(it.shape, e))
    })
    if (dmin < edgeClearance - eps) violations.push({ type: "edge", d: +dmin.toFixed(3), a: it.ref, nets: [it.net], at: center(it.shape) })
  })
  // high-current nets must not run on (thin) inner copper
  if (outerOnly)
    for (const t of traceItems(cj))
      if (!t.via && !t.innerOk && /^In\d/.test(t.layer) && outerOnly.test(t.net ?? "")) violations.push({ type: "inner-power", a: t.trace, nets: [t.net], at: center(t.shape) })
  // fab minimums (JLCPCB standard process)
  for (const t of cj.filter((e) => e.type === "pcb_trace"))
    for (const p of t.route) if (p.route_type === "wire" && p.width < minTrace - eps) violations.push({ type: "width", d: p.width, a: t.pcb_trace_id, at: p })
  for (const v of cj.filter((e) => e.type === "pcb_via")) {
    if (v.hole_diameter < minDrill - eps) violations.push({ type: "drill", d: v.hole_diameter, a: v.pcb_via_id, at: v })
    if ((v.outer_diameter - v.hole_diameter) / 2 < minAnnular - eps) violations.push({ type: "annular", d: (v.outer_diameter - v.hole_diameter) / 2, a: v.pcb_via_id, at: v })
  }
  for (const h of cj.filter((e) => e.type === "pcb_plated_hole")) {
    const d = h.hole_diameter ?? Math.min(h.hole_width ?? Infinity, h.hole_height ?? Infinity)
    const o = h.outer_diameter ?? Math.min(h.rect_pad_width ?? h.outer_width ?? Infinity, h.rect_pad_height ?? h.outer_height ?? Infinity)
    if (d < minDrill - eps) violations.push({ type: "drill", d, a: h.pcb_plated_hole_id, at: h })
    if (Number.isFinite(o) && (o - d) / 2 < minAnnular - eps) violations.push({ type: "annular", d: +((o - d) / 2).toFixed(3), a: h.pcb_plated_hole_id, at: h })
  }
  return { unrouted, violations }
}

function samePart(m, A, B) {
  const pa = m.pads.find((p) => p.id === A.owner)
  const pb = m.pads.find((p) => p.id === B.owner)
  return pa && pb && pa.comp === pb.comp
}

function center(s) {
  if (s.kind === "circle") return s.c
  if (s.kind === "seg") return { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 }
  const n = s.pts.length
  return { x: s.pts.reduce((a, p) => a + p.x, 0) / n, y: s.pts.reduce((a, p) => a + p.y, 0) / n }
}
