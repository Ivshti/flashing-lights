#!/usr/bin/env node
// Fabrication outputs for JLCPCB from (routed) Circuit JSON.
//
//   node tools/pcbflow/fab.mjs <circuit.json> <bom-config.mjs> <out-dir>
//
// Writes Gerbers with Protel extensions (GTL/GBL/GTS/...), Excellon drills,
// a JLC-style BOM (Comment, Designator, Footprint, LCSC Part #) and CPL
// (Designator, Mid X, Mid Y, Layer, Rotation), then zips the Gerbers.
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { convertCircuitJsonToGerberFiles } from "circuit-json-to-gerber"

const [, , input, bomCfgPath, outDir] = process.argv
const cj = JSON.parse(fs.readFileSync(input, "utf8")).map(({ _net, source, ...e }) => e)
const bomCfg = (await import(pathToFileURL(path.resolve(bomCfgPath)))).default
const board = cj.find((e) => e.type === "pcb_board")
const layers = board.num_layers ?? 2
fs.mkdirSync(outDir, { recursive: true })
const gdir = path.join(outDir, "gerber")
fs.rmSync(gdir, { recursive: true, force: true })
fs.mkdirSync(gdir, { recursive: true })

const EXT = {
  "F_Cu.gbr": "GTL",
  "B_Cu.gbr": "GBL",
  "In1_Cu.gbr": "G1",
  "In2_Cu.gbr": "G2",
  "F_Mask.gbr": "GTS",
  "B_Mask.gbr": "GBS",
  "F_SilkScreen.gbr": "GTO",
  "B_SilkScreen.gbr": "GBO",
  "F_Paste.gbr": "GTP",
  "B_Paste.gbr": "GBP",
  "Edge_Cuts.gbr": "GKO",
}
const files = convertCircuitJsonToGerberFiles(cj)
const name = bomCfg.name
const written = []
for (let [f, content] of Object.entries(files)) {
  let out
  if (/_Fab\.gbr$/.test(f)) continue // fab-drawing layers: not needed by JLC, confuse layer guessers
  if (EXT[f]) {
    if (layers === 1 && f.startsWith("B_")) continue // single-sided MCPCB
    out = `${name}.${EXT[f]}`
  } else if (/npth/i.test(f)) out = `${name}-NPTH.DRL`
  else if (/\.drl$/i.test(f)) out = `${name}-PTH.DRL`
  else out = `${name}-${f}`
  // Excellon slots: CAM tools (and gerbonara) want "X..Y..G85X..Y.." on one line
  if (out.endsWith(".DRL")) content = content.replace(/^(X[-\d.]+Y[-\d.]+)\r?\n(G85X)/gm, "$1$2")
  fs.writeFileSync(path.join(gdir, out), content)
  written.push(out)
}
const zip = path.join(outDir, `${name}-gerbers.zip`)
fs.rmSync(zip, { force: true })
execFileSync("python3", ["-c", `import zipfile,os,sys
d=sys.argv[1]; z=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED)
[z.write(os.path.join(d,f),f) for f in sorted(os.listdir(d))]`, gdir, zip])

// ---------------------------------------------------------------- BOM + CPL
const sComp = new Map(cj.filter((e) => e.type === "source_component").map((e) => [e.source_component_id, e]))
const rows = []
for (const pc of cj.filter((e) => e.type === "pcb_component")) {
  const sc = sComp.get(pc.source_component_id)
  if (!sc || pc.do_not_place) continue
  const rule = bomCfg.parts.find((p) => p.match.test(sc.name))
  if (!rule) throw new Error(`no BOM rule for ${sc.name}`)
  if (rule.dnp) continue
  rows.push({ ref: sc.name, pc, rule })
}
const groups = new Map()
for (const r of rows) {
  const k = `${r.rule.comment}|${r.rule.footprint}|${r.rule.lcsc ?? ""}`
  if (!groups.has(k)) groups.set(k, { rule: r.rule, refs: [] })
  groups.get(k).refs.push(r.ref)
}
const csv = (cells) => cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
const bom = [csv(["Comment", "Designator", "Footprint", "LCSC Part #", "Manufacturer Part", "Qty", "Note"])]
for (const { rule, refs } of groups.values())
  bom.push(csv([rule.comment, refs.join(","), rule.footprint, rule.lcsc ?? "", rule.mpn ?? "", refs.length, rule.note ?? ""]))
fs.writeFileSync(path.join(outDir, `${name}-BOM.csv`), bom.join("\n") + "\n")

const cpl = [csv(["Designator", "Mid X", "Mid Y", "Layer", "Rotation"])]
for (const { ref, pc, rule } of rows) {
  const rot = ((pc.rotation ?? 0) + (rule.rotOffset ?? 0) + 360) % 360
  cpl.push(csv([ref, `${pc.center.x.toFixed(3)}mm`, `${pc.center.y.toFixed(3)}mm`, pc.layer === "bottom" ? "Bottom" : "Top", rot]))
}
fs.writeFileSync(path.join(outDir, `${name}-CPL.csv`), cpl.join("\n") + "\n")
console.log(`fab: ${written.length} gerber/drill files -> ${zip}; BOM ${groups.size} lines / ${rows.length} parts`)
