# LED board (aluminium MCPCB, single layer)

Source: [`hardware/led-board.circuit.tsx`](../hardware/led-board.circuit.tsx). Fab files: [`fab/led-board/`](../fab/led-board/).

| | |
|---|---|
| Size | 150 × 90 mm, 15 mm corner radius |
| Material | Aluminium core, 1.6 mm, 1 oz, **1 copper layer**. Order as "Aluminum" at JLCPCB, white mask. |
| Parts | 165 SMD parts, all on the copper side |
| Mounting | 3 × M3 (Ø3.2) at (±69, 36) and (0, −38); same holes on the control board |

## What's on it

* **LEDs:** 12 × 3535 RGBA 4-in-1 LEDs in a 4 × 3 grid at 30 × 22 mm pitch. Each column is one zone.
* **Strings:** in each column, the three dies of one colour form a series string. That gives 16 strings in total.
* **Supply rails:**
  * R and A strings run from **VBAT**. This is the switched 2S pack, 6.0–8.4 V; three AlInGaP dies need about 6.6 V.
  * G and B strings run from **VBOOST**, about 10.5 V. Three InGaN dies need about 9.6 V.
* **Current sinks:** each string has its own linear sink, built from an LMV321 op-amp, an AO3400A MOSFET and a 0.33 Ω sense resistor.
  * The reference is the PWM line divided by 27k/1k: 3.3 V → 118 mV, which gives **about 335 mA per string**.
  * The op-amp is **powered by the same PWM line**. When PWM is low the sink is completely off, so no bias network is needed.
* **PWM source:** a PCA9685 (I²C 0x40, 12-bit, 16 channels) generates all 16 PWM signals. [`firmware/board_pins.h`](../firmware/board_pins.h) has the channel ↔ column/colour table. It isn't in order, because the order was chosen to keep the copper planar.
* **NTC:** a 10 kΩ NTC next to the PCA9685 measures board temperature.

## Single-layer routing

All copper is placed procedurally in the board file. No autorouter is used: Freerouting could not find a planar solution, and tscircuit's auto-jumper router fails on tiny test cases. The topology:

1. **Top edge:**
   * VBOOST bus (outer) and VBAT bus (inner).
   * A 2512 0 Ω jumper per column hops VBOOST over VBAT to that column's G/B anodes.
   * The R/A anodes drop straight from VBAT tap pads.
2. **Strings:** straight vertical lines between the LEDs of a column.
3. **Driver clusters:** one cluster per column, in the lens-free strip beside it.
   * Each cluster is a vertical stack of 4 identical cells: op-amp block above the MOSFET and sense resistor.
   * A GND spine runs down the cluster.
   * Every PWM line crosses the spine on a 1206 0 Ω jumper.
   * The right-hand clusters use the same cell rotated 180°.
4. **Ground:** each cluster has **its own GND wire** to the control board. This is the trick that makes the board planar. Without a GND bus along the bottom edge, the PWM bundles can run under every cluster.
5. **PCA9685 fan-out:** goes down the centre strip and outward along the bottom edge. The bundles for the outer clusters follow the rounded corners.
6. **Thermal:** with no ground plane available, heat leaves the LEDs through their pads and string copper into the aluminium.

### Heat in the sinks

Each sink MOSFET drops whatever voltage the string doesn't use:

| String | Supply | String + sense | Drop at 335 mA (worst case) |
|---|---|---|---|
| R / A (3 × AlInGaP, ≈ 2.1 V each) | VBAT, 6.0–8.4 V | ≈ 6.4 V | up to ≈ 0.7 W at a full pack |
| G / B (3 × InGaN, ≈ 3.0 V each) | VBOOST, 8.9–11.4 V | ≈ 9.1 V | ≈ 0.5 W at 10.5 V; ≈ 0.1 W trimmed to 9.4 V |

A SOT-23 on aluminium handles 0.7 W at low duty, but not with all 16 channels on continuously. Firmware should:

* trim VBOOST down to just above the G/B string voltage (see the control board's `BOOST_TRIM`);
* cap the total duty, and fold back on the LED-board NTC;
* expect R/A strings to dim slightly near an empty pack (below about 6.5 V), where the sink runs out of headroom.

DRC: `npm run led:drc` checks connectivity of every net and 0.2 mm copper clearance with a geometric checker (`tools/pcbflow/check.mjs`). It reports **0 unconnected nets and 0 violations**. An independent Gerber parser (gerbonara) re-reads the output (`npm run led:fab`).

## Wires to the control board (12)

Each wire pad is a copper ring around a non-plated hole. The insulated wire comes through the aluminium from the back and is soldered on the copper side.

| Pad | Position (mm) | Net | Wire |
|---|---|---|---|
| VBAT | (−2.5, 33.6) | switched pack (VSYS) | 20 AWG |
| VBST | (2.5, 32.2) | boost output | 20 AWG |
| NTC, GND, 3V3, SDA, SCL, OE | y = 18.5, x = −4.75 … 4.75 | logic | 26–28 AWG |
| GND0 … GND3 | (−65.4, −37.8), (−33.9, −37.8), (33.9, −36.4), (65.4, −36.4) | cluster grounds | 22 AWG |

The control board has plated pads at the same coordinates, so with 10–12 mm standoffs the wires run straight through.

## Things to verify before ordering

* **LED part and footprint: the one part JLC can't supply.** As of October 2026 there is no 350 mA-per-die RGBA 4-in-1 package on LCSC:
  * the branded RGBA emitters (LED Engin LZ4-00MA00 / -MA08) are obsolete;
  * the only LCSC RGBA part, Cree CLQ6A-YKW (C6534448), is a 100 mA PLCC8 (200 mA max) and would need a different footprint and lower sense currents;
  * Cree XM-L Color (RGBW) is the nearest branded alternative, but has no amber.

  The board is laid out for a **generic ceramic 3535 RGBA 4-in-1, 4 × 1 W**, which GMKJ, Moon-LEDs, Lumixtar and others sell. Order them, send them to JLC as **consigned parts** or reflow them by hand (hot plate), and check [`hardware/lib/led3535.tsx`](../hardware/lib/led3535.tsx) against that vendor's datasheet first:
  * pad pitch and size;
  * that each anode sits opposite its own cathode;
  * die order;
  * whether there is a thermal pad and whether it is neutral. A neutral pad can go on the copper under the package; one tied to a die cannot.

  If only the die order differs, change `DIE_ORDER` and the rest of the board regenerates. The sense resistors set about 335 mA per string: change `RS` (0.33 Ω) for other parts, e.g. 1.2 Ω for 100 mA.
* **LMV321 pinout:** TI DBV (1 IN+, 2 V−, 3 IN−, 4 OUT, 5 V+). SOT-23-5 single op-amp pinouts vary between vendors (some put OUT on pin 1), so check the exact part.
* **Lens fit:** about 20 mm TIR lenses fit the 30 × 22 mm pitch. The 1206 jumpers sit in the strips between lenses but get close at the row heights. Check against the actual lens holder.
* **JLC CPL rotations** must be checked in their 3D preview, as always.
