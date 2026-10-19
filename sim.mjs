#!/usr/bin/env node
// sim.mjs — the CLI for pi-contract-simulator.
//
// Modes:
//   --surface        which RPC methods the node answers (live)
//   --failures       reproduce the measured failure shapes F1–F5 (live)
//   --identity       node version / protocol / ledger, for comparability (live)
//   --mainnet        Mainnet RPC reachability (live, and expected to fail)
//   --probe          all of the above
//   --snapshot FILE  write a comparable run snapshot to FILE
//   --compare A B    compare two snapshots, reporting node changes first
//   --verdicts       the verdict model, offline
//   --report SHAPE   render one failure shape as a developer report (offline)
//   --boundaries     what this tool refuses to claim
//   --help
//
// Read-only. No writes to the network. No keys, no signing, no submission.

import { writeFileSync, readFileSync } from "node:fs";
import { VERDICTS, FAILURE_SHAPES, RPC_SURFACE, BOUNDARIES, FORBIDDEN_CLAIMS,
  FORBIDDEN_INFERENCE, REGRESSION_REQUIREMENTS, FIXTURES, FIXTURE_NOTE, failureById } from "./lib.mjs";
import { runAllProbes, rpcCall, ENDPOINTS } from "./probe.mjs";
import { buildReport, renderReport, compareRuns, isComparable, REPORT_DISCLAIMER } from "./report.mjs";

const out = (s = "") => process.stdout.write(s + "\n");
const rule = (t) => out(`\n=== ${t} ===`);

function help() {
  out("pi-contract-simulator — simulate Pi Testnet contract calls, read-only");
  out("");
  out("  node sim.mjs --surface         which RPC methods the node answers (live)");
  out("  node sim.mjs --failures        reproduce failure shapes F1-F5 (live)");
  out("  node sim.mjs --identity        node version / protocol / ledger (live)");
  out("  node sim.mjs --mainnet         Mainnet RPC reachability (live)");
  out("  node sim.mjs --probe           all live probes");
  out("  node sim.mjs --snapshot FILE   write a comparable run snapshot");
  out("  node sim.mjs --compare A B     compare two snapshots");
  out("  node sim.mjs --verdicts        the verdict model (offline)");
  out("  node sim.mjs --report F1       render one failure shape as a report (offline)");
  out("  node sim.mjs --boundaries      what this tool refuses to claim");
  out("  node sim.mjs --help            this help");
  out("");
  out("Read-only. Simulates and reads. Never signs, submits, or broadcasts.");
}

async function surface() {
  const { probeSurface } = await import("./probe.mjs");
  const r = await probeSurface();
  rule(`RPC SURFACE — ${r.endpoint}`);
  for (const row of r.rows) {
    out(`  ${row.method.padEnd(20)} ${row.classification}${row.code != null ? ` (${row.code})` : ""}`);
    if (row.resultKeys) out(`      result keys: ${row.resultKeys.join(", ")}`);
    if (row.message) out(`      message:     ${row.message}`);
  }
  out("");
  out("  A method classified 'supported-validation-error' EXISTS — the error is about");
  out("  the arguments, not about the method. 'method-absent' (code -32601) does not exist.");
}

async function failures() {
  const { probeFailureShapes } = await import("./probe.mjs");
  const r = await probeFailureShapes();
  rule(`MEASURED FAILURE SHAPES — ${r.endpoint}`);
  for (const s of r.shapes) {
    out(`\n--- ${s.id}: ${s.trigger} ---`);
    out(`  transport: ${s.transport}`);
    out(`  verdict:   ${s.verdict}`);
    if (s.rpcError) out(`  rpc error: ${JSON.stringify(s.rpcError)}`);
    if (s.result) out(`  result:    ${JSON.stringify(s.result).slice(0, 200)}`);
  }
  out("");
  out(`  ${FORBIDDEN_INFERENCE}`);
}

async function identity() {
  const { probeIdentity } = await import("./probe.mjs");
  const id = await probeIdentity();
  rule("NODE IDENTITY — record this to make two runs comparable");
  for (const [k, v] of Object.entries(id)) out(`  ${k.padEnd(20)} ${v}`);
  rule("COMPARABILITY RULES");
  for (const r of REGRESSION_REQUIREMENTS) out(`  - ${r}`);
}

async function mainnet() {
  const { probeMainnet } = await import("./probe.mjs");
  const m = await probeMainnet();
  rule("MAINNET SOROBAN RPC — reachability");
  out(`  endpoint:  ${m.endpoint}`);
  out(`  transport: ${m.transport}`);
  out(`  status:    ${m.status ?? "n/a"}`);
  out(`  verdict:   ${m.verdict}`);
}

async function probe() {
  const p = await runAllProbes();
  rule("IDENTITY");
  for (const [k, v] of Object.entries(p.identity)) out(`  ${k.padEnd(20)} ${v}`);
  rule("RPC SURFACE");
  for (const row of p.surface.rows) out(`  ${row.method.padEnd(20)} ${row.classification}${row.code != null ? ` (${row.code})` : ""}`);
  rule("FAILURE SHAPES");
  for (const s of p.failures.shapes) out(`  ${s.id}  ${s.verdict.padEnd(22)} ${s.trigger}`);
  rule("MAINNET RPC");
  out(`  ${p.mainnet.verdict}`);
}

