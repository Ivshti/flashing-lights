// LED board: 150 x 90 mm single-layer aluminium MCPCB, fully hand-routed.
//
// 4 columns x 3 rows of 3535 RGBA 4-in-1 LEDs. Each column is one zone; each
// colour of a column is one series string of 3 dies with its own low-side
// constant-current sink (LMV321 + AO3400A + 0.33R sense):
//   R, A strings  -> VBAT   (switched 2S Li-ion, 6.0..8.4 V)
//   G, B strings  -> VBOOST (~10.5 V from the control board)
// A PCA9685 generates the 16 PWM lines. Each sink's op-amp is powered by its
// own PWM line (and the reference is a divider of it), so the driver cells
// need nothing but PWM, cathode and ground.
//
// Single-layer topology (see docs/led-board.md):
//  * top edge: VBOOST bus (outer) and VBAT bus (inner); a 2512 0R per column
//    hops VBOOST over VBAT
//  * driver clusters sit in the lens-free strips next to each column; each
//    cluster has its own GND wire to the control board, so the bottom edge
//    stays open for the PWM bundles
//  * inside a cluster a GND spine runs vertically; every PWM line crosses it
//    on a 1206 0R jumper

import { rel, place, round, type Pt, type Placement } from "./lib/geom"
import { FP_LED3535_RGBA, DIE_ORDER, dieX, LED_ROW_Y, type Die } from "./lib/led3535"
import { NMOS, OpAmp1, PCA9685, TapPad, WirePad } from "./lib/parts"

// ---------------------------------------------------------------- geometry
export const BOARD = { w: 150, h: 90, r: 15 }
export const COLS = [-45, -15, 15, 45]
export const ROWS = [22, 0, -22]
export const MOUNT_HOLES: Pt[] = [
  { x: -69, y: 36 },
  { x: 69, y: 36 },
  { x: 0, y: -38 },
]
const STRIP_X = [-61.5, -30, 30, 61.5] // driver cluster per column
const Y_VBOOST = 42.6
const Y_VBAT = 39.0
const J_SPAN = 5.924 // 2512 pad centre distance
const TAP_DX = 3.6 // VBAT tap offset from column centre
const PCA: Placement = { x: 0, y: 5 }

// driver cell centres per side, and which die sits in which cell
const CELLS_LEFT: [Die, number][] = [["R", -1], ["G", -12], ["B", -23], ["A", -34]]
const CELLS_RIGHT: [Die, number][] = [["A", 11], ["B", 0], ["G", -11], ["R", -25.5]]
// PCA9685 output per (column, die): chosen so every PWM line is planar
export const PWM_MAP: Record<number, Record<Die, number>> = {
  1: { A: 0, B: 1, G: 2, R: 3 },
  0: { A: 4, B: 5, G: 6, R: 7 },
  2: { R: 15, G: 14, B: 13, A: 12 },
  3: { R: 11, G: 10, B: 9, A: 8 },
}

const W_STRING = 0.4
const W_BUS = 2.0
const W_DROP = 0.4
const W_K = 0.4
const W_PWM = 0.25
const W_SPINE = 0.8

// ---------------------------------------------------------------- registry
const comps: Record<string, Placement> = {}
const at = (name: string, p: Placement) => {
  comps[name] = p
  return { pcbX: round(p.x), pcbY: round(p.y), pcbRotation: ((p.rot ?? 0) + 360) % 360 }
}
type Tr = { name: string; from: string; to: string; pts: Pt[]; w: number }
const traces: Tr[] = []
/** hand-routed trace; `pts` are absolute board coordinates between the pads */
const T = (name: string, from: string, to: string, pts: Pt[], w: number) =>
  traces.push({ name, from, to, pts, w })
const compOf = (sel: string) => sel.match(/^\.([A-Za-z0-9_]+)/)![1]

// ---------------------------------------------------------------- LEDs + strings
const parts: any[] = []
for (let c = 0; c < 4; c++)
  for (let r = 0; r < 3; r++)
    parts.push(
      <chip
        key={`D${c}${r}`}
        name={`D${c}${r}`}
        {...at(`D${c}${r}`, { x: COLS[c], y: ROWS[r] })}
        footprint={FP_LED3535_RGBA}
        manufacturerPartNumber="3535 RGBA 4-in-1 ceramic, 350 mA/die (see docs)"
      />,
    )
