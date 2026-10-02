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

### Charger: BQ25887 (2S boost charger with cell balancing, I²C 0x6B or 0x6A)

* **Charging:** 5 V USB-C, sink-only (5.1k Rd on CC1/CC2). The ESP32 measures CC1/CC2 voltage (GPIO7/8) to learn the source's current advertisement, then raises the input current limit over I²C.
* **Default limit:** PSEL is pulled high, so the 500 mA default applies.
* **Standalone:** charging works without firmware, at the chip's defaults (8.4 V, auto termination).
* **Battery temperature:** NTC on TS (TH1 under the cells, 5.23k/30.1k network).
* **Balancing:** CBSET → 47 Ω (2512) → cell midpoint, about 87 mA and 0.36 W. The MID sense pin has its own 300 Ω to the midpoint (R36), which the datasheet asks for in case the bottom cell is inserted backwards.
* **Input current hardware limit:** R_ILIM = 390 Ω, about 2.85 A typical and 3.3 A worst case (K_ILIM 1110–1276 A·Ω).
* **Output:** BAT (pins 13–14) is the pack and the system load. SNS (15–16) is the boost output in front of the internal sense resistor and only carries its 2 × 22 µF caps. There is no power path, so system current while charging also flows through the sense resistor and is subtracted from the charge current.
* **I²C address:** the datasheet says 0x6A in one place and 0x6B in others. Firmware probes both.

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

## Datasheet check

The power ICs were checked against copies of the official datasheets: TI SLUSD89B (BQ25887), SLVSD38C (TPS61089) and SLOS263X (LMV321), and Diodes DS41326 (AP6320x). Every pin table matches the footprints. Values:

| Part | Item | Value | Datasheet basis |
|---|---|---|---|
| BQ25887 | R_ILIM | 390 Ω (was 200 Ω) | I_IN = 1110 A·Ω / R. 200 Ω gave 5.5 A, so the pin limited nothing |
| BQ25887 | SNS caps | 2 × 22 µF 25 V (was 2 × 10 µF) | "44 µF on SNS" |
| BQ25887 | BAT cap | 10 µF (was 1 µF) | separate cap on BAT |
| BQ25887 | MID pin | via 300 Ω to the midpoint (was direct) | reverse-cell protection |
| BQ25887 | CBSET | 47 Ω, 2512 | 87 mA, 0.36 W |
| BQ25887 | Inductor | 1 µH, Isat ≥ 4 A (4.5 A+ preferred) | 3 A in + 1.35 A ripple |
| BQ25887 | PMID / VBUS / BTST / REGN | 2 × 10 µF / 1 µF / 47 nF / 4.7 µF | OK |
| BQ25887 | TS | 5.23k / 30.1k | Same as TI's application figure: ≈ 0 / 10 / 45 / 60 °C with a B3380 NTC |
| BQ25887 | PSEL | pulled high: 500 mA until firmware raises IINDPM | Deliberate: safe on any USB source without firmware |
| TPS61089 | R_FSW | 301k FSW→SW | ≈ 510–520 kHz at 6–8.4 V in |
| TPS61089 | R_ILIM | 150k | 6.9 A typ, ≥ 6.1 A; peak need ≈ 4.2 A. Inductor Isat ≥ 7.5 A |
| TPS61089 | FB | 76.8k / 10k | 10.52 V |
| TPS61089 | Compensation | 15k + 10 nF (was 4.7 nF) + 22 pF | Eq. 17–19 with ≈ 30–40 µF effective C_OUT. Crossover ≈ 8 kHz, RHP zero ≈ 89 kHz |
| TPS61089 | VCC | 2.2 µF 16 V | > 1 µF, VCC ≈ 5.8 V |
| AP63203WU | L / C | 4.7 µH, 10 µF in, 2 × 22 µF out | The datasheet uses 3.9 µH, and 2.2–10 µH is allowed |

Behaviour to know about:

* **Boost off:** with EN low, VSYS still reaches VBOOST through the high-side body diode (VBOOST ≈ VSYS − 0.5 V). That is too low to light the G/B strings, and the sinks are off anyway.
* **TPS61089 characterization:** its electrical table is characterised at 2.7–5.5 V in. 6–8.4 V is inside the recommended 2.7–12 V range.

Still unverified (no datasheet access):

| Part | Item | Value used |
|---|---|---|
| AO4407A / AO3400A | Pinout | KiCad library and secondary sources: S 1–3, G 4, D 5–8 / G 1, S 2, D 3 |
| BH-18650-PC | Polarity, and sourcing | Pin 1 = "+" (KiCad footprint). Not stocked by LCSC: supply it yourself, or swap in an LCSC holder (e.g. C19184084) after checking its drawing against the footprint |

The fuse land pattern is KiCad's `Fuse_Littelfuse-NANO2-451_453`. The **USB-C** receptacle (HRO TYPE-C-31-M-12, LCSC C165948) and the **ESP32 module** use KiCad's standard footprints.
