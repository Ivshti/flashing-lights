// Freerouting setup for the 4-layer control board (In1 = GND plane).
const ANTENNA = { x1: 35.5, y1: 37.5, x2: 54.5, y2: 45 } // ESP32-S3 antenna keepout
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
      { name: "batt", match: /^(PACKP|VBATF|VSYS)$/, width: 0.8, clearance: 0.2 },
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
    { net: "PACKP", layer: "top", width: 1.5, pts: [{ x: 17, y: 36.45 }, { x: 17, y: 41.5 }, { x: 7.45, y: 41.5 }] },
  ],
  stubs: [
    { comp: "J1", pins: ["5", "6", "11", "12", "13", "14", "19", "20"], len: 0.6 },
    { comp: "U2", pins: ["9", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"], len: 0.8 },
    { comp: "U3", pins: ["5", "6", "9", "11"], len: 0.8 },
  ],
  planes: [{ net: "GND", layer: "inner1", clearance: 0.3, edge: 0.5, keepouts: [ANTENNA] }],
  freerouting: { passes: 80, threads: 4, timeoutS: 2400 },
  check: { clearance: 0.14, holeClearance: 0.25 },
}