for (let c = 0; c < 4; c++)
  for (let r = 0; r < 2; r++)
    for (const d of DIE_ORDER) T(`S${c}${d}${r}`, `.D${c}${r} > .K${d}`, `.D${c}${r + 1} > .A${d}`, [], W_STRING)

// ---------------------------------------------------------------- rails
const Jumper = (name: string, p: Placement, fp = "2512") => (
  <resistor
    key={name}
    name={name}
    resistance="0"
    footprint={fp}
    {...at(name, p)}
    manufacturerPartNumber={`0R jumper ${fp}`}
  />
)
// with rot=90 a 2512's pin1 is the lower pad and pin2 the upper pad
const jv = (c: number): Placement => ({ x: COLS[c], y: Y_VBOOST - J_SPAN / 2, rot: 90 })
const JVC: Placement = { x: 2.5, y: Y_VBOOST - J_SPAN / 2, rot: 90 }
for (let c = 0; c < 4; c++) parts.push(Jumper(`JV${c}`, jv(c)))
parts.push(Jumper("JVC", JVC))

const P_VBAT: Placement = { x: -2.5, y: 33.6 }
const P_VBOOST: Placement = { x: 2.5, y: 32.2 }
parts.push(
  <WirePad key="P_VBAT" name="P_VBAT" {...at("P_VBAT", P_VBAT)} d={3.2} hole={1.7} label="VBAT" labelDy={-2.6} />,
  <WirePad key="P_VBOOST" name="P_VBOOST" {...at("P_VBOOST", P_VBOOST)} d={3.0} hole={1.6} label="VBST" labelDy={-2.5} />,
)
const tapR = (c: number): Placement => ({ x: COLS[c] - TAP_DX, y: Y_VBAT })
const tapA = (c: number): Placement => ({ x: COLS[c] + TAP_DX, y: Y_VBAT })
for (let c = 0; c < 4; c++)
  parts.push(
    <TapPad key={`TVR${c}`} name={`TVR${c}`} {...at(`TVR${c}`, tapR(c))} />,
    <TapPad key={`TVA${c}`} name={`TVA${c}`} {...at(`TVA${c}`, tapA(c))} />,
  )
// VBAT bus: TVR0-TVA0-TVR1-TVA1 | P_VBAT | TVR2-TVA2-TVR3-TVA3
const vbatChain = [0, 1, 2, 3].flatMap((c) => [`TVR${c}`, `TVA${c}`])
for (let k = 0; k < vbatChain.length - 1; k++)
  if (k !== 3) T(`BVBAT${k}`, `.${vbatChain[k]} > .T`, `.${vbatChain[k + 1]} > .T`, [], W_BUS)
T("BVBATL", ".P_VBAT > .W", ".TVA1 > .T", [{ x: P_VBAT.x, y: Y_VBAT }], W_BUS)
T("BVBATR", ".P_VBAT > .W", ".TVR2 > .T", [{ x: P_VBAT.x, y: Y_VBAT }], W_BUS)
// VBOOST: pad -> JVC (hops the VBAT bus) -> bus -> JVc -> column G/B anodes
T("BVBST_IN", ".P_VBOOST > .W", ".JVC > .pin1", [], 1.2)
const vbstChain = ["JV0", "JV1", "JVC", "JV2", "JV3"]
for (let k = 0; k < vbstChain.length - 1; k++)
  T(`BVBST${k}`, `.${vbstChain[k]} > .pin2`, `.${vbstChain[k + 1]} > .pin2`, [], W_BUS)

const anode = (c: number, i: number): Pt => ({ x: COLS[c] + dieX(i), y: ROWS[0] + LED_ROW_Y })
for (let c = 0; c < 4; c++) {
  const aR = anode(c, 0)
  const aA = anode(c, 3)
  T(`DR${c}`, `.TVR${c} > .T`, `.D${c}0 > .AR`, [{ x: tapR(c).x, y: 26.5 }, { x: aR.x, y: aR.y + 1.3 }], W_DROP)
  T(`DA${c}`, `.TVA${c} > .T`, `.D${c}0 > .AA`, [{ x: tapA(c).x, y: 26.5 }, { x: aA.x, y: aA.y + 1.3 }], W_DROP)
  for (const i of [1, 2]) {
    const a = anode(c, i)
    T(`D${DIE_ORDER[i]}${c}`, `.JV${c} > .pin1`, `.D${c}0 > .A${DIE_ORDER[i]}`, [{ x: COLS[c], y: a.y + 2.4 }, { x: a.x, y: a.y + 1.4 }], W_DROP)
  }
}

