#!/usr/bin/env node
// Render a (routed) Circuit JSON to PCB SVG + PNG previews.
//   node tools/pcbflow/render.mjs <circuit.json> <out-prefix> [widthPx] [top|bottom]
import fs from "node:fs"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Resvg } from "@resvg/resvg-js"

const [, , input, prefix, width = "2400", layer] = process.argv
const cj = JSON.parse(fs.readFileSync(input, "utf8")).map((e) => {
  // circuit-to-svg wants plain circuit-json elements
  const { _net, source, ...rest } = e
  return rest
})
const svg = convertCircuitJsonToPcbSvg(cj, layer ? { layer } : {})
fs.writeFileSync(`${prefix}.svg`, svg)
const png = new Resvg(svg, { fitTo: { mode: "width", value: Number(width) }, background: "#0b0b0b" }).render().asPng()
fs.writeFileSync(`${prefix}.png`, png)
console.log(`wrote ${prefix}.svg/.png`)
