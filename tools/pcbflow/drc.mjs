#!/usr/bin/env node
// Geometric DRC of a Circuit JSON file (connectivity + clearance).
//   node tools/pcbflow/drc.mjs <circuit.json> [clearance=0.2]
import fs from "node:fs"
import { check } from "./check.mjs"
import { buildModel } from "./model.mjs"

const [, , file, clr = "0.2"] = process.argv
const cj = JSON.parse(fs.readFileSync(file, "utf8"))
const m = buildModel(cj)
const sTraces = new Map(cj.filter((e) => e.type === "source_trace").map((e) => [e.source_trace_id, e]))
for (const t of cj.filter((e) => e.type === "pcb_trace"))
  if (!t._net) {
    const st = sTraces.get(t.source_trace_id)
    if (st) t._net = m.keyName.get(st.subcircuit_connectivity_map_key)
  }
const r = check(cj, { clearance: Number(clr), holeClearance: 0.3 })
const errs = cj.filter((e) => /error/.test(e.type) && !/courtyard/.test(e.type))
console.log(`tscircuit errors: ${errs.length}`)
const byMsg = {}
for (const e of errs) {
  const k = `${e.type}: ${(e.message ?? "").replace(/[\d.]+mm/g, "#").slice(0, 90)}`
  byMsg[k] = (byMsg[k] ?? 0) + 1
}
for (const [k, n] of Object.entries(byMsg).slice(0, 25)) console.log(`  ${n}x ${k}`)
console.log(`DRC: ${r.unrouted.length} unconnected nets, ${r.violations.length} violations`)
for (const u of r.unrouted.slice(0, 40)) console.log("  open", u.net, JSON.stringify(u.islands).slice(0, 160))
for (const v of r.violations.slice(0, 60)) console.log("  ", v.type, v.d ?? "", v.a, v.b ?? "", JSON.stringify(v.nets ?? ""), `(${v.at.x.toFixed(2)},${v.at.y.toFixed(2)})`)
fs.writeFileSync(file.replace(/\.json$/, ".drc.json"), JSON.stringify(r, null, 2))
process.exitCode = r.unrouted.length || r.violations.length ? 1 : 0