// ---------------------------------------------------------------- driver cells
// Cell template in the frame of a LEFT cluster (column towards +u), cell
// centre at the origin. Right clusters use the same template rotated 180 deg.
const CELL = {
  Q: { u: 2.4, v: 0, r: 0 },
  RS: { u: -1.9, v: -0.95, r: 0 },
  RP: { u: 0.45, v: 0, r: 90 },
  U: { u: 0.6, v: 4.6, r: 0 },
  RG: { u: 1.6, v: 2.45, r: 90 },
  RB: { u: -1.7, v: 5.07, r: 90 },
  RT: { u: -0.5375, v: 6.95, r: 90 },
  CD: { u: -2.75, v: 6.1, r: 90 },
  JP: { u: -3.9, v: 7.9, r: 0 },
}
// pin positions in the same frame
const PIN: Record<string, Pt> = {
  "Q.G": { x: 1.4625, y: 0.95 },
  "Q.S": { x: 1.4625, y: -0.95 },
  "Q.D": { x: 3.3375, y: 0 },
  "RS.1": { x: -3.362, y: -0.95 },
  "RS.2": { x: -0.438, y: -0.95 },
  "RP.1": { x: 0.45, y: -0.51 },
  "RP.2": { x: 0.45, y: 0.51 },
  "U.INP": { x: -0.5375, y: 5.55 },
  "U.VN": { x: -0.5375, y: 4.6 },
  "U.INN": { x: -0.5375, y: 3.65 },
  "U.OUT": { x: 1.7375, y: 3.65 },
  "U.VP": { x: 1.7375, y: 5.55 },
  "RG.1": { x: 1.6, y: 1.94 },
  "RG.2": { x: 1.6, y: 2.96 },
  "RB.1": { x: -1.7, y: 4.56 },
  "RB.2": { x: -1.7, y: 5.58 },
  "RT.1": { x: -0.5375, y: 6.44 },
  "RT.2": { x: -0.5375, y: 7.46 },
  "CD.1": { x: -2.75, y: 5.59 },
  "CD.2": { x: -2.75, y: 6.61 },
  "JP.1": { x: -5.362, y: 7.9 },
  "JP.2": { x: -2.438, y: 7.9 },
}
const SPINE_U = -3.9
const KX = [4.7, 5.4, 6.1, 6.8] // cathode verticals, nearest first (offset from strip)
const CORR = (k: number) => 6.3 + 0.6 * k // PWM corridor offset from strip

type CellRef = { c: number; die: Die; id: string; vc: number; xf: (p: Pt) => Pt }
const cellsOf: Record<number, CellRef[]> = {}

