#!/usr/bin/env node
// List pad positions of components: node tools/pcbflow/pads.mjs <circuit.json> NAME...
import fs from "node:fs"
import { buildModel } from "./model.mjs"
const [, , file, ...names] = process.argv
const m = buildModel(JSON.parse(fs.readFileSync(file, "utf8")))
for (const n of names) {
  const ps = m.pads.filter((p) => p.comp === n)
  console.log(n, ps.map((p) => `${p.pin}@(${p.el.x.toFixed(2)},${p.el.y.toFixed(2)})${p.el.layer ? p.el.layer[0] : "T"}:${p.net}`).join("  "))
}
