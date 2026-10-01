// Control board: 150 x 90 mm, 4-layer FR4, sits 10-12 mm behind the LED board.
//
//   top    (faces the aluminium LED board): power electronics, USB-C, wire pads
//   In1    solid GND plane
//   In2    routing
//   bottom (faces the user): 2x 18650 holders, ESP32-S3 module, 4 buttons,
//          status LEDs, test pads
//
// Power path:
//   2S pack -> F1 -> Q1 (P-FET soft latch) -> VSYS -> LED R/A strings (VBAT wire)
//                                               -> TPS61089 boost -> VBOOST (G/B strings)
//                                               -> AP63203 buck  -> 3V3
//   USB-C 5V -> BQ25887 2S boost charger with cell balancing -> pack
//           \-> D3 -> VSYS (runs the electronics with the latch off / empty pack)
//
// Component values that come from datasheets I could not open while designing
// this are marked VERIFY in docs/control-board.md.

import { fpTestPad, fpWire, FP_FUSE_2410, FP_QFN24, BQ25887_PINS, TPS61089_PINS, AP63203_PINS, USBLC6_PINS, SO8_PFET_PINS, ESP32S3_PINS } from "./lib/parts-ctl"
import {
  FP_BatteryHolder_MPD_BH_18650_PC,
  FP_ESP32_S3_WROOM_1,
  FP_L_7_3x7_3_H4_5,
  FP_L_Sunlord_MWSA0412S,
  FP_SOIC_8_3_9x4_9mm_P1_27mm,
  FP_SOT_23,
  FP_SOT_23_6,
  FP_SW_PUSH_6mm_H13mm,
  FP_TSOT_23_6,
  FP_Texas_VQFN_RNR0011A_11,
  FP_USB_C_Receptacle_HRO_TYPE_C_31_M_12,
} from "./lib/kicad-footprints"
import { BOARD, MOUNT_HOLES } from "./lib/stack"

type Side = "top" | "bottom"
const parts: any[] = []
const conns: [string, string][] = []
const net = (n: string) => `net.${n}`
const pos = (x: number, y: number, rot = 0, layer: Side = "top") => ({ pcbX: x, pcbY: y, pcbRotation: rot, layer })

/** two-terminal passive: pin1 -> a, pin2 -> b */
function R(name: string, value: string, fp: string, x: number, y: number, rot: number, a: string, b: string, layer: Side = "top", mpn?: string) {
  parts.push(<resistor key={name} name={name} resistance={value} footprint={fp} {...pos(x, y, rot, layer)} {...(mpn ? { manufacturerPartNumber: mpn } : {})} />)
  conns.push([`.${name} > .pin1`, net(a)], [`.${name} > .pin2`, net(b)])
}
function C(name: string, value: string, fp: string, x: number, y: number, rot: number, a: string, b: string, layer: Side = "top") {
  parts.push(<capacitor key={name} name={name} capacitance={value} footprint={fp} {...pos(x, y, rot, layer)} />)
  conns.push([`.${name} > .pin1`, net(a)], [`.${name} > .pin2`, net(b)])
}
function L(name: string, value: string, fp: any, x: number, y: number, rot: number, a: string, b: string, mpn: string) {
  parts.push(<chip key={name} name={name} footprint={fp} {...pos(x, y, rot)} pinLabels={{ pin1: "A", pin2: "B" }} manufacturerPartNumber={mpn} />)
  conns.push([`.${name} > .A`, net(a)], [`.${name} > .B`, net(b)])
}
/** chip with a pin map; `wires` maps pin label -> net */
function U(name: string, fp: any, pins: Record<string, string>, x: number, y: number, rot: number, wires: Record<string, string>, mpn: string, layer: Side = "top") {
  parts.push(<chip key={name} name={name} footprint={fp} pinLabels={pins} {...pos(x, y, rot, layer)} manufacturerPartNumber={mpn} />)
  for (const [pin, n] of Object.entries(wires)) conns.push([`.${name} > .${pin}`, net(n)])
}
function D(name: string, fp: string, x: number, y: number, rot: number, anode: string, cathode: string, mpn: string, layer: Side = "top") {
  parts.push(<diode key={name} name={name} footprint={fp} {...pos(x, y, rot, layer)} manufacturerPartNumber={mpn} />)
  conns.push([`.${name} > .anode`, net(anode)], [`.${name} > .cathode`, net(cathode)])
}
function LED(name: string, color: string, x: number, y: number, anode: string, cathode: string) {
  parts.push(<led key={name} name={name} color={color} footprint="0603" {...pos(x, y, 0, "bottom")} />)
  conns.push([`.${name} > .anode`, net(anode)], [`.${name} > .cathode`, net(cathode)])
}
function W(name: string, x: number, y: number, n: string, drill: number, pad: number, label: string) {
  parts.push(<chip key={name} name={name} footprint={fpWire(drill, pad, label)} {...pos(x, y)} pinLabels={{ pin1: "W" }} doNotPlace />)
  conns.push([`.${name} > .W`, net(n)])
}
function TP(name: string, x: number, y: number, n: string, label: string) {
  parts.push(<chip key={name} name={name} footprint={fpTestPad(label)} {...pos(x, y, 0, "bottom")} pinLabels={{ pin1: "T" }} doNotPlace />)
  conns.push([`.${name} > .T`, net(n)])
}

