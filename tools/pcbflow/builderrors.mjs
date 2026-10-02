#!/usr/bin/env node
// Fail on tscircuit build errors except courtyard overlaps, which the LED
// board's packed driver cells have by design (copper spacing is checked by
// our own DRC instead).
//   node tools/pcbflow/builderrors.mjs <circuit.json>
import fs from "node:fs"

const cj = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))
const errs = cj.filter((e) => /error/.test(e.type))
const courtyard = errs.filter((e) => /courtyard/.test(e.type))
const real = errs.filter((e) => !/courtyard/.test(e.type))
if (courtyard.length) console.log(`build: ${courtyard.length} courtyard overlaps (allowed)`)
for (const e of real) console.log(`build error: ${e.type}: ${e.message ?? ""}`)
console.log(`build: ${real.length} errors`)
process.exitCode = real.length ? 1 : 0
