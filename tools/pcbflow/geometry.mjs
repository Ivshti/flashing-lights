// Minimal 2D geometry for copper checks. Units: mm.

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

export function pointSegDist(p, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

export function segsIntersect(a, b, c, d) {
  const d1 = orient(c, d, a)
  const d2 = orient(c, d, b)
  const d3 = orient(a, b, c)
  const d4 = orient(a, b, d)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

export function segSegDist(a, b, c, d) {
  if (segsIntersect(a, b, c, d)) return 0
  return Math.min(pointSegDist(a, c, d), pointSegDist(b, c, d), pointSegDist(c, a, b), pointSegDist(d, a, b))
}

/** Copper shape: {kind:"poly", pts:[...]} (convex) or {kind:"circle", c, r} or
 *  {kind:"seg", a, b, r} (a stroked segment of half-width r). */
export function polyContains(pts, p) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function polySegDist(pts, a, b) {
  if (polyContains(pts, a) || polyContains(pts, b)) return 0
  let m = Infinity
  for (let i = 0; i < pts.length; i++) m = Math.min(m, segSegDist(pts[i], pts[(i + 1) % pts.length], a, b))
  return m
}

function polyPolyDist(p, q) {
  if (polyContains(p, q[0]) || polyContains(q, p[0])) return 0
  let m = Infinity
  for (let i = 0; i < p.length; i++)
    for (let j = 0; j < q.length; j++)
      m = Math.min(m, segSegDist(p[i], p[(i + 1) % p.length], q[j], q[(j + 1) % q.length]))
  return m
}

/** Edge-to-edge distance between two copper shapes (0 when touching). */
export function shapeDist(s, t) {
  if (s.kind === "seg" && t.kind === "seg") return Math.max(0, segSegDist(s.a, s.b, t.a, t.b) - s.r - t.r)
  if (s.kind === "circle" && t.kind === "circle") return Math.max(0, dist(s.c, t.c) - s.r - t.r)
  if (s.kind === "seg" && t.kind === "circle") return Math.max(0, pointSegDist(t.c, s.a, s.b) - s.r - t.r)
  if (s.kind === "circle" && t.kind === "seg") return shapeDist(t, s)
  if (s.kind === "poly" && t.kind === "seg") return Math.max(0, polySegDist(s.pts, t.a, t.b) - t.r)
  if (s.kind === "seg" && t.kind === "poly") return shapeDist(t, s)
  if (s.kind === "poly" && t.kind === "circle") {
    if (polyContains(s.pts, t.c)) return 0
    let m = Infinity
    for (let i = 0; i < s.pts.length; i++) m = Math.min(m, pointSegDist(t.c, s.pts[i], s.pts[(i + 1) % s.pts.length]))
    return Math.max(0, m - t.r)
  }
  if (s.kind === "circle" && t.kind === "poly") return shapeDist(t, s)
  if (s.kind === "poly" && t.kind === "poly") return polyPolyDist(s.pts, t.pts)
  throw new Error(`shapeDist ${s.kind}/${t.kind}`)
}

export function bbox(s) {
  if (s.kind === "circle") return [s.c.x - s.r, s.c.y - s.r, s.c.x + s.r, s.c.y + s.r]
  if (s.kind === "seg")
    return [Math.min(s.a.x, s.b.x) - s.r, Math.min(s.a.y, s.b.y) - s.r, Math.max(s.a.x, s.b.x) + s.r, Math.max(s.a.y, s.b.y) + s.r]
  const xs = s.pts.map((p) => p.x)
  const ys = s.pts.map((p) => p.y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

export const rectPts = (cx, cy, w, h, rotDeg = 0) => {
  const a = (rotDeg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c }))
}
