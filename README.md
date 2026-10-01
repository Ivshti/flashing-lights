# flashing-lights

A battery-powered RGBA emergency warning light and floodlight for authorized emergency vehicles. It mounts inside the windshield (dash, visor, mirror or suction mount) and uses two boards in a 150 × 90 mm stack:

| Board | Description | Docs |
|---|---|---|
| **LED board** | Aluminium MCPCB, 1 layer. 12 × 3535 RGBA LEDs (4 zones × 3), 16 constant-current sinks (~335 mA per string), PCA9685 PWM. Hand-routed. | [docs/led-board.md](docs/led-board.md) |
| **Control board** | FR4, 4 layers. 2 × 18650 (2S) with USB-C charging and balancing (BQ25887), 10.5 V boost (TPS61089), 3.3 V buck, ESP32-S3, 4 buttons, 1/4"-20 tripod hole. Freerouted. | [docs/control-board.md](docs/control-board.md) |

Background and trade-offs (fab limits, battery runtime, optics) are in [docs/design-decisions.md](docs/design-decisions.md).

## Repository layout

```
hardware/              tscircuit sources (TypeScript/React)
  led-board.circuit.tsx      LED board, every trace placed in code
  control-board.circuit.tsx  control board placement + netlist
  control-board.route.mjs    Freerouting setup (net classes, GND plane, stubs)
  *.bom.mjs                  BOM / LCSC data per board
  lib/                       footprints (KiCad-derived + custom LED), helpers
tools/pcbflow/         DSN export, Freerouting bridge, DRC, render, JLC fab export
firmware/board_pins.h  pin map and PWM channel table
fab/                   generated Gerbers, drills, BOM and CPL for JLCPCB
```

## Build

```sh
npm install
tools/fetch-freerouting.sh   # Freerouting 2.4.1 (needs Java 25) for the control board
npm run led                  # build + DRC + Gerbers/BOM/CPL for the LED board
npm run ctl                  # build + autoroute + Gerbers/BOM/CPL for the control board
```

`tools/pcbflow/render.mjs <circuit.json> <out-prefix> [width] [top|bottom]` writes a PNG preview. `tools/pcbflow/gerbercheck.py` re-reads the Gerbers with an independent parser.

## Ordering at JLCPCB

* **LED board:** upload `fab/led-board/led-board-gerbers.zip`.
  * Base material **Aluminium**, 1 layer, 1.6 mm, 1 oz, white mask.
  * SMT assembly with `led-board-BOM.csv` and `led-board-CPL.csv`.
* **Control board:** upload `fab/control-board/control-board-gerbers.zip`.
  * 4 layers, 1.6 mm, 2 oz outer copper recommended.
  * Double-sided assembly. The THT holders and buttons can be hand-soldered.
* **Before ordering, work through the verify lists in both board docs.** Several BOM lines have no LCSC number yet. JLC's CPL rotation must also be checked in their preview.

## Status

v0.1 is a complete, DRC-clean layout that has **not been built or tested**. Several parts were chosen without access to their datasheets: the LED part, BQ25887 and TPS61089 component values, and the fuse and holder footprints. Those parts are listed as "verify" items in the board docs.