// ---------------------------------------------------------------- battery
// BT1 (left) is the bottom cell, BT2 (right) the top cell of the 2S stack.
// Holder pin 1 is "+". MID links the two holders along the bottom edge.
parts.push(
  <chip key="BT1" name="BT1" footprint={FP_BatteryHolder_MPD_BH_18650_PC} pinLabels={{ pin1: "P", pin2: "N" }} {...pos(-17, -36.45, 270, "bottom")} manufacturerPartNumber="MPD BH-18650-PC" />,
  <chip key="BT2" name="BT2" footprint={FP_BatteryHolder_MPD_BH_18650_PC} pinLabels={{ pin1: "P", pin2: "N" }} {...pos(17, 36.45, 90, "bottom")} manufacturerPartNumber="MPD BH-18650-PC" />,
)
conns.push([".BT1 > .N", net("GND")], [".BT1 > .P", net("MID")], [".BT2 > .N", net("MID")], [".BT2 > .P", net("PACKP")])
R("TH1", "10k", "0603", -17, 0, 0, "TS", "GND", "top", "NCP18XH103F03RB (NTC 10k B3380, battery temp)")
// the pack-current MID link is hand-routed wide in control-board.route.mjs

// ---------------------------------------------------------------- fuse + soft latch
parts.push(<chip key="F1" name="F1" footprint={FP_FUSE_2410} pinLabels={{ pin1: "A", pin2: "B" }} {...pos(10, 41.5, 0)} manufacturerPartNumber="Littelfuse 0451007.MRL (7 A, 2410) - VERIFY land" />)
conns.push([".F1 > .A", net("PACKP")], [".F1 > .B", net("VBATF")])
// Q1 P-FET: S = fused pack, D = VSYS. Off: gate pulled to source by R1.
U("Q1", FP_SOIC_8_3_9x4_9mm_P1_27mm, SO8_PFET_PINS, 10, 35, 0, { S1: "VBATF", S2: "VBATF", S3: "VBATF", G: "LATCH_G", D1: "VSYS", D2: "VSYS", D3: "VSYS", D4: "VSYS" }, "AO4407A")
R("R1", "100k", "0402", 10, 38.5, 0, "VBATF", "LATCH_G")
// Q2 holds Q1 on once the ESP32 has booted (PWR_HOLD high)
U("Q2", FP_SOT_23, { pin1: "G", pin2: "S", pin3: "D" }, 24, 32, 0, { G: "PWR_HOLD", S: "GND", D: "LATCH_D" }, "AO3400A")
R("R2", "1k", "0402", 24, 35.5, 90, "LATCH_D", "LATCH_G")
R("R3", "100k", "0402", 27, 32, 90, "PWR_HOLD", "GND")
// power button: pulls the gate low through D1; ESP32 senses it through D2
D("D1", "sod323", 24, 28.5, 0, "LATCH_G", "BTN1_N", "BAT54WS (Schottky, SOD-323)")
D("D2", "sod323", 24, 25.5, 180, "BTN1_SNS", "BTN1_N", "BAT54WS (Schottky, SOD-323)")
// USB 5 V also runs the electronics when the latch is off or the pack is flat
D("D3", "sma", -46, 5, 0, "VBUS", "VSYS", "SS34 (3 A Schottky, SMA)")

