import type { Placement } from "./geom"
import {
  FP_SOT_23,
  FP_SOT_23_5,
  FP_TSSOP_28_4_4x9_7mm_P0_65mm,
} from "./kicad-footprints"

// parts accept either {x, y, rot} or tscircuit-style {pcbX, pcbY, pcbRotation}
type P = Partial<Placement> & {
  name: string
  layer?: "top" | "bottom"
  pcbX?: number
  pcbY?: number
  pcbRotation?: number
}

const pos = (p: P) => ({
  pcbX: p.x ?? p.pcbX ?? 0,
  pcbY: p.y ?? p.pcbY ?? 0,
  pcbRotation: p.rot ?? p.pcbRotation ?? 0,
  ...(p.layer ? { layer: p.layer } : {}),
})

/**
 * Solder pad for an interconnect wire: a copper ring around a non-plated
 * hole. The insulated wire comes through the hole from the back and is
 * soldered on the copper side (works on single-layer aluminium boards).
 */
export const WirePad = (p: {
  name: string
  pcbX: number
  pcbY: number
  pcbRotation?: number
  d?: number
  hole?: number
  label?: string
  labelDx?: number
  labelDy?: number
  fontSize?: number
}) => (
  <chip
    name={p.name}
    pcbX={p.pcbX}
    pcbY={p.pcbY}
    pinLabels={{ pin1: "W" }}
    footprint={
      <footprint>
        <smtpad portHints={["1"]} pcbX="0mm" pcbY="0mm" radius={`${(p.d ?? 2.5) / 2}mm`} shape="circle" layer="top" />
        <hole pcbX="0mm" pcbY="0mm" diameter={`${p.hole ?? 1.2}mm`} />
        <silkscreentext
          text={p.label ?? p.name}
          pcbX={p.labelDx ?? 0}
          pcbY={p.labelDy ?? (p.d ?? 2.5) / 2 + 0.8}
          fontSize={p.fontSize ?? 0.8}
          anchorAlignment="center"
        />
      </footprint>
    }
    doNotPlace
  />
)

/** Small copper node on a hand-routed bus, used as a trace endpoint. */
export const TapPad = (p: P & { size?: number }) => (
  <chip
    name={p.name}
    {...pos(p)}
    pinLabels={{ pin1: "T" }}
    footprint={
      <footprint>
        <smtpad
          portHints={["1"]}
          pcbX="0mm"
          pcbY="0mm"
          width={`${p.size ?? 1.2}mm`}
          height={`${p.size ?? 1.2}mm`}
          shape="rect"
          layer="top"
        />
      </footprint>
    }
    doNotPlace
  />
)

/** N-channel logic-level MOSFET, SOT-23 (G=1, S=2, D=3), e.g. AO3400A. */
export const NMOS = (p: P & { mpn?: string; lcsc?: string }) => (
  <chip
    name={p.name}
    {...pos(p)}
    footprint={FP_SOT_23}
    pinLabels={{ pin1: "G", pin2: "S", pin3: "D" }}
    manufacturerPartNumber={p.mpn ?? "AO3400A"}
    supplierPartNumbers={{ jlcpcb: [p.lcsc ?? "C20917"] }}
  />
)

/** Single rail-to-rail op-amp, SOT-23-5 (TI LMV321 pinout). */
export const OpAmp1 = (p: P) => (
  <chip
    name={p.name}
    {...pos(p)}
    footprint={FP_SOT_23_5}
    pinLabels={{ pin1: "INP", pin2: "VN", pin3: "INN", pin4: "OUT", pin5: "VP" }}
    manufacturerPartNumber="LMV321IDBVR"
  />
)

/** NXP PCA9685PW 16-channel 12-bit PWM driver, TSSOP-28. */
export const PCA9685 = (p: P) => (
  <chip
    name={p.name}
    {...pos(p)}
    footprint={FP_TSSOP_28_4_4x9_7mm_P0_65mm}
    pinLabels={{
      pin1: "A0",
      pin2: "A1",
      pin3: "A2",
      pin4: "A3",
      pin5: "A4",
      pin6: "LED0",
      pin7: "LED1",
      pin8: "LED2",
      pin9: "LED3",
      pin10: "LED4",
      pin11: "LED5",
      pin12: "LED6",
      pin13: "LED7",
      pin14: "VSS",
      pin15: "LED8",
      pin16: "LED9",
      pin17: "LED10",
      pin18: "LED11",
      pin19: "LED12",
      pin20: "LED13",
      pin21: "LED14",
      pin22: "LED15",
      pin23: "OE",
      pin24: "A5",
      pin25: "EXTCLK",
      pin26: "SCL",
      pin27: "SDA",
      pin28: "VDD",
    }}
    manufacturerPartNumber="PCA9685PW,118"
  />
)
