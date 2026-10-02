#!/usr/bin/env node
// Route a tscircuit board with Freerouting and verify the result.
//
//   node tools/pcbflow/route.mjs <board-config.mjs>
//
// The config module exports { name, circuitJson, outDir, dsn: {...},
// freerouting: { passes }, check: {...} }. Steps:
//   circuit.json -> <name>.dsn -> Freerouting -> <name>.ses
//   -> <name>.routed.json (+ svg/png preview) -> DRC report
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"
import { toDsn, sesToElements } from "./dsn.mjs"
import { check } from "./check.mjs"
import { buildModel } from "./model.mjs"
import { makePlanes, makePlaneVias, makeStubs } from "./planes.mjs"

const cfgPath = path.resolve(process.argv[2])
const cfg = (await import(pathToFileURL(cfgPath))).default
const root = path.resolve(path.dirname(cfgPath), cfg.root ?? ".")
const out = path.resolve(root, cfg.outDir)
fs.mkdirSync(out, { recursive: true })
const cj = JSON.parse(fs.readFileSync(path.resolve(root, cfg.circuitJson), "utf8"))

// net names for pre-routed traces
const m = buildModel(cj)
const sTraces = new Map(cj.filter((e) => e.type === "source_trace").map((e) => [e.source_trace_id, e]))
for (const t of cj.filter((e) => e.type === "pcb_trace")) {
  const st = sTraces.get(t.source_trace_id)
  if (st) t._net = m.keyName.get(st.subcircuit_connectivity_map_key)
}

if (cfg.stubs) cj.push(...makeStubs(cj, cfg.stubs))
for (const [i, w] of (cfg.wires ?? []).entries())
  cj.push({
    type: "pcb_trace",
    pcb_trace_id: `manual_${i}`,
    route: w.pts.map((p) => ({ route_type: "wire", x: p.x, y: p.y, width: w.width, layer: w.layer })),
    _net: w.net,
    ...(w.innerOk ? { _innerOk: true } : {}),
  })
for (const [i, v] of (cfg.vias ?? []).entries())
  cj.push({
    type: "pcb_via",
    pcb_via_id: `manual_via_${i}`,
    x: v.x,
    y: v.y,
    outer_diameter: v.d ?? cfg.dsn.via.d,
    hole_diameter: v.drill ?? cfg.dsn.via.drill,
    layers: cfg.dsn.via.layers,
    _net: v.net,
  })
for (const pv of cfg.planeVias ?? []) {
  const els = makePlaneVias(cj, pv)
  cj.push(...els)
  console.log(`plane vias (${pv.net}): ${els.filter((e) => e.type === "pcb_via").length}`)
}
// CONTINUE=<routed.json>: start from a previous Freerouting result (as
// editable copper) so a second pass only has to close the leftovers
if (process.env.CONTINUE) {
  const prev = JSON.parse(fs.readFileSync(process.env.CONTINUE, "utf8"))
  for (const e of prev)
    if ((e.type === "pcb_trace" && e.pcb_trace_id.startsWith("fr_")) || (e.type === "pcb_via" && e.pcb_via_id.startsWith("fr_")))
      cj.push({ ...e, _editable: true })
}
const { dsn, nets } = toDsn(cj, cfg.dsn)
const dsnFile = path.join(out, `${cfg.name}.dsn`)
const sesFile = path.join(out, `${cfg.name}.ses`)
fs.writeFileSync(dsnFile, dsn)
console.log(`DSN: ${nets.size} nets -> ${dsnFile}`)

if (!process.env.SKIP_ROUTE && !process.env.PRECHECK) {
  const java = process.env.JAVA ?? "/usr/lib/jvm/java-25-openjdk-amd64/bin/java"
  const jar = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../bin/freerouting.jar")
  const args = [
    "-Djava.awt.headless=true",
    "-jar",
    jar,
    "--gui.enabled=false",
    "--api_server.enabled=false",
    "-de",
    dsnFile,
    "-do",
    sesFile,
    "-mp",
    String(cfg.freerouting?.passes ?? 40),
    "-mt",
    String(cfg.freerouting?.threads ?? 4),
  ]
  const t0 = Date.now()
  try {
    const log = execFileSync(java, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: (cfg.freerouting?.timeoutS ?? 1800) * 1000 })
    fs.writeFileSync(path.join(out, `${cfg.name}.freerouting.log`), log)
  } catch (e) {
    fs.writeFileSync(path.join(out, `${cfg.name}.freerouting.log`), String(e.stdout ?? "") + String(e.stderr ?? ""))
    if (!fs.existsSync(sesFile)) throw new Error("freerouting failed, see log")
  }
  console.log(`Freerouting done in ${((Date.now() - t0) / 1000).toFixed(0)} s`)
}

// PRECHECK=1: no routing, just DRC the hand-placed copper (stubs, wires, vias)
const routed = process.env.PRECHECK
  ? cj.filter((e) => e.type === "pcb_trace" || e.type === "pcb_via")
  : sesToElements(fs.readFileSync(sesFile, "utf8"), { via: cfg.dsn.via })
// protected wires come back from Freerouting without our flags: re-tag the
// ones allowed on inner layers by their geometry
const key = (x, y) => `${Math.round(x * 100)},${Math.round(y * 100)}`
const innerOkPts = new Set((cfg.wires ?? []).filter((w) => w.innerOk).flatMap((w) => w.pts.map((p) => key(p.x, p.y))))
for (const t of routed) if (t.type === "pcb_trace" && t.route.every((p) => innerOkPts.has(key(p.x, p.y)))) t._innerOk = true
// Freerouting writes back the protected wires as well, so drop ours
const base = cj.filter((e) => e.type !== "pcb_trace" && e.type !== "pcb_via" && !/error|warning/.test(e.type))
const result = [...base, ...routed]
if (cfg.planes) result.push(...makePlanes(result, cfg.planes, { cornerRadius: cfg.dsn.cornerRadius }))
const routedFile = path.join(out, `${cfg.name}.routed.json`)
fs.writeFileSync(routedFile, JSON.stringify(result))
console.log(`routed: ${routed.filter((e) => e.type === "pcb_trace").length} wires, ${routed.filter((e) => e.type === "pcb_via").length} vias`)

const report = check(result, cfg.check)
fs.writeFileSync(path.join(out, `${cfg.name}.drc.json`), JSON.stringify(report, null, 2))
console.log(`DRC: ${report.unrouted.length} unrouted nets, ${report.violations.length} violations`)
for (const u of report.unrouted.slice(0, 30)) console.log("  unrouted", u.net, JSON.stringify(u.islands).slice(0, 200))
for (const v of report.violations.slice(0, 30)) console.log("  ", v.type, v.d ?? "", v.a, v.b ?? "", JSON.stringify(v.at))