async function snapshot(file) {
  if (!file) { out("usage: node sim.mjs --snapshot <file>"); process.exitCode = 2; return; }
  const p = await runAllProbes();
  const snap = {
    generatedAt: new Date().toISOString(),
    endpoint: p.identity.endpoint,
    passphrase: p.identity.passphrase,
    protocolVersion: p.identity.protocolVersion,
    nodeVersion: p.identity.nodeVersion,
    latestLedger: p.identity.latestLedger,
    cases: p.failures.shapes.map((s) => ({
      key: s.id,
      trigger: s.trigger,
      verdict: s.verdict,
      // deliberately NO fee/gas numbers: they are not comparable across ledgers
    })),
    surface: p.surface.rows.map((r) => ({ method: r.method, classification: r.classification })),
    disclaimer: REPORT_DISCLAIMER,
  };
  writeFileSync(file, JSON.stringify(snap, null, 2) + "\n", "utf8");
  out(`wrote snapshot: ${file}`);
  out(`  node ${snap.nodeVersion} · protocol ${snap.protocolVersion} · ledger ${snap.latestLedger}`);
  out(`  ${snap.cases.length} cases recorded (verdicts only — no fee numbers, by design)`);
}

function compare(aFile, bFile) {
  if (!aFile || !bFile) { out("usage: node sim.mjs --compare <before> <after>"); process.exitCode = 2; return; }
  const before = JSON.parse(readFileSync(aFile, "utf8"));
  const after = JSON.parse(readFileSync(bFile, "utf8"));
  if (!isComparable(before) || !isComparable(after)) {
    out("one of the snapshots is not comparable (missing nodeVersion/protocolVersion/cases).");
    process.exitCode = 2;
    return;
  }
  const cmp = compareRuns(before, after);
  rule("REGRESSION COMPARISON");
  if (cmp.nodeChanged) {
    out(`  !! NODE VERSION CHANGED FIRST: ${cmp.beforeNode} -> ${cmp.afterNode}`);
    out("     Any verdict difference below may simply be a node upgrade. Investigate this first.");
  } else {
    out(`  node version unchanged: ${before.nodeVersion}`);
  }
  if (before.protocolVersion !== after.protocolVersion) {
    out(`  !! PROTOCOL CHANGED: ${before.protocolVersion} -> ${after.protocolVersion}`);
  }
  out("");
  for (const r of cmp.rows) {
    const mark = r.status === "changed" ? "CHANGED" : r.status === "new" ? "NEW    " : "stable ";
    out(`  ${mark} ${r.key.padEnd(4)} ${r.before ?? "-"} -> ${r.after}`);
  }
  out("");
  out(`  changes: ${cmp.changes} · unreachable-regressions: ${cmp.regressions}`);
}

function verdicts() {
  rule("VERDICT MODEL — and, for each, what it does NOT mean");
  for (const v of VERDICTS) {
    out(`\n  [${v.id}] ${v.meaning}`);
    out("    does NOT mean:");
    for (const d of v.doesNotMean) out(`      - ${d}`);
    if (v.nextStep) out(`    next: ${v.nextStep}`);
  }
  rule("NEVER INFER");
  out(`  ${FORBIDDEN_INFERENCE}`);
}

function report(id) {
  const f = failureById(id);
  if (!f) {
    out(`unknown failure shape: ${id}`);
    out(`known: ${FAILURE_SHAPES.map((x) => x.id).join(", ")}`);
    process.exitCode = 2;
    return;
  }
  rule(`${f.id} — ${f.trigger}`);
  out(`  transport:    ${f.transport}`);
  out(`  observed:     ${JSON.stringify(f.observed)}`);
  out(`  reported as:  ${f.reportedAs}`);
  out("");
  out(`  meaning:      ${f.meaning}`);
  const synthetic = buildReport({ method: f.trigger.split(" ")[0], attempt: { transport: "http-ok", json: { result: f.observed } } });
  out("");
  rule("WHAT A DEVELOPER SEES");
  out(renderReport(synthetic));
}

function boundaries() {
  rule("WHAT THIS TOOL REFUSES TO DO");
  for (const b of BOUNDARIES) out(`  - ${b}`);
  rule("PHRASES THAT MUST NOT APPEAR AS ASSERTIONS");
  for (const f of FORBIDDEN_CLAIMS) out(`  x "${f}"`);
  rule("FIXTURES");
  for (const [k, v] of Object.entries(FIXTURES)) out(`  ${k}: ${JSON.stringify(v)}`);
  out(`  ${FIXTURE_NOTE}`);
  rule("REPORT DISCLAIMER (attached to every report)");
  for (const d of REPORT_DISCLAIMER) out(`  - ${d}`);
}

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const after = (f) => { const i = args.indexOf(f); return args[i + 1]; };

if (args.length === 0 || has("--help") || has("-h")) help();
else if (has("--surface")) await surface();
else if (has("--failures")) await failures();
else if (has("--identity")) await identity();
else if (has("--mainnet")) await mainnet();
else if (has("--probe")) await probe();
else if (has("--snapshot")) await snapshot(after("--snapshot"));
else if (has("--compare")) compare(after("--compare"), args[args.indexOf("--compare") + 2]);
else if (has("--verdicts")) verdicts();
else if (has("--report")) report(after("--report"));
else if (has("--boundaries")) boundaries();
else {
  out(`unknown option: ${args.join(" ")}`);
  out("try: node sim.mjs --help");
  process.exitCode = 2;
}

export { rpcCall, ENDPOINTS };
