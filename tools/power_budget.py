#!/usr/bin/env python3
"""Rough power / runtime budget for the RGBW emergency light.

All numbers are first-order estimates; edit the constants to match the
LED datasheet and cells you actually pick.
"""

# --- LED array -------------------------------------------------------------
N_PACKAGES = 12          # 4 x 3 grid of 3535 RGBA 4-in-1 packages (v0.1)
I_DIE_A = 0.335          # string current set by the sinks (0.33R, 27k/1k)
VF = {"R": 2.2, "G": 3.2, "B": 3.1, "W": 2.2}   # W column = amber die here (v0.1 is RGBA)

# --- system ----------------------------------------------------------------
DRIVER_EFF = 0.80        # LED power / battery power (linear sinks on 2S, avg)
OVERHEAD_W = 0.3         # ESP32 (radio mostly idle), regulators, quiescent
CELL_WH = 10.0           # usable energy per 3000 mAh 18650 (conservative)
CELL_WH_21700 = 17.0     # usable energy per 5000 mAh 21700


def die_w(color):
    return VF[color] * I_DIE_A


# mode name -> average LED power (W)
MODES = {
    # whole array flashes red, then whole array flashes blue; ~30 % on-time each
    "Wig-wag R/B, full array": N_PACKAGES * 0.30 * (die_w("R") + die_w("B")),
    # left half red / right half blue, alternating; each package one color
    "Split R/B (halves)": N_PACKAGES * 0.30 * (die_w("R") + die_w("B")) / 2,
    # amber die, ~30 % on-time (traffic advisor)
    "Amber traffic advisor": N_PACKAGES * 0.30 * die_w("W"),
    # RGBA has no white die: white = R+G+B mixed; full current is ~34 W,
    # far beyond the bare board's ~6-8 W, so firmware derates it
    "RGB white flood @25%": N_PACKAGES * 0.25 * (die_w("R") + die_w("G") + die_w("B")),
}


def runtime_h(led_w, wh):
    return wh / (led_w / DRIVER_EFF + OVERHEAD_W)


def fmt(h):
    return f"{h * 60:.0f} min" if h < 1.5 else f"{h:.1f} h"


if __name__ == "__main__":
    peak = N_PACKAGES * die_w("B")
    print(f"{N_PACKAGES} packages @ {I_DIE_A * 1000:.0f} mA/die; "
          f"one-color peak ~{peak:.1f} W, all-dies peak "
          f"~{N_PACKAGES * sum(die_w(c) for c in VF):.0f} W\n")
    hdr = f"{'Mode':28} {'LED avg':>8} {'1x18650':>9} {'2x18650':>9} {'2x21700':>9}"
    print(hdr)
    print("-" * len(hdr))
    for name, w in MODES.items():
        print(f"{name:28} {w:7.1f}W {fmt(runtime_h(w, CELL_WH)):>9} "
              f"{fmt(runtime_h(w, 2 * CELL_WH)):>9} "
              f"{fmt(runtime_h(w, 2 * CELL_WH_21700)):>9}")
    print("\nGeneric: runtime vs average LED power")
    for w in (3, 5, 8, 12, 20):
        print(f"  {w:>3} W  -> 1x18650 {fmt(runtime_h(w, CELL_WH)):>8}, "
              f"2x18650 {fmt(runtime_h(w, 2 * CELL_WH)):>8}")
