#!/usr/bin/env node
// List copper (pads, traces, vias) inside a window of a routed Circuit JSON:
//   node tools/pcbflow/probe.mjs <circuit.json> x1 y1 x2 y2 [layer]
import fs from "node:fs"
import { bbox } from "./geometry.mjs"
import { buildModel, traceItems } from "./model.mjs"

const [, , file, ...rest] = process.argv
const [x1, y1, x2, y2] = rest.slice(0, 4).map(Number)
const only = rest[4]
const cj = JSON.parse(fs.readFileSync(file, "utf8"))
const m = buildModel(cj)
const inWin = (s) => {
  const [a, b, c, d] = bbox(s)
  return c >= x1 && a <= x2 && d >= y1 && b <= y2
}
const f = (v) => v.toFixed(2)
const desc = (s) =>
  s.kind === "circle" ? `circle (${f(s.c.x)},${f(s.c.y)}) r${f(s.r)}` : s.kind === "seg" ? `seg (${f(s.a.x)},${f(s.a.y)})-(${f(s.b.x)},${f(s.b.y)}) w${f(2 * s.r)}` : `poly bbox ${bbox(s).map(f).join(",")}`
for (const p of m.pads)
  for (const s of p.shapes) if ((!only || s.layer === only) && inWin(s.shape) && (p.el.type === "pcb_smtpad" || s.layer === "F.Cu")) console.log(`pad   ${s.layer.padEnd(6)} ${`${p.comp}.${p.pin}`.padEnd(8)} ${String(p.net).padEnd(10)} ${desc(s.shape)}`)
for (const t of traceItems(cj)) if ((!only || t.layer === only) && inWin(t.shape) && !(t.via && t.layer !== "F.Cu")) console.log(`${t.via ? "via  " : "trace"} ${t.layer.padEnd(6)} ${String(t.trace ?? t.via).padEnd(8)} ${String(t.net).padEnd(10)} ${desc(t.shape)}`)
