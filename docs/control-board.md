# Control board (FR4, 4 layers)

Source: [`hardware/control-board.circuit.tsx`](../hardware/control-board.circuit.tsx). Fab files: [`fab/control-board/`](../fab/control-board/).

| | |
|---|---|
| Size | 150 × 90 mm, same outline and M3 holes as the LED board |
| Stack-up | 4-layer FR4, 1.6 mm. L1 power/signal, **L2 solid GND plane**, L3 signal, L4 signal. 2 oz outer copper is recommended (the pack path carries 3–4 A peaks). |
| Assembly | Double-sided |

## Layout

* **Top side** (faces the aluminium LED board, 10–12 mm gap):
  * charger, boost, buck and power latch;
  * USB-C on the left edge;
  * plated wire pads matching the LED board;
  * all SMD passives.
* **Bottom side** (faces you):
  * 2 × 18650 holders (MPD BH-18650-PC), symmetric about the centre;
  * ESP32-S3-WROOM-1 with its antenna at the top edge (keep-out on every layer);
  * 4 tactile buttons in a column on the left (6 × 6 mm, 13 mm actuators, to poke through a rear cover);
  * charge and status LEDs;
  * UART/strap test pads.
* **Tripod mount:** a Ø6.6 mm hole at (0, −10), between the two cells, for an ISO 1222 1/4"-20 female standoff or insert. Use one with OD ≤ 10 mm: the gap between the holders is 11.6 mm. The load path is board → M3 standoffs → aluminium LED board.

## Circuit

### Battery and power latch

* **Battery:** 2S pack: BT1 is the bottom cell, BT2 the top cell, and MID is the midpoint.
* **Path to VSYS:** PACK+ → F1 (7 A fuse) → Q1 AO4407A P-FET → **VSYS**.
* **Latch behaviour:**
  * R1 holds Q1 off.
  * Pressing **SW1** pulls the gate low through D1, and the system powers up.
  * The ESP32 then sets `PWR_HOLD` (GPIO11) so Q2 keeps the gate low.
  * The ESP32 reads SW1 through D2 on GPIO38 (long press → release `PWR_HOLD` → off).
* **Off current:** with the latch off, nothing but the charger's quiescent current loads the pack.
* **USB power:** D3 (SS34) feeds USB 5 V into VSYS. With USB plugged in, the electronics run even if the latch is off or the pack is flat. This also allows flashing over native USB.

### Charger: BQ25887 (2S boost charger with cell balancing, I²C 0x6A)

* **Charging:** 5 V USB-C, sink-only (5.1k Rd on CC1/CC2). The ESP32 measures CC1/CC2 voltage (GPIO7/8) to learn the source's current advertisement, then raises the input current limit over I²C.
* **Default limit:** PSEL is pulled high, so the 500 mA default applies.
* **Standalone:** charging works without firmware, at the chip's defaults (8.4 V, auto termination).
* **Battery temperature:** NTC on TS (TH1 under the cells, 5.23k/30.1k network).
* **Balancing:** CBSET → 47 Ω → MID.

### Boost: TPS61089 → VBOOST for the G/B strings

* **Output:** 10.5 V nominal (76.8k/10k on FB, Vref 1.212 V).
* **Trim:** `BOOST_TRIM` (GPIO13, LEDC PWM → 10k/1µF → 100k into FB) sets about 8.9–11.4 V. Firmware can lower VBOOST to just above the G/B string voltage, which cuts the heat in the LED-board sinks.
* **Settings:** f_sw ≈ 500 kHz (301k FSW→SW), I_LIM about 6–7 A (150k), L2 3.3 µH, 7 × 7 mm.
* **Enable:** `BOOST_EN` (GPIO12), 100k pull-down = off at boot.

### 3.3 V: AP63203 buck from VSYS (2 A, fixed 3.3 V)

### ESP32-S3 pin map

See [`firmware/board_pins.h`](../firmware/board_pins.h).

| Group | Signals |
|---|---|
| I²C | SDA GPIO9, SCL GPIO10. Shared by the PCA9685 (LED board) and the BQ25887. |
| ADC1 | VSYS, VBOOST, LED-board NTC, CC1, CC2 |
| Buttons | GPIO38 (power), GPIO0 (also BOOT), GPIO39, GPIO40 |

## Routing

Routing is done by Freerouting (`npm run ctl:route`), driven by `tools/pcbflow`:

1. tscircuit gives placement and netlist.
2. These go into a Specctra DSN with net classes, the GND plane on In1 and the antenna keep-out.
3. Freerouting routes it.
4. The session file is merged back into Circuit JSON.
5. The L2 plane is generated as a copper pour with clearance rings around every non-GND via and hole.
6. The same geometric DRC as the LED board checks connectivity (counting the plane) and clearances.

Copper placed in code before Freerouting runs (all in [`control-board.route.mjs`](../hardware/control-board.route.mjs)):

* **Fan-out stubs** out of the fine-pitch USB-C, BQ25887 and TPS61089 pins, so the wide power traces attach away from neighbouring pins.
* **GND plane vias:** one next to every SMD GND pad, plus a via grid inside each QFN exposed pad. Freerouting never has to route GND, and the switching loops close through the plane directly under them.
* **Hand-routed power:**
  * the 1.5 mm PACK+ and MID links;
  * the charger's switch node and PMID bus;
  * the boost converter's VOUT bus across its output caps;
  * the 1.5 mm VBOOST feed to the LED-board wire pad W2, on L4.

  Freerouting kept leaving these unfinished or narrow, so they are fixed geometry. The router sees them as protected wires.
* The ESP32 antenna area is a keep-out on every layer, including the plane.

`npm run ctl:route` runs everything above, then Freerouting, then the DRC. Useful switches:

| Variable | Effect |
|---|---|
| `PRECHECK=1` | Skip routing and DRC the hand-placed copper only |
| `CONTINUE=<routed.json>` | Start a second pass from an earlier result |

## Values to verify against datasheets

I could not open the TI datasheets while designing, so these come from datasheet summaries and the usual application circuits:

| Part | Item | Value used |
|---|---|---|
| BQ25887 | Pinout | KiCad symbol `BQ25887RGE` |
| BQ25887 | SNS/BAT | SNS gets the 2 × 10 µF output caps, BAT goes to the pack |
| BQ25887 | Inductor | 1 µH from PMID to SW |
| BQ25887 | PMID caps | 2 × 10 µF |
| BQ25887 | BTST | 47 nF |
| BQ25887 | REGN | 4.7 µF |
| BQ25887 | R_ILIM | 200 Ω |
| BQ25887 | CBSET resistor | 47 Ω |
| BQ25887 | TS network | 5.23k / 30.1k |
| TPS61089 | Pinout | KiCad symbol |
| TPS61089 | R_FSW | 301k (500 kHz), wired between FSW and SW |
| TPS61089 | R_ILIM | 150k |
| TPS61089 | Compensation | 15k + 4.7 nF + 22 pF |
| AP63203WU | Pinout | 1 FB(=VOUT), 2 EN, 3 IN, 4 GND, 5 SW, 6 BST |
| AP63203WU | Components | 4.7 µH, 2 × 22 µF |
| F1 | 2410 land pattern | Generic; confirm against the actual fuse |
| BH-18650-PC | Polarity | Pin 1 = "+" (KiCad footprint) |

The **USB-C** receptacle (HRO TYPE-C-31-M-12, LCSC C165948) and the **ESP32 module** use KiCad's standard footprints.
