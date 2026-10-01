// Shared mechanical data for the two-board stack (LED board in front,
// control board 10-12 mm behind it, same outline and mounting holes).
import type { Pt } from "./geom"

export const BOARD = { w: 150, h: 90, r: 15 }
/** M3 holes for the standoffs between the boards */
export const MOUNT_HOLES: Pt[] = [
  { x: -69, y: 36 },
  { x: 69, y: 36 },
  { x: 0, y: -38 },
]