// ---------------------------------------------------------------- USB-C + ESD
U("J1", FP_USB_C_Receptacle_HRO_TYPE_C_31_M_12, {}, -71, -5, 270, {}, "HRO TYPE-C-31-M-12")
for (const p of ["A1", "A12", "B1", "B12", "SH"]) conns.push([`.J1 > .${p}`, net("GND")])
for (const p of ["A4", "A9", "B4", "B9"]) conns.push([`.J1 > .${p}`, net("VBUS")])
conns.push([".J1 > .A5", net("CC1")], [".J1 > .B5", net("CC2")], [".J1 > .A6", net("USB_DP")], [".J1 > .B6", net("USB_DP")], [".J1 > .A7", net("USB_DN")], [".J1 > .B7", net("USB_DN")])
R("R4", "5.1k", "0402", -64, -10.5, 90, "CC1", "GND")
R("R5", "5.1k", "0402", -64, 0.5, 90, "CC2", "GND")
R("R6", "10k", "0402", -61.5, -10.5, 90, "CC1", "CC1_ADC")
R("R7", "10k", "0402", -61.5, 0.5, 90, "CC2", "CC2_ADC")
U("U6", FP_SOT_23_6, USBLC6_PINS, -61, -5, 0, { IO1A: "USB_DP", IO1B: "USB_DP", IO2A: "USB_DN", IO2B: "USB_DN", VBUS: "VBUS", GND: "GND" }, "USBLC6-2SC6")

// ---------------------------------------------------------------- BQ25887 2S charger (VERIFY values)
U("U2", FP_QFN24, BQ25887_PINS, -52, 20, 0, {
  VBUS: "VBUS", PMID1: "PMID", PMID2: "PMID", SW1: "CHG_SW", SW2: "CHG_SW", BTST: "CHG_BTST",
  REGN: "REGN", BAT1: "VBATF", BAT2: "VBATF", SNS1: "CHG_SNS", SNS2: "CHG_SNS",
  GND1: "GND", GND2: "GND", EP: "GND", MID: "MID", CBSET: "CBSET", TS: "TS", ILIM: "ILIM",
  PSEL: "PSEL", CD: "CHG_CD", SDA: "SDA", SCL: "SCL", INT: "CHG_INT", PG: "CHG_PG", STAT: "CHG_STAT",
}, "BQ25887RGER")
C("C1", "1uF", "0603", -53, 25, 90, "VBUS", "GND")
C("C2", "10uF", "0805", -56, 24.5, 0, "PMID", "GND")
C("C3", "10uF", "0805", -56, 27, 0, "PMID", "GND")
L("L1", "1uH", FP_L_Sunlord_MWSA0412S, -49, 30, 0, "PMID", "CHG_SW", "1 uH, Isat >= 4 A, 4x4 mm (e.g. Sunlord MWSA0412S-1R0MT)")
C("C4", "47nF", "0402", -47.5, 17, 90, "CHG_BTST", "CHG_SW")
C("C5", "4.7uF", "0603", -55.5, 13.5, 0, "REGN", "GND")
C("C6", "10uF", "0805", -46, 20, 90, "CHG_SNS", "GND")
C("C7", "10uF", "0805", -43.5, 20, 90, "CHG_SNS", "GND")
C("C8", "1uF", "0603", -46, 15, 90, "VBATF", "GND")
R("R8", "47", "2512", -42, 11, 90, "CBSET", "MID", "top", "47R 2512 1W (balancing current limit)")
R("R9", "200", "0402", -50, 15, 90, "ILIM", "GND")
R("R10", "10k", "0402", -53, 15, 90, "REGN", "PSEL")
R("R11", "100k", "0402", -48.5, 15, 90, "CHG_CD", "GND")
R("R12", "5.23k", "0402", -58.5, 20, 90, "REGN", "TS")
R("R13", "30.1k", "0402", -58.5, 23, 90, "TS", "GND")
R("R14", "2.2k", "0402", -40, 27, 0, "REGN", "LED_CHG_A", "bottom")
LED("D4", "red", -40, 30, "LED_CHG_A", "CHG_STAT")

