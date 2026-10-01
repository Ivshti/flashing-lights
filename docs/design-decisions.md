# Emergency RGB light: early design decisions

Status: draft for discussion, nothing is frozen yet.
Target: 150 × 90 mm rounded board for an authorized emergency vehicle. It runs on a battery, uses an ESP32, has a high-power RGB(W) array, and is visible through a windshield the way a dash or deck "can" light is.

---

## 1. Fab reality on JLCPCB (read this first)

**JLC's aluminium (metal-core) boards are single-layer only.** Other limits: 1 W/mK dielectric, 1 oz copper, min drill 1.0 mm, non-plated holes, HASL finish, white or black mask. That rules out the original plan of LEDs on the front and the ESP32, battery and buttons on the rear: **the back of an MCPCB is bare aluminium, and that face is the heatsink.**

Recommended build is a **two-board stack**:

| Board | Material | Contents |
|---|---|---|
| **LED board** (front) | Aluminium MCPCB, 1.6 mm, 1 layer, rounded 150×90 | LEDs, current-sink MOSFETs + sense resistors, NTC, SMD board-to-board header. Cross traces with 0 Ω jumpers. **SMD parts only**: through-hole pins would short to the aluminium. |
| **Control board** (rear) | FR4, 2 or 4 layer, same outline | ESP32-S3 module, USB-C charging, 2S protection/balancing, 4 buttons, 18650 holder(s) or pouch connector, fuel gauge / ADC divider, battery NTC. Double-sided assembly is fine. |

* Joining the boards: SMD 2.54 mm header on the MCPCB mating a socket on the FR4. About 20–24 pins: around 16 channel gates, battery +/− on several pins each, LED NTC, 3V3. A 2.54 mm pin carries about 3 A.
* Leave an **air gap of ≥ 8–10 mm** behind the MCPCB, or better, a thermal pad onto a metal back or enclosure. Otherwise LED heat goes straight into the cells.
* Everything above is standard JLC SMT. The two things to verify at order time: (a) assembly of the aluminium board itself (check the current option in the quote page), and (b) which 18650 holder is in their library.
* **Alternative if you want a single board:** a 4-layer FR4 board with filled via-in-pad under each LED thermal pad. This works for *flashing* duty but not for sustained high-power white flood. JLC's copper-core "thermo-electric separation" substrate is the premium option: the LED thermal pad sits directly on the copper. It is also single-layer and costs more.

### Tripod mount (ISO 1222, 1/4"-20 UNC female)

JLC won't place this. FR4 also makes a poor structural mount under vehicle vibration with about 200 g of battery hanging off it. Options, best first:

1. Put a 1/4"-20 brass insert in the **enclosure**, heat-set or moulded.
2. Use a small aluminium bracket bolted to 4 × M3 holes in the **MCPCB**. The aluminium plate is the stiffest part of the stack.
3. Use a 1/4"-20 hex standoff through a 6.5 mm NPTH in the FR4. This is the weakest option.

### Connectors

* **Don't use JST PH for the battery.** It's rated about 2 A per contact. This light pulls 2.5–4 A from 2S and twice that from 1S. Use JST XH (3 A) or XT30 for power. A 3-pin XH or a separate PH can carry the 2S balance tap.

---

## 2. LEDs: RGB vs dedicated red/blue

Real emergency cans are almost always **mono red and blue** emitters. In an RGB package, only one of the three or four dies is the colour you want at any moment, so you get about a third of the light per package area. The case for RGB(W) is flexibility: one array does red, blue, amber (traffic advisor), white (flood/takedown) and green, where that's allowed.

Recommendation: **3535 ceramic RGBW "4-in-1" packages** (about 350 mA/die nominal, up to about 700 mA on good MCPCB, with a central thermal pad). Several Chinese makers list them on LCSC. Check stock and pick a part with a real datasheet that gives Vf/flux per die. The **W die** matters: RGB-mixed white is dim and ugly, and you want a real floodlight. Avoid WS2812-style "addressable 3535" parts, which run at tens of mA.

If maximum red/blue punch matters more than flexibility, a mixed array of mono Cree XP-E2 / OSRAM OSLON-class red, blue and white at up to 1 A each gives roughly 2× the red/blue intensity per watt of board.

### Array size

Brightness is limited by **thermal and battery budget, not LED count**. More LEDs driven gently give more lumens per watt (LED efficacy falls as current rises) and spread the heat. So use as many packages as the optics allow and keep the current moderate.

* **5 × 3 = 15 packages** at about 25 mm pitch matches the 5:3 board aspect. The array spans about 120 × 70 mm with 20 mm lenses and leaves side margins for MOSFETs and holes. **Recommended.**
* 4 × 4 needs about 21 mm pitch to fit the 90 mm height, which squeezes the lenses and the corners.
* 3 × 3 and 2 × 2 are fine electrically but waste the board.

Zones: 5 columns (or left / centre / right) × 4 colours ≈ 16–20 channels.

---

## 3. Battery: how long will it run?

Run [`tools/power_budget.py`](../tools/power_budget.py) after changing the assumptions. The baseline is 15 RGBW packages at 350 mA/die, 80 % driver efficiency, 0.3 W of ESP32/overhead, 10 Wh usable per 3000 mAh 18650 and 17 Wh per 5000 mAh 21700.

