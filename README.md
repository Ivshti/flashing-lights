# flashing-lights

A battery-powered emergency warning and flood light for authorized emergency vehicles. It uses an ESP32 to drive an RGBW LED array on a 150 × 90 mm metal-core board.

- [`docs/design-decisions.md`](docs/design-decisions.md) covers JLC fab constraints, LED choice, battery runtime, optics and open questions.
- [`tools/power_budget.py`](tools/power_budget.py) is the runtime calculator. Edit its constants and run `python3 tools/power_budget.py`.
