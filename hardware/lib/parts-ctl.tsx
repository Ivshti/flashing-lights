// Footprints / pin maps used on the control board.
export { FP_Texas_RGE0024H_VQFN_24_1EP_4x4mm_P0_5mm_EP2_7x2_7mm as FP_QFN24 } from "./kicad-footprints"

/** SMD fuse, 2410 (6.1 x 2.69 mm) body: Littelfuse 0451/0453 NANO2. Land
 *  pattern from KiCad Fuse_Littelfuse-NANO2-451_453 (1.96 x 3.15 at +-2.455). */
export const FP_FUSE_2410 = (
  <footprint>
    <smtpad portHints={["1"]} pcbX="-2.455mm" pcbY="0mm" width="1.96mm" height="3.15mm" shape="rect" layer="top" />
    <smtpad portHints={["2"]} pcbX="2.455mm" pcbY="0mm" width="1.96mm" height="3.15mm" shape="rect" layer="top" />
    <silkscreenpath route={[{ x: -1.3, y: 1.6 }, { x: 1.3, y: 1.6 }]} strokeWidth={0.12} />
    <silkscreenpath route={[{ x: -1.3, y: -1.6 }, { x: 1.3, y: -1.6 }]} strokeWidth={0.12} />
  </footprint>
)

/** Plated through-hole pad for a board-to-board wire (or test point). */
export const fpWire = (drill: number, pad: number, label: string, labelDy = pad / 2 + 0.7) => (
  <footprint>
    <platedhole portHints={["1"]} pcbX="0mm" pcbY="0mm" shape="circle" holeDiameter={`${drill}mm`} outerDiameter={`${pad}mm`} />
    <silkscreentext text={label} pcbX={0} pcbY={labelDy} fontSize={0.7} anchorAlignment="center" />
  </footprint>
)

/** Bare SMD test pad. */
export const fpTestPad = (label: string, layer: "top" | "bottom" = "bottom") => (
  <footprint>
    <smtpad portHints={["1"]} pcbX="0mm" pcbY="0mm" radius="0.75mm" shape="circle" layer={layer} />
    <silkscreentext text={label} pcbX={0} pcbY={1.5} fontSize={0.7} anchorAlignment="center" layer={layer} />
  </footprint>
)

export const BQ25887_PINS = {
  pin1: "PG",
  pin2: "STAT",
  pin3: "CD",
  pin4: "SDA",
  pin5: "SCL",
  pin6: "INT",
  pin7: "TS",
  pin8: "ILIM",
  pin9: "MID",
  pin10: "CBSET",
  pin11: "REGN",
  pin12: "BTST",
  pin13: "BAT1",
  pin14: "BAT2",
  pin15: "SNS1",
  pin16: "SNS2",
  pin17: "SW1",
  pin18: "SW2",
  pin19: "GND1",
  pin20: "GND2",
  pin21: "PMID1",
  pin22: "PMID2",
  pin23: "VBUS",
  pin24: "PSEL",
  pin25: "EP",
}

export const TPS61089_PINS = {
  pin1: "FSW",
  pin2: "VCC",
  pin3: "FB",
  pin4: "COMP",
  pin5: "GND",
  pin6: "VOUT",
  pin7: "EN",
  pin8: "ILIM",
  pin9: "VIN",
  pin10: "BOOT",
  pin11: "SW",
}

export const AP63203_PINS = { pin1: "FB", pin2: "EN", pin3: "IN", pin4: "GND", pin5: "SW", pin6: "BST" }
export const USBLC6_PINS = { pin1: "IO1A", pin2: "GND", pin3: "IO2A", pin4: "IO2B", pin5: "VBUS", pin6: "IO1B" }
export const SO8_PFET_PINS = { pin1: "S1", pin2: "S2", pin3: "S3", pin4: "G", pin5: "D1", pin6: "D2", pin7: "D3", pin8: "D4" }

/** ESP32-S3-WROOM-1 module pins (module pin number -> label) */
export const ESP32S3_PINS = {
  pin1: "GND1",
  pin2: "V3V3",
  pin3: "EN",
  pin4: "IO4",
  pin5: "IO5",
  pin6: "IO6",
  pin7: "IO7",
  pin8: "IO15",
  pin9: "IO16",
  pin10: "IO17",
  pin11: "IO18",
  pin12: "IO8",
  pin13: "IO19",
  pin14: "IO20",
  pin15: "IO3",
  pin16: "IO46",
  pin17: "IO9",
  pin18: "IO10",
  pin19: "IO11",
  pin20: "IO12",
  pin21: "IO13",
  pin22: "IO14",
  pin23: "IO21",
  pin24: "IO47",
  pin25: "IO48",
  pin26: "IO45",
  pin27: "IO0",
  pin28: "IO35",
  pin29: "IO36",
  pin30: "IO37",
  pin31: "IO38",
  pin32: "IO39",
  pin33: "IO40",
  pin34: "IO41",
  pin35: "IO42",
  pin36: "RXD0",
  pin37: "TXD0",
  pin38: "IO2",
  pin39: "IO1",
  pin40: "GND2",
  pin41: "GND3",
}

export const USBC_PINS = {
  A1: "GND_A1",
  A12: "GND_A12",
  B1: "GND_B1",
  B12: "GND_B12",
  A4: "VBUS_A4",
  A9: "VBUS_A9",
  B4: "VBUS_B4",
  B9: "VBUS_B9",
  A5: "CC1",
  B5: "CC2",
  A6: "DP_A",
  B6: "DP_B",
  A7: "DN_A",
  B7: "DN_B",
  A8: "SBU1",
  B8: "SBU2",
  SH: "SHIELD",
}
