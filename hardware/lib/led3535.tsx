// Generic 3.5 x 3.5 mm ceramic 4-in-1 (RGBA) high-power LED, 8 pads.
//
// !! VERIFY AGAINST THE DATASHEET OF THE PART YOU BUY !!
// Pinouts of "3535 RGBA 4-in-1" parts differ between makers. This footprint
// assumes: anodes on one edge (R, G, B, A left to right), each die's cathode
// directly opposite its anode, 0.85 mm pad pitch, no thermal pad. If your
// part differs, only this file (pad positions + DIE_ORDER) has to change.

export const LED_PAD_PITCH = 0.85
export const LED_ROW_Y = 1.2 // anode row at +y, cathode row at -y
export const DIE_ORDER = ["R", "G", "B", "A"] as const
export type Die = (typeof DIE_ORDER)[number]

/** x offset of a die's pads relative to the LED centre */
export const dieX = (i: number) => (i - 1.5) * LED_PAD_PITCH

const pad = (name: string, x: number, y: number) => (
  <smtpad
    portHints={[name]}
    pcbX={`${x}mm`}
    pcbY={`${y}mm`}
    width="0.5mm"
    height="0.9mm"
    shape="rect"
    layer="top"
  />
)

export const FP_LED3535_RGBA = (
  <footprint>
    {DIE_ORDER.map((d, i) => pad(`A${d}`, dieX(i), LED_ROW_Y))}
    {DIE_ORDER.map((d, i) => pad(`K${d}`, dieX(i), -LED_ROW_Y))}
    <silkscreenpath
      route={[
        { x: -1.9, y: 1.9 },
        { x: 1.9, y: 1.9 },
        { x: 1.9, y: -1.9 },
        { x: -1.9, y: -1.9 },
        { x: -1.9, y: 1.9 },
      ]}
      strokeWidth={0.12}
    />
    {/* anode-side marker */}
    <silkscreenpath
      route={[
        { x: -2.3, y: 2.3 },
        { x: -1.9, y: 2.3 },
      ]}
      strokeWidth={0.2}
    />
  </footprint>
)

export const LED_PIN_LABELS = Object.fromEntries(
  [...DIE_ORDER.map((d) => `A${d}`), ...DIE_ORDER.map((d) => `K${d}`)].map(
    (n) => [n, n],
  ),
) as Record<string, string>