// ---------------------------------------------------------------- TPS61089 boost -> VBOOST (VERIFY values)
// RNR pinout: FSW/VCC/FB/COMP on the left, GND+VOUT at the bottom, SW top
// centre, EN/ILIM/VIN/BOOT on the right. Inductor above, output caps below.
U("U3", FP_Texas_VQFN_RNR0011A_11, TPS61089_PINS, 46, -3, 0, {
  VIN: "VSYS", SW: "BST_SW", BOOT: "BST_BOOT", VOUT: "VBOOST", FB: "BST_FB", COMP: "BST_COMP",
  VCC: "BST_VCC", FSW: "BST_FSW", ILIM: "BST_ILIM", EN: "BOOST_EN", GND: "GND",
}, "TPS61089RNRR")
L("L2", "3.3uH", FP_L_7_3x7_3_H4_5, 46, 5, 0, "VSYS", "BST_SW", "3.3 uH, Isat >= 8 A, 7x7 mm (e.g. Sunlord MWSA0603S-3R3MT)")
C("C10", "22uF", "1206", 38.5, 7, 0, "VSYS", "GND")
C("C11", "22uF", "1206", 38.5, 4, 0, "VSYS", "GND")
C("C12", "100nF", "0402", 49.8, -1.8, 90, "VSYS", "GND")
C("C13", "22uF", "1206", 42.5, -9, 90, "VBOOST", "GND")
C("C14", "22uF", "1206", 45.5, -9, 90, "VBOOST", "GND")
C("C15", "22uF", "1206", 48.5, -9, 90, "VBOOST", "GND")
C("C16", "100nF", "0402", 49.5, 0.6, 0, "BST_BOOT", "BST_SW")
C("C17", "2.2uF", "0603", 42, -1.6, 90, "BST_VCC", "GND")
R("R15", "301k", "0402", 43.4, 0.6, 0, "BST_FSW", "BST_SW")
R("R16", "150k", "0402", 51.3, -3.6, 90, "BST_ILIM", "GND")
R("R17", "15k", "0402", 40.2, -4.4, 90, "BST_COMP", "BST_RC")
C("C18", "4.7nF", "0402", 40.2, -7.2, 90, "BST_RC", "GND")
C("C19", "22pF", "0402", 38.6, -4.4, 90, "BST_COMP", "GND")
R("R18", "76.8k", "0402", 52.5, -7, 90, "VBOOST", "BST_FB")
R("R19", "10k", "0402", 42.4, -4.6, 90, "BST_FB", "GND")
R("R20", "100k", "0402", 36.5, -8, 90, "BST_TRIM_F", "BST_FB")
R("R21", "10k", "0402", 34.8, -8, 90, "BOOST_TRIM", "BST_TRIM_F")
C("C20", "1uF", "0402", 36.5, -11, 90, "BST_TRIM_F", "GND")
R("R22", "100k", "0402", 51.3, -6.6, 90, "BOOST_EN", "GND")