for (let c = 0; c < 4; c++) {
  const left = c < 2
  const sx = STRIP_X[c]
  const list = left ? CELLS_LEFT : CELLS_RIGHT
  cellsOf[c] = []
  for (const [die, vc] of list) {
    const id = `${c}${die}`
    const xf = (p: Pt): Pt => (left ? { x: sx + p.x, y: vc + p.y } : { x: sx - p.x, y: vc - p.y })
    const rot = (r: number) => (left ? r : r + 180)
    const P = (k: keyof typeof CELL): Placement => {
      const q = xf({ x: CELL[k].u, y: CELL[k].v })
      return { x: q.x, y: q.y, rot: rot(CELL[k].r) }
    }
    cellsOf[c].push({ c, die, id, vc, xf })
    parts.push(
      <NMOS key={`Q${id}`} name={`Q${id}`} {...P("Q")} />,
      <OpAmp1 key={`U${id}`} name={`U${id}`} {...P("U")} />,
      <resistor key={`RS${id}`} name={`RS${id}`} resistance="0.33" footprint="1206" {...at(`RS${id}`, P("RS"))} />,
      <resistor key={`RG${id}`} name={`RG${id}`} resistance="100" footprint="0402" {...at(`RG${id}`, P("RG"))} />,
      <resistor key={`RP${id}`} name={`RP${id}`} resistance="100k" footprint="0402" {...at(`RP${id}`, P("RP"))} />,
      <resistor key={`RT${id}`} name={`RT${id}`} resistance="27k" footprint="0402" {...at(`RT${id}`, P("RT"))} />,
      <resistor key={`RB${id}`} name={`RB${id}`} resistance="1k" footprint="0402" {...at(`RB${id}`, P("RB"))} />,
      <capacitor key={`CD${id}`} name={`CD${id}`} capacitance="100nF" footprint="0402" {...at(`CD${id}`, P("CD"))} />,
      Jumper(`JP${id}`, P("JP"), "1206"),
    )
    comps[`Q${id}`] = P("Q")
    comps[`U${id}`] = P("U")
    const p = (k: string) => xf(PIN[k])
    const s = (k: string) => {
      const [cmp, pin] = k.split(".")
      const name = `${cmp}${id}`
      const lbl = { "1": "pin1", "2": "pin2" }[pin] ?? pin
      return `.${name} > .${lbl}`
    }
    const SP = (v: number) => xf({ x: SPINE_U, y: v })
    T(`${id}s1`, s("Q.S"), s("RS.2"), [], 0.5)
    T(`${id}s2`, s("RP.1"), s("Q.S"), [xf({ x: 0.45, y: -0.95 })], 0.3)
    T(`${id}g1`, s("RP.2"), s("Q.G"), [xf({ x: 0.45, y: 0.95 })], 0.3)
    T(`${id}g2`, s("RG.1"), s("Q.G"), [xf({ x: 1.6, y: 0.95 })], 0.3)
    T(`${id}o1`, s("RG.2"), s("U.OUT"), [], 0.3)
    T(`${id}n1`, s("U.INN"), s("RS.2"), [xf({ x: -0.5375, y: -0.6 })], 0.25)
    T(`${id}p1`, s("U.INP"), s("RB.2"), [], 0.25)
    T(`${id}p2`, s("U.INP"), s("RT.1"), [], 0.25)
    T(`${id}v1`, s("U.VN"), s("RB.1"), [], 0.3)
    T(`${id}v2`, s("RB.1"), s("RS.1"), [SP(4.56), SP(-0.95)], 0.5)
    T(`${id}v3`, s("CD.1"), s("RS.1"), [SP(5.59), SP(-0.95)], 0.5)
    T(`${id}w1`, s("CD.2"), s("JP.2"), [], 0.3)
    T(`${id}w2`, s("JP.2"), s("RT.2"), [xf({ x: -0.5375, y: 7.9 })], W_PWM)
    T(`${id}w3`, s("RT.2"), s("U.VP"), [xf({ x: 1.7375, y: 7.46 })], W_PWM)
    // stash absolute pin positions for the global routing below
    ;(cellsOf[c].at(-1) as any).pin = p
    ;(cellsOf[c].at(-1) as any).sel = s
  }
}

// GND spine between cells, plus one wire pad per cluster
for (let c = 0; c < 4; c++) {
  const left = c < 2
  const sx = STRIP_X[c]
  const cells = [...cellsOf[c]].sort((a, b) => a.vc - b.vc) // bottom first
  const spineX = left ? sx + SPINE_U : sx - SPINE_U
  const padY = left ? -37.8 : -36.4
  const pad = `P_GND${c}`
  parts.push(<WirePad key={pad} name={pad} {...at(pad, { x: spineX, y: padY })} d={3.0} hole={1.6} label={`GND${c}`} labelDy={0} labelDx={left ? 3.4 : -3.4} />)
  const rs = (k: CellRef) => (k as any).sel("RS.1")
  const rsY = (k: CellRef) => (k as any).pin("RS.1").y
  T(`G${c}p`, `.${pad} > .W`, rs(cells[0]), [{ x: spineX, y: rsY(cells[0]) }], W_SPINE)
  for (let k = 0; k < cells.length - 1; k++)
    T(`G${c}${k}`, rs(cells[k]), rs(cells[k + 1]), [{ x: spineX, y: rsY(cells[k]) }, { x: spineX, y: rsY(cells[k + 1]) }], W_SPINE)
}

