// tscircuit interprets a trace's pcbPath in the local frame of the trace's
// first ("from") component. These helpers let the board files think in
// absolute board coordinates instead.

export type Pt = { x: number; y: number }
export type Placement = { x: number; y: number; rot?: number }

/** Convert absolute board points into the local frame of `anchor`. */
export const rel = (anchor: Placement, pts: Pt[]): Pt[] => {
  const a = (-(anchor.rot ?? 0) * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return pts.map((p) => {
    const dx = p.x - anchor.x
    const dy = p.y - anchor.y
    return { x: dx * c - dy * s, y: dx * s + dy * c }
  })
}

/** Rotate a local offset by `rot` degrees and add it to an origin. */
export const place = (origin: Placement, local: Pt): Pt => {
  const a = ((origin.rot ?? 0) * Math.PI) / 180
  return {
    x: origin.x + local.x * Math.cos(a) - local.y * Math.sin(a),
    y: origin.y + local.x * Math.sin(a) + local.y * Math.cos(a),
  }
}

export const round = (v: number) => Math.round(v * 1000) / 1000
