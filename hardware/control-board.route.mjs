// Freerouting setup for the 4-layer control board (In1 = GND plane).
// [net, pin y, via x] for BQ25887 pins 1-6
const U2_WEST = [
  ["CHG_PG", 21.25, -54.95], ["CHG_STAT", 20.75, -55.65], ["CHG_CD", 20.25, -54.95],
  ["SDA", 19.75, -55.65], ["SCL", 19.25, -54.95], ["CHG_INT", 18.75, -55.65],
]
const ANTENNA = { x1: 43, y1: 37.5, x2: 62, y2: 45 } // ESP32-S3 antenna keepout
export default {
  name: "control-board",
  root: "..",
  circuitJson: "dist/hardware/control-board/circuit.json",
  outDir: "build/control-board",
  dsn: {
    cornerRadius: 15,
    edgeClearance: 0.5,
    holeClearance: 0.35,
    clearance: 0.15,
    smdClearance: 0.15,
    defaultWidth: 0.2,
    via: { d: 0.6, drill: 0.3, layers: ["top", "inner1", "inner2", "bottom"] },
    planes: [{ net: "GND", layer: "In1.Cu" }],
    keepouts: [ANTENNA],
    classes: [
      { name: "batt", match: /^(PACKP|VSYS)$/, width: 0.8, clearance: 0.2 },
      { name: "vbatf", match: /^VBATF$/, width: 0.5, clearance: 0.2 },
      { name: "mid", match: /^MID$/, width: 0.3 },
      { name: "boost", match: /^(VBOOST|BST_SW)$/, width: 0.8, clearance: 0.2 },
      { name: "charger", match: /^(VBUS|PMID|CHG_SW|CHG_SNS)$/, width: 0.5, clearance: 0.2 },
      { name: "gnd", match: /^GND$/, width: 0.4 },
      { name: "logic_pwr", match: /^(V3V3|BUCK_SW)$/, width: 0.4 },
    ],
  },
  // wide hand-placed copper (absolute mm), added as protected wires
  wires: [
    { net: "MID", layer: "top", width: 1.5, pts: [{ x: -17, y: -36.45 }, { x: -17, y: -32.5 }, { x: 17, y: -32.5 }, { x: 17, y: -36.45 }] },
    { net: "MID", layer: "bottom", width: 1.5, pts: [{ x: -17, y: -36.45 }, { x: -17, y: -32.5 }, { x: 17, y: -32.5 }, { x: 17, y: -36.45 }] },
    { net: "PACKP", layer: "top", width: 1.5, pts: [{ x: 17, y: 36.45 }, { x: 17, y: 41.5 }, { x: 12.455, y: 41.5 }] },
    // BQ25887 power pins -> their local capacitors / inductor (U2 at (-52, 20))
    { net: "VBUS", layer: "top", width: 0.25, pts: [{ x: -52.75, y: 23.15 }, { x: -52.75, y: 23.4 }, { x: -54.77, y: 23.4 }] },
    { net: "PMID", layer: "top", width: 0.25, pts: [{ x: -52.25, y: 23.15 }, { x: -52.25, y: 24.6 }] },
    { net: "PMID", layer: "top", width: 0.25, pts: [{ x: -51.75, y: 23.15 }, { x: -51.75, y: 24.6 }] },
    { net: "PMID", layer: "top", width: 0.8, pts: [{ x: -55.5, y: 25.89 }, { x: -55.5, y: 24.6 }, { x: -49.05, y: 24.6 }, { x: -49.05, y: 26.5 }] },
    { net: "PMID", layer: "top", width: 0.8, pts: [{ x: -52.5, y: 24.6 }, { x: -52.5, y: 25.89 }] },
    { net: "CHG_SW", layer: "top", width: 0.25, pts: [{ x: -48.85, y: 20.75 }, { x: -48.85, y: 21.25 }] },
    { net: "CHG_SW", layer: "top", width: 0.5, pts: [{ x: -48.85, y: 21.25 }, { x: -47.6, y: 22.5 }, { x: -45.35, y: 24.75 }, { x: -45.35, y: 26.5 }] },
    { net: "CHG_SNS", layer: "top", width: 0.25, pts: [{ x: -48.85, y: 20.25 }, { x: -48.85, y: 19.75 }] },
    { net: "CHG_SNS", layer: "top", width: 0.4, pts: [{ x: -48.85, y: 19.75 }, { x: -45.5, y: 19.75 }, { x: -45.5, y: 19.04 }, { x: -43, y: 19.04 }] },
    { net: "CHG_SW", layer: "top", width: 0.3, pts: [{ x: -47.5, y: 17.51 }, { x: -46.9, y: 17.9 }] },
    { net: "CHG_SW", layer: "inner2", width: 0.3, pts: [{ x: -46.9, y: 17.9 }, { x: -46.9, y: 23.2 }, { x: -46.6, y: 23.5 }] },
    { net: "CHG_MID", layer: "top", width: 0.25, pts: [{ x: -52.25, y: 16.85 }, { x: -52.25, y: 15.6 }] },
    { net: "CHG_MID", layer: "bottom", width: 0.25, pts: [{ x: -52.25, y: 15.6 }, { x: -52.25, y: 14.31 }] },
    // TPS61089 (U3 at (46, -3)): VOUT bus to the output caps, SW to L2 / C16 / R15, VIN to C12
    { net: "VBOOST", layer: "top", width: 0.45, pts: [{ x: 46.35, y: -5.05 }, { x: 46.35, y: -6.4 }] },
    { net: "VBOOST", layer: "top", width: 0.8, pts: [{ x: 42.5, y: -7.54 }, { x: 42.5, y: -6.4 }, { x: 48.5, y: -6.4 }, { x: 48.5, y: -7.54 }] },
    { net: "VBOOST", layer: "top", width: 0.8, pts: [{ x: 45.5, y: -6.4 }, { x: 45.5, y: -7.54 }] },
    { net: "BST_SW", layer: "top", width: 0.8, pts: [{ x: 46, y: -0.95 }, { x: 46, y: 1.8 }, { x: 50.01, y: 1.8 }] },
    { net: "BST_SW", layer: "top", width: 0.8, pts: [{ x: 49.2, y: 1.8 }, { x: 49.2, y: 5 }] },
    { net: "BST_SW", layer: "top", width: 0.3, pts: [{ x: 50.01, y: 1.8 }, { x: 50.01, y: 0.6 }] },
    { net: "BST_SW", layer: "top", width: 0.3, pts: [{ x: 43.91, y: 0.6 }, { x: 46, y: 0.6 }] },
    { net: "VSYS", layer: "top", width: 0.3, pts: [{ x: 48.245, y: -2.75 }, { x: 49.8, y: -2.75 }, { x: 49.8, y: -2.31 }] },
    // VBOOST to the LED-board wire pad W2: 1.5 mm on the bottom layer, dropped
    // east of U3 so its west pins (COMP, FB) keep room for vias
    { net: "VBOOST", layer: "top", width: 0.8, pts: [{ x: 48.5, y: -6.4 }, { x: 50.3, y: -6.4 }] },
    { net: "VBOOST", layer: "bottom", width: 1.5, pts: [{ x: 50.3, y: -6.4 }, { x: 50.3, y: 9 }, { x: 30, y: 9 }, { x: 30, y: 25 }, { x: 8, y: 25 }, { x: 2.5, y: 30.5 }, { x: 2.5, y: 32.2 }] },
    // VBOOST tap for the FB divider (R18) and the ADC divider (R28)
    { net: "VBOOST", layer: "top", width: 0.3, pts: [{ x: 48.5, y: -7.54 }, { x: 48.9, y: -7.95 }, { x: 52.5, y: -7.95 }] },
    { net: "VBOOST", layer: "top", width: 0.3, pts: [{ x: 52.5, y: -7.51 }, { x: 52.5, y: -9.3 }, { x: 51.6, y: -9.6 }, { x: 51.6, y: -10.09 }] },
    // FB from R18 (east) to R19 / U3.3 (west) on In2, shielded by the plane
    { net: "BST_FB", layer: "top", width: 0.2, pts: [{ x: 52.5, y: -6.49 }, { x: 52.5, y: -5.9 }] },
    { net: "BST_FB", layer: "inner2", width: 0.2, pts: [{ x: 52.5, y: -5.9 }, { x: 42.25, y: -5.9 }, { x: 41.55, y: -5.2 }] },
    { net: "BST_FB", layer: "top", width: 0.2, pts: [{ x: 41.55, y: -5.2 }, { x: 42.4, y: -5.11 }] },
    // BQ25887 VBUS pin + C1 are boxed in by PMID and PSEL: via down
    { net: "VBUS", layer: "top", width: 0.3, pts: [{ x: -52.75, y: 23.15 }, { x: -52.75, y: 23.4 }, { x: -54.77, y: 23.4 }] },
    // BQ25887 west pins (0.5 mm pitch): fan out to two staggered columns of small vias
    ...U2_WEST.map(([net, y, x]) => ({ net, layer: "top", width: 0.2, pts: [{ x: -53.96, y }, { x, y }] })),
  ],
  vias: [
    { net: "CHG_SW", x: -46.9, y: 17.9 },
    { net: "CHG_SW", x: -46.6, y: 23.5 },
    { net: "CHG_MID", x: -52.25, y: 15.6 },
    { net: "VBOOST", x: 50.3, y: -6.4 },
    { net: "BST_FB", x: 52.5, y: -5.9 },
    { net: "BST_FB", x: 41.55, y: -5.2 },
    { net: "VSYS", x: 48.75, y: -2.75 },
    { net: "VBUS", x: -53.8, y: 23.4 },
    ...U2_WEST.map(([net, y, x]) => ({ net, x, y, d: 0.45, drill: 0.2 })),
    // U3 GND pin is boxed in by its neighbours and the VOUT bus: via on the end of its stub
    { net: "GND", x: 45.35, y: -5.1 },
  ],
  stubs: [
    { comp: "J1", pins: ["5", "6", "11", "12", "13", "14", "19", "20"], len: 0.6 },
    { comp: "U2", pins: ["7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "21", "22", "23"], len: 0.8 },
    { comp: "U3", pins: ["5", "6", "9"], len: 0.8 },
  ],
  planes: [{ net: "GND", layer: "inner1", clearance: 0.3, edge: 0.5, keepouts: [ANTENNA] }],
  // one via per SMD GND pad into the In1 plane, placed before routing
  planeVias: [
    {
      net: "GND",
      via: { d: 0.6, drill: 0.3, layers: ["top", "inner1", "inner2", "bottom"] },
      clearance: 0.2,
      keepouts: [ANTENNA],
      board: { w: 150, h: 90, r: 15 },
      skip: ["U3.5"],
    },
  ],
  freerouting: { passes: 80, threads: 4, timeoutS: 2400 },
  check: { clearance: 0.14, holeClearance: 0.25, minTrace: 0.1 },
}
