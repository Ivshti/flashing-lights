// Render an SVG to PNG: node tools/svg2png.mjs in.svg out.png [width]
import { Resvg } from "@resvg/resvg-js"
import fs from "node:fs"
const [, , input, output, width = "1600"] = process.argv
const resvg = new Resvg(fs.readFileSync(input), {
  fitTo: { mode: "width", value: Number(width) },
  background: "#ffffff",
})
fs.writeFileSync(output, resvg.render().asPng())