// ---------------------------------------------------------------- 3V3 buck
U("U4", FP_TSOT_23_6, AP63203_PINS, 45, -24, 0, { IN: "VSYS", EN: "VSYS", GND: "GND", SW: "BUCK_SW", BST: "BUCK_BST", FB: "V3V3" }, "AP63203WU-7")
L("L3", "4.7uH", FP_L_Sunlord_MWSA0412S, 51.5, -24, 0, "BUCK_SW", "V3V3", "4.7 uH, Isat >= 2.5 A, 4x4 mm")
C("C21", "10uF", "0805", 41, -24, 90, "VSYS", "GND")
C("C22", "100nF", "0402", 45, -20.5, 0, "BUCK_BST", "BUCK_SW")
C("C23", "22uF", "0805", 56, -24, 90, "V3V3", "GND")
C("C24", "22uF", "0805", 58.5, -24, 90, "V3V3", "GND")

// ---------------------------------------------------------------- ESP32-S3 (bottom side, antenna at the top edge)
U("U5", FP_ESP32_S3_WROOM_1, ESP32S3_PINS, 45, 31, 0, {
  GND1: "GND", GND2: "GND", GND3: "GND", V3V3: "V3V3", EN: "ESP_EN",
  IO4: "VSYS_ADC", IO5: "VBST_ADC", IO6: "NTC_LED", IO7: "CC1_ADC", IO8: "CC2_ADC",
  IO15: "PCA_OE", IO16: "CHG_INT", IO17: "CHG_PG", IO18: "CHG_CD",
  IO19: "USB_DN", IO20: "USB_DP", IO9: "SDA", IO10: "SCL",
  IO11: "PWR_HOLD", IO12: "BOOST_EN", IO13: "BOOST_TRIM", IO14: "LED_STAT",
  IO0: "BTN2", IO38: "BTN1_SNS", IO39: "BTN3", IO40: "BTN4", TXD0: "TXD0", RXD0: "RXD0",
}, "ESP32-S3-WROOM-1-N8", "bottom")
C("C25", "10uF", "0805", 33, 38, 90, "V3V3", "GND", "bottom")
C("C26", "100nF", "0402", 33, 35, 90, "V3V3", "GND", "bottom")
R("R23", "10k", "0402", 33, 31, 90, "V3V3", "ESP_EN", "bottom")
C("C27", "1uF", "0402", 33, 28, 90, "ESP_EN", "GND", "bottom")
R("R24", "10k", "0402", 33, 24, 90, "V3V3", "BTN2", "bottom")
R("R25", "1k", "0402", 33, 14, 90, "LED_STAT", "LED_ST_A", "bottom")
LED("D5", "green", 33, 11, "LED_ST_A", "GND")

// sensing
R("R26", "100k", "0402", 30, 6, 90, "VSYS", "VSYS_ADC")
R("R27", "33k", "0402", 30, 3, 90, "VSYS_ADC", "GND")
C("C28", "100nF", "0402", 28, 3, 90, "VSYS_ADC", "GND")
R("R28", "100k", "0402", 33, 6, 90, "VBOOST", "VBST_ADC")
R("R29", "22k", "0402", 33, 3, 90, "VBST_ADC", "GND")
C("C29", "100nF", "0402", 35, 3, 90, "VBST_ADC", "GND")
R("R30", "10k", "0402", 10, 22, 90, "V3V3", "NTC_LED")
C("C30", "100nF", "0402", 12, 22, 90, "NTC_LED", "GND")
R("R31", "2.2k", "0402", 14, 22, 90, "V3V3", "SDA")
R("R32", "2.2k", "0402", 16, 22, 90, "V3V3", "SCL")
R("R33", "10k", "0402", 18, 22, 90, "V3V3", "PCA_OE")
R("R34", "10k", "0402", 20, 22, 90, "V3V3", "CHG_INT")
R("R35", "10k", "0402", 22, 22, 90, "V3V3", "CHG_PG")