// ---------------------------------------------------------------- cathodes
for (let c = 0; c < 4; c++) {
  const left = c < 2
  const sx = STRIP_X[c]
  const sgn = left ? 1 : -1 // direction from strip to column
  const cells = cellsOf[c]
  // order dies by the height of their cell: the highest cell gets the
  // outermost vertical; the lowest (below the turn) goes straight down
  const byHeight = [...cells].sort((a, b) => b.vc - a.vc)
  const below = byHeight.filter((k) => k.vc < -26)
  const above = byHeight.filter((k) => k.vc >= -26)
  // turn order: the die whose pad is outermost (towards the strip) turns first
  const turnOrder = left ? DIE_ORDER : [...DIE_ORDER].reverse()
  for (const k of cells) {
    const i = DIE_ORDER.indexOf(k.die)
    const pad = { x: COLS[c] + dieX(i), y: ROWS[2] - LED_ROW_Y }
    const yT = -25.0 - 0.7 * turnOrder.indexOf(k.die)
    const ai = above.indexOf(k)
    const xv = sx + sgn * (ai >= 0 ? KX[above.length - 1 - ai] : KX[0])
    const drain = (k as any).pin("Q.D")
    T(`K${k.id}`, `.D${c}2 > .K${k.die}`, (k as any).sel("Q.D"), [{ x: pad.x, y: yT }, { x: xv, y: yT }, { x: xv, y: drain.y }], W_K)
  }
  void below
}

// ---------------------------------------------------------------- PWM fan-out
// left fan: PCA pins 6..13 (LED0..7); right fan: pins 22..15 (LED15..8)
const bandY = (j: number) => (j < 4 ? -39.9 - 0.6 * j : -42.3 - 0.7 * (j - 4))
for (const side of [-1, 1]) {
  for (let j = 0; j < 8; j++) {
    const led = side < 0 ? j : 15 - j
    const pinNo = side < 0 ? 6 + j : 22 - j
    const pinY = PCA.y + (side < 0 ? 4.225 - (pinNo - 1) * 0.65 : -4.225 + (pinNo - 15) * 0.65)
    const xv = side * (4.4 + 0.6 * (7 - j))
    const yb = bandY(j)
    const c = side < 0 ? (j < 4 ? 1 : 0) : j < 4 ? 2 : 3
    const kk = j % 4
    const cell = cellsOf[c].find((k) => PWM_MAP[c][k.die] === led)!
    const jp = (cell as any).pin("JP.1")
    const pts: Pt[] = [
      { x: side * 3.9, y: pinY },
      { x: xv, y: pinY },
      { x: xv, y: yb },
    ]
    if (c === 1 || c === 2) {
      const xc = STRIP_X[c] + side * CORR(kk)
      pts.push({ x: xc, y: yb }, { x: xc, y: jp.y })
    } else {
      // outer clusters: follow the rounded board corner, then go up
      const cx = side * 60
      const r = -30 - yb
      pts.push({ x: cx, y: yb })
      for (let a = 265; a >= 225; a -= 5) {
        const t = (a * Math.PI) / 180
        pts.push({ x: cx - side * r * Math.cos(t), y: -30 + r * Math.sin(t) })
      }
      const last = pts.at(-1)!
      pts.push({ x: last.x, y: jp.y })
    }
    T(`PW${led}`, `.U1 > .LED${led}`, (cell as any).sel("JP.1"), pts, W_PWM)
  }
}

// ---------------------------------------------------------------- PCA9685 + I/O
parts.push(
  <PCA9685 key="U1" name="U1" {...PCA} />,
  <capacitor key="C1" name="C1" capacitance="100nF" footprint="0402" {...at("C1", { x: 1.6, y: 11.3, rot: 90 })} />,
  <capacitor key="C2" name="C2" capacitance="1uF" footprint="0402" {...at("C2", { x: 2.6, y: 11.3, rot: 90 })} />,
  <resistor key="RT1" name="RT1" resistance="10k" footprint="0603" {...at("RT1", { x: -4.75, y: 15.5, rot: 90 })} manufacturerPartNumber="NCP18XH103F03RB (NTC 10k B3380)" />,
)
comps.U1 = PCA
const SIG = [
  ["P_NTC", -4.75, "NTC"],
  ["P_GNDS", -2.85, "GND"],
  ["P_3V3", -0.95, "3V3"],
  ["P_SDA", 0.95, "SDA"],
  ["P_SCL", 2.85, "SCL"],
  ["P_OE", 4.75, "OE"],
] as const
for (const [n, x, label] of SIG)
  parts.push(<WirePad key={n} name={n} {...at(n, { x, y: 18.5 })} d={1.5} hole={0.9} label={label} labelDy={1.5} fontSize={0.6} />)