| Mode | Avg LED power | 1 × 18650 | 2 × 18650 | 2 × 21700 |
|---|---:|---:|---:|---:|
| Wig-wag R/B, whole array | 8.3 W | 56 min | 1.9 h | 3.2 h |
| Split R/B (left red / right blue) | 4.2 W | 1.8 h | 3.6 h | 6.2 h |
| Amber traffic advisor | 5.5 W | 84 min | 2.8 h | 4.8 h |
| Steady white flood (≈1500 lm) | 16.3 W | 29 min | 58 min | 1.6 h |
| White flood, derated 50 % | 8.1 W | 57 min | 1.9 h | 3.2 h |

Peak draw is about 16 W with one colour on across the whole array. All four dies at once would be about 61 W, so **firmware must cap total power**.

Takeaways:

* **Plan on about 1–2 h of full-intensity flashing on 2 × 18650.** One cell halves every number.
* **Two 21700s fit the board**: about 70 mm long, side by side in about 46 mm. They give roughly 70 % more runtime than 18650s for a few mm of extra thickness.
* **2S (series) over 1S2P** for the same two cells:
  * Battery current is halved, about 2–3 A instead of 5–7 A. That's easier on holders, connectors and traces.
  * Blue, green and white LEDs (Vf ≈ 3.1–3.4 V at current) **dim noticeably on a single cell** once it drops below about 3.6 V. On 2S, strings of two LEDs keep constant current through about 85 % of capacity.
  * The cost is a 2S charger with balancing (e.g. TI BQ25887 USB-C boost charger, or Injoinic IP2326) plus a 2S protection IC.
* **Add 12 V / USB-C PD input** so the light runs from the vehicle and the battery is only the portable fallback. Every commercial dash light does this.
* **Heat warning:** a dashboard in summer sun can exceed 70–80 °C. That is beyond Li-ion storage limits, and pouch cells swell. Put an NTC on the pack, block charging outside 0–45 °C, and don't leave the light on the dash parked in the sun. Prefer cylindrical cells over pouch here.

### Thermal budget (ties into runtime)

A bare 150 × 90 mm aluminium board in still air sheds about **6–8 W continuous** at a 30–40 K rise. The flash modes above fit that. Steady full-white flood (16 W) does not: it needs a finned or enclosure heatsink, or firmware derating driven by the LED-board NTC. Plan for derating either way.

### Driver topology (proposal, for the next step)

Use a linear constant-current sink per channel: logic-level N-MOSFET + about 0.2 Ω sense resistor + op-amp (LMV324-class, JLC basic). The ESP32 PWM gates each channel for patterns and dimming. Use 2S with series strings sized close to the pack voltage, e.g. 3 × red ≈ 6.6 V and 2 × blue/green/white ≈ 6.4 V. That holds linear efficiency around 85–90 %. The MOSFETs sit on the aluminium board, which spreads their heat. ESP32-S3 note: 8 LEDC + 12 MCPWM outputs. A classic ESP32 (16 LEDC) or a PCA9685 also works if you want one PWM per channel.

---

## 4. Optics: do we need reflectors?

**Yes, some optic is needed.** A bare LED is Lambertian (about 120° beam). Most of its light goes into the roof, the dash and the windshield glass instead of toward other drivers. Commercial cans put a **TIR lens or a reflector on every LED**.

* A **TIR lens** gives about **5–10× on-axis intensity** for the same watts, so it matters more than doubling the LED count. Generic 20 mm 3535-compatible TIR lenses cost well under $1. Ledil, Carclo and Khatod make engineered versions.
* Prefer an **elliptical / horizontal-spread optic** (e.g. about 10–15° vertical × 40–60° horizontal). Warning lights have to be seen across a wide horizontal arc, not from above or below. Round 30° lenses are the easy fallback.
* **Behind a windshield:** add a **black shroud/hood** around the light head. Otherwise light reflects off the inside of the glass into the driver's eyes, and the reflection also halves what gets out. Every suction-cup dash light uses one for this reason.
* Lens pegs and lens holders define the LED pitch, so **pick the lens before laying out the board**.

Rough intensity, red at 350 mA, 15 LEDs: about 300 cd bare vs a few thousand cd on-axis with 25° TIR. That's in the range of commercial dash lights. Verify with a bench test before finalizing.

---

## 5. Regulatory

Warning-lamp colours and photometry are regulated:

* US: SAE J595 / J845 plus state law on red and blue.
* EU: ECE R65.

Check which standard and colours apply to your agency and region before freezing the colour mix. The flash patterns live in firmware, so they can change later.

---

## Open questions

1. **Mounting:** inside the windshield (dash/visor) or exterior (grille/deck)? This drives sealing, optics and the shroud.
2. **Power:** battery-only, or vehicle 12 V / USB-C PD with battery backup?
3. **LEDs:** RGBW 4-in-1 for flexibility, or mono red/blue/white for maximum punch?
4. **Cells:** 2S 18650, 2S 21700, or 1S to keep it simple, accepting dimming and half the runtime?
5. **Region:** SAE or ECE? This sets the photometric target and allowed colours.