// ---------------------------------------------------------------- buttons (bottom), test pads
const BTN = [
  ["SW1", "BTN1_N", 20],
  ["SW2", "BTN2", 8],
  ["SW3", "BTN3", -4],
  ["SW4", "BTN4", -16],
] as const
for (const [n, sig, y] of BTN) {
  parts.push(<chip key={n} name={n} footprint={FP_SW_PUSH_6mm_H13mm} pinLabels={{ pin1: "A", pin2: "B" }} {...pos(-31, y + 2.25, 0, "bottom")} manufacturerPartNumber="6x6 mm tactile, 13 mm actuator (THT)" />)
  conns.push([`.${n} > .A`, net(sig)], [`.${n} > .B`, net("GND")])
}
TP("TP1", 57, 12, "TXD0", "TX")
TP("TP2", 60, 12, "RXD0", "RX")
TP("TP3", 57, 9, "ESP_EN", "EN")
TP("TP4", 60, 9, "BTN2", "IO0")
TP("TP5", 57, 6, "GND", "GND")
TP("TP6", 60, 6, "V3V3", "3V3")

// ---------------------------------------------------------------- wires to the LED board
// positions mirror the wire pads on led-board.circuit.tsx
W("W1", -2.5, 33.6, "VSYS", 1.7, 3.2, "VBAT")
W("W2", 2.5, 32.2, "VBOOST", 1.6, 3.0, "VBST")
for (const [n, x, sig, label] of [
  ["W3", -4.75, "NTC_LED", "NTC"],
  ["W4", -2.85, "GND", "GND"],
  ["W5", -0.95, "V3V3", "3V3"],
  ["W6", 0.95, "SDA", "SDA"],
  ["W7", 2.85, "SCL", "SCL"],
  ["W8", 4.75, "PCA_OE", "OE"],
] as const)
  W(n, x, 18.5, sig, 0.9, 1.5, label)
W("W9", -65.4, -37.8, "GND", 1.6, 3.0, "GND0")
W("W10", -33.9, -37.8, "GND", 1.6, 3.0, "GND1")
W("W11", 33.9, -36.4, "GND", 1.6, 3.0, "GND2")
W("W12", 65.4, -36.4, "GND", 1.6, 3.0, "GND3")

// ---------------------------------------------------------------- holes
export const TRIPOD: { x: number; y: number; d: number } = { x: 0, y: -10, d: 6.6 }
const holes = [
  ...MOUNT_HOLES.map((p, i) => <hole key={`MH${i}`} name={`MH${i}`} diameter="3.2mm" pcbX={p.x} pcbY={p.y} />),
  <hole key="MH_TRIPOD" name="MH_TRIPOD" diameter={`${TRIPOD.d}mm`} pcbX={TRIPOD.x} pcbY={TRIPOD.y} />,
]

export default () => (
  <board
    width={`${BOARD.w}mm`}
    height={`${BOARD.h}mm`}
    borderRadius={`${BOARD.r}mm`}
    layers={4}
    doubleSidedAssembly
    title="Emergency RGBA light - control board (FR4 4-layer)"
    schematicDisabled
  >
    {parts}
    {holes}
    {conns.map(([a, b], i) => (
      <trace key={`c${i}`} name={`c${i}`} from={a} to={b} />
    ))}
    <silkscreentext text="FLASHING-LIGHTS CTRL v0.1" pcbX={0} pcbY={-26} fontSize={1.4} anchorAlignment="center" />
    <silkscreentext text="1/4-20" pcbX={0} pcbY={-15} fontSize={1} anchorAlignment="center" />
  </board>
)
