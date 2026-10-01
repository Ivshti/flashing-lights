// Freerouting setup for the single-layer LED board (see tools/pcbflow).
export default {
  name: "led-board",
  root: "..",
  circuitJson: "dist/hardware/led-board/circuit.json",
  outDir: "build/led-board",
  dsn: {
    cornerRadius: 15,
    edgeClearance: 0.6,
    holeClearance: 0.4,
    clearance: 0.2,
    smdClearance: 0.15,
    defaultWidth: 0.25,
    classes: [
      { name: "gnd", match: /^GND/, width: 0.5 },
      { name: "cathode", match: /^N\d[RGBA]p$/, width: 0.4 },
    ],
  },
  freerouting: { passes: 60, threads: 4, timeoutS: 1500 },
  check: { clearance: 0.19, holeClearance: 0.3 },
}