const py = (pin: number) => PCA.y + (pin <= 14 ? 4.225 - (pin - 1) * 0.65 : -4.225 + (pin - 15) * 0.65)
const pxL = PCA.x - 2.8625
const pxR = PCA.x + 2.8625
// GND trunk under the PCA body
T("GT0", ".P_GNDS > .W", ".U1 > .A0", [{ x: -2.85, y: 10.3 }, { x: 0, y: 10.3 }, { x: 0, y: py(1) }], 0.5)
T("GT1", ".U1 > .A1", ".U1 > .A0", [{ x: 0, y: py(2) }, { x: 0, y: py(1) }], 0.3)
T("GT2", ".U1 > .A2", ".U1 > .A1", [{ x: 0, y: py(3) }, { x: 0, y: py(2) }], 0.3)
T("GT3", ".U1 > .A3", ".U1 > .A2", [{ x: 0, y: py(4) }, { x: 0, y: py(3) }], 0.3)
T("GT4", ".U1 > .A4", ".U1 > .A3", [{ x: 0, y: py(5) }, { x: 0, y: py(4) }], 0.3)
T("GT5", ".U1 > .VSS", ".U1 > .A4", [{ x: 0, y: py(14) }, { x: 0, y: py(5) }], 0.3)
T("GT6", ".U1 > .A5", ".U1 > .A4", [{ x: 0, y: py(24) }], 0.3)
T("GT7", ".U1 > .EXTCLK", ".U1 > .A3", [], 0.3)
T("GT8", ".C1 > .pin1", ".P_GNDS > .W", [{ x: 1.6, y: 10.3 }, { x: -2.85, y: 10.3 }], 0.5)
T("GT9", ".C2 > .pin1", ".C1 > .pin1", [{ x: 2.6, y: 10.3 }, { x: 1.6, y: 10.3 }], 0.4)
T("GTN", ".RT1 > .pin1", ".P_GNDS > .W", [{ x: -2.85, y: 14.675 }], 0.4)
T("NTC", ".P_NTC > .W", ".RT1 > .pin2", [], 0.3)
T("VDD", ".P_3V3 > .W", ".U1 > .VDD", [{ x: -0.95, y: 12.5 }, { x: 4.0, y: 12.5 }, { x: 4.0, y: py(28) }], 0.4)
T("VDC1", ".C1 > .pin2", ".P_3V3 > .W", [{ x: 1.6, y: 12.5 }, { x: -0.95, y: 12.5 }], 0.4)
T("VDC2", ".C2 > .pin2", ".C1 > .pin2", [{ x: 2.6, y: 12.5 }, { x: 1.6, y: 12.5 }], 0.4)
T("SDA", ".P_SDA > .W", ".U1 > .SDA", [{ x: 0.95, y: 13.3 }, { x: 4.6, y: 13.3 }, { x: 4.6, y: py(27) }], 0.25)
T("SCL", ".P_SCL > .W", ".U1 > .SCL", [{ x: 2.85, y: 14.1 }, { x: 5.2, y: 14.1 }, { x: 5.2, y: py(26) }], 0.25)
T("OE", ".P_OE > .W", ".U1 > .OE", [{ x: 4.75, y: 14.9 }, { x: 5.8, y: 14.9 }, { x: 5.8, y: py(23) }], 0.25)
void pxL
void pxR

// ---------------------------------------------------------------- render
const holes = MOUNT_HOLES.map((p, i) => <hole key={`MH${i}`} name={`MH${i}`} diameter="3.2mm" pcbX={p.x} pcbY={p.y} />)

const renderTrace = (t: Tr) => {
  const anchor = comps[compOf(t.from)]
  if (!anchor) throw new Error(`no placement for ${t.from}`)
  return (
    <trace
      key={t.name}
      name={t.name}
      from={t.from}
      to={t.to}
      thickness={`${t.w}mm`}
      pcbPath={rel(anchor, t.pts).map((p) => ({ x: round(p.x), y: round(p.y) }))}
    />
  )
}

export default () => (
  <board
    width={`${BOARD.w}mm`}
    height={`${BOARD.h}mm`}
    borderRadius={`${BOARD.r}mm`}
    layers={1}
    title="Emergency RGBA light - LED board (aluminium MCPCB, 1 layer)"
    schematicDisabled
  >
    {parts}
    {holes}
    {traces.map(renderTrace)}
    <silkscreentext text="FLASHING-LIGHTS LED v0.1" pcbX={0} pcbY={-30} fontSize={1.4} anchorAlignment="center" />
    <silkscreentext text="ALUMINIUM 1.6mm 1oz" pcbX={0} pcbY={-32.2} fontSize={1} anchorAlignment="center" />
  </board>
)
