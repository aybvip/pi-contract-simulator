// test/sim.test.mjs — offline invariants for pi-contract-simulator.
// No network. No personal data. No writes.
import {
  CLAIM_KINDS, FORBIDDEN_CLAIMS, RPC_SURFACE, isSupported, FAILURE_SHAPES, failureById,
  VERDICTS, verdictById, FORBIDDEN_INFERENCE, REGRESSION_REQUIREMENTS, BOUNDARIES,
  FORBIDDEN_OPERATIONS, FIXTURES, FIXTURE_NOTE,
  CLAIM_SCOPES, CLAIM_VERIFICATION, BLOCKING_VERIFICATION, ANALYSIS_REQUIREMENTS, ANALYSIS_NOT_CLAIMED,
} from "../lib.mjs";
import { classify, buildReport, renderReport, compareRuns, isComparable, REPORT_DISCLAIMER } from "../report.mjs";
import { classifySupport, SURFACE_PROBES } from "../probe.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label) { if (cond) { pass++; return; } fail++; failures.push(label); }
function eq(a, b, label) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A === B) { pass++; return; }
  fail++; failures.push(`${label}\n    expected: ${B}\n    actual:   ${A}`);
}

// --- claim discipline --------------------------------------------------------
eq(CLAIM_KINDS.map((c) => c.id), ["measured", "documented", "external", "not-claimed"],
  "exactly four claim kinds");
ok(FORBIDDEN_CLAIMS.some((f) => /mainnet/i.test(f)), "forbids claiming Mainnet support");
ok(FORBIDDEN_CLAIMS.some((f) => /proves.*correct|correctness/i.test(f)), "forbids claiming logic correctness");
ok(FORBIDDEN_CLAIMS.some((f) => /Pi approved/i.test(f)), "forbids claiming Pi approval");

// --- the RPC surface is measured, and the absent method is marked ------------
ok(RPC_SURFACE.protocolVersion > 0, "records a protocol version");
ok(RPC_SURFACE.nodeVersion, "records a node version");
ok(isSupported("simulateTransaction"), "simulateTransaction is measured as supported");
ok(isSupported("getLedgerEntries"), "getLedgerEntries is measured as supported");
ok(!isSupported("getContractData"), "getContractData is measured as ABSENT");
const gc = RPC_SURFACE.methods.find((m) => m.name === "getContractData");
ok(/getLedgerEntries/.test(gc.note), "the absent method points at the supported replacement");
eq(isSupported("nope"), false, "an unknown method is not supported");

// --- claims are ENDPOINT- and VERSION-scoped, never "always true" -----------
ok(RPC_SURFACE.scope && /endpoint/i.test(RPC_SURFACE.scope), "the surface states its scope");
ok(RPC_SURFACE.measuredAt, "the surface records when it was measured");
ok(RPC_SURFACE.measuredAtMeaning && /not a guarantee|re-run/i.test(RPC_SURFACE.measuredAtMeaning),
  "the measuredAt date is explicitly not presented as evidence");
eq(CLAIM_SCOPES.map((s) => s.id), ["endpoint-scoped", "version-scoped", "protocol-scoped"],
  "exactly three claim scopes, none named 'always'");
ok(!CLAIM_SCOPES.some((s) => /always|universal/i.test(s.id)), "there is no 'always true' claim scope");
eq(Object.keys(CLAIM_VERIFICATION).sort(), ["current", "stale", "superseded", "unreachable"].sort(),
  "four verification verdicts");
eq(BLOCKING_VERIFICATION.sort(), ["stale", "superseded", "unreachable"].sort(),
  "stale, superseded and unreachable all block publishing");
ok(!BLOCKING_VERIFICATION.includes("current"), "'current' does not block publishing");

// --- the analysis layer is recorded as NOT derivable from this RPC ----------
ok(ANALYSIS_REQUIREMENTS.available.length > 0, "the analysis page lists what IS available");
ok(ANALYSIS_REQUIREMENTS.unavailable.length > 0, "the analysis page lists what is NOT available");
ok(ANALYSIS_REQUIREMENTS.unavailable.some((u) => /WASM/i.test(u.need)),
  "fetching contract WASM is recorded as unavailable");
ok(ANALYSIS_REQUIREMENTS.unavailable.some((u) => /enumerate/i.test(u.need)),
  "enumerating storage is recorded as unavailable");
ok(/cannot be derived from this RPC alone/i.test(ANALYSIS_REQUIREMENTS.conclusion),
  "the conclusion is explicitly that a logic layer cannot come from this RPC alone");
ok(/does not analyse contract logic/i.test(ANALYSIS_NOT_CLAIMED),
  "the analysis limit is stated as a non-claim");

// --- failure shapes are complete and each is anchored ------------------------
ok(FAILURE_SHAPES.length >= 5, "at least five measured failure shapes");
for (const f of FAILURE_SHAPES) {
  ok(/^F[0-9]+$/.test(f.id), `failure id looks like F<n>: ${f.id}`);
  ok(f.trigger && f.transport && f.meaning && f.reportedAs, `${f.id} has trigger/transport/meaning/reportedAs`);
  ok(f.observed && typeof f.observed === "object", `${f.id} records what was observed`);
}
eq(failureById("F1").observed.error, "Could not unmarshal transaction", "F1 records the exact observed error");
eq(failureById("nope"), null, "unknown failure id resolves to null");
ok(FAILURE_SHAPES.some((f) => f.id === "F2" && /empty set/i.test(f.meaning)),
  "F2 records that an absent key is an empty set, not a failure");

// --- verdicts each state what they do NOT mean ------------------------------
ok(VERDICTS.length >= 5, "at least five verdicts");
for (const v of VERDICTS) {
  ok(v.id && v.meaning, `verdict ${v.id} is described`);
  ok(Array.isArray(v.doesNotMean) && v.doesNotMean.length > 0, `verdict ${v.id} lists what it does NOT mean`);
}
const okV = verdictById("simulated-ok");
ok(okV.doesNotMean.some((d) => /succeed on-chain/i.test(d)),
  "simulated-ok explicitly does NOT mean on-chain success");
ok(VERDICTS.some((v) => v.id === "unreachable"), "there is an 'unreachable' verdict distinct from a contract failure");
ok(FORBIDDEN_INFERENCE.includes("MUST NOT"), "the forbidden inference is stated normatively");

// --- regression requirements ------------------------------------------------
ok(REGRESSION_REQUIREMENTS.some((r) => /node version/i.test(r)), "regression requires node version");
ok(REGRESSION_REQUIREMENTS.some((r) => /version.*FIRST|FIRST.*version/i.test(r)),
  "a node-version change is reported FIRST");
ok(REGRESSION_REQUIREMENTS.some((r) => /never.*gas|gas.*never/i.test(r) || /never fee/i.test(r)),
  "gas/fee numbers are not compared across ledgers");

// --- boundaries and forbidden operations ------------------------------------
ok(BOUNDARIES.length >= 5, "at least five boundaries");
ok(BOUNDARIES.some((b) => /read-only|sign|submit/i.test(b)), "boundary: nothing is signed or submitted");
ok(BOUNDARIES.some((b) => /Mainnet/i.test(b)), "boundary: Mainnet is out of scope, with the reason");
ok(FORBIDDEN_OPERATIONS.includes("submitTransaction"), "submitting is forbidden");
ok(FORBIDDEN_OPERATIONS.includes("signTransaction"), "signing is forbidden");

// --- no source file contains a forbidden operation --------------------------
const libSrc = readFileSync(join(root, "lib.mjs"), "utf8");
const probeSrc = readFileSync(join(root, "probe.mjs"), "utf8");
const simSrc = readFileSync(join(root, "sim.mjs"), "utf8");
const reportSrc = readFileSync(join(root, "report.mjs"), "utf8");
const sources = { "lib.mjs": libSrc, "probe.mjs": probeSrc, "sim.mjs": simSrc, "report.mjs": reportSrc };
for (const op of FORBIDDEN_OPERATIONS) {
  for (const [name, src] of Object.entries(sources)) {
    ok(!new RegExp(`\\b${op}\\s*\\(`).test(src), `${name} does not define/call ${op}()`);
  }
}
// the probe builds no auth header and reads no key material outside comments
const codeOnly = (s) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
ok(!/headers\s*:\s*\{[^}]*Authorization/i.test(probeSrc), "probe builds no Authorization header");
ok(!/\b(Bearer|apiKey|api_key|secretKey|privateKey)\b/i.test(codeOnly(probeSrc)), "probe mentions no credential in code");
ok(/AbortController/.test(probeSrc), "probe time-boxes every request");
ok(!/keypair|secret|privateKey/i.test(codeOnly(reportSrc)), "report module carries no key material");

// --- classification: the rules that must never be wrong ----------------------
eq(classify({ transport: "unreachable", error: "fetch failed" }).verdict, "unreachable",
  "a transport failure is 'unreachable', not a contract failure");
eq(classify({ transport: "http-ok", json: { error: { code: -32601, message: "method not found" } } }).verdict,
  "method-absent", "-32601 is method-absent");
eq(classify({ transport: "http-ok", json: { error: { code: -32603, message: "no keys" } } }).verdict,
  "validation-error", "-32603 is a validation error");
eq(classify({ transport: "http-ok", json: { error: { code: -32602, message: "startLedger must be positive" } } }).verdict,
  "validation-error", "-32602 is a validation error");
eq(classify({ transport: "http-ok", json: { result: { error: "Could not unmarshal transaction", latestLedger: 0 } } }).verdict,
  "envelope-error", "an in-result error is an envelope error, NOT a JSON-RPC error");
eq(classify({ transport: "http-ok", json: { result: { entries: [], latestLedger: 5 } } }).verdict,
  "absent-not-error", "an empty entry set is information, not a failure");
eq(classify({ transport: "http-ok", json: { result: { entries: [{ x: 1 }], latestLedger: 5 } } }).verdict,
  "simulated-ok", "a non-empty result is a success");
eq(classify(null).verdict, "unreachable", "a missing attempt is treated conservatively");

// classifySupport (probe-side) must agree with classify on the key cases
eq(classifySupport({ transport: "http-ok", json: { error: { code: -32601 } } }), "method-absent",
  "probe-side support check agrees: -32601 is absent");
eq(classifySupport({ transport: "http-ok", json: { error: { code: -32603 } } }), "supported-validation-error",
  "probe-side: a validation error still means the method EXISTS");
eq(classifySupport({ transport: "http-ok", json: { result: {} } }), "supported", "probe-side: a result means supported");
eq(classifySupport({ transport: "unreachable" }), "unreachable", "probe-side: transport failure");

// --- the report carries the disclaimer, always ------------------------------
const rep = buildReport({ method: "simulateTransaction", attempt: { transport: "http-ok", json: { result: { error: "Could not unmarshal transaction", latestLedger: 0 } } }, nodeVersion: "28.0.1" });
eq(rep.verdict, "envelope-error", "report classifies correctly");
ok(Array.isArray(rep.doesNotMean) && rep.doesNotMean.length > 0, "report always lists what the verdict does not mean");
const text = renderReport(rep);
ok(/does NOT mean/.test(text), "rendered report includes the 'does NOT mean' section");
ok(!/guarantee/i.test(text) || /not a guarantee|does NOT/i.test(text), "rendered report makes no guarantee claim");

// --- E: a SUCCESSFUL simulation must never read as an on-chain guarantee ----
const okReport = buildReport({
  method: "simulateTransaction",
  attempt: { transport: "http-ok", json: { result: { entries: [{ x: 1 }], latestLedger: 42, id: "success" } } },
  nodeVersion: "28.0.1",
});
eq(okReport.verdict, "simulated-ok", "a successful simulation classifies as simulated-ok");
const okText = renderReport(okReport);
ok(/does NOT mean/.test(okText), "a SUCCESS report still carries the 'does NOT mean' section");
ok(/will succeed on-chain/i.test(okText) && /does NOT mean/.test(okText),
  "a SUCCESS report explicitly states it does not mean on-chain success");
ok(!/guarantee/i.test(okText.replace(/does NOT mean[\s\S]*/i, "")) || !/guarantee/i.test(okText),
  "a SUCCESS report contains no guarantee wording");
ok(okReport.doesNotMean.some((d) => /succeed on-chain/i.test(d)),
  "simulated-ok's doesNotMean includes on-chain success");
// and the rendered success report must contain a negation, not just a positive claim
ok(/\b(not|does not|never)\b/i.test(okText), "a SUCCESS report contains explicit negation");

// --- regression comparison --------------------------------------------------
const before = { nodeVersion: "28.0.1", protocolVersion: 28, cases: [{ key: "F1", verdict: "envelope-error" }, { key: "F2", verdict: "absent-not-error" }] };
const afterSame = { nodeVersion: "28.0.1", protocolVersion: 28, cases: [{ key: "F1", verdict: "envelope-error" }, { key: "F2", verdict: "absent-not-error" }] };
const afterBumped = { nodeVersion: "29.0.0", protocolVersion: 28, cases: [{ key: "F1", verdict: "envelope-error" }, { key: "F2", verdict: "unreachable" }] };
const c1 = compareRuns(before, afterSame);
eq(c1.changes, 0, "identical runs report no changes");
eq(c1.nodeChanged, false, "identical runs report no node change");
const c2 = compareRuns(before, afterBumped);
eq(c2.nodeChanged, true, "a node bump is detected");
eq(c2.rows.find((r) => r.key === "F2").status, "changed", "a verdict change is detected");
eq(c2.regressions, 1, "a move to 'unreachable' counts as a regression");
ok(isComparable(before), "a snapshot with version + cases is comparable");
ok(!isComparable({ cases: [] }), "a snapshot without version info is not comparable");

// --- fixtures are synthetic and labelled ------------------------------------
ok(FIXTURE_NOTE.includes("synthetic"), "fixtures are labelled synthetic");
ok(String(FIXTURES.malformedEnvelope).length > 0, "the malformed-envelope fixture exists");
eq(FIXTURES.emptyKeys, [], "the empty-keys fixture is an empty array");
ok(!/private|seed|mnemonic/i.test(JSON.stringify(FIXTURES)), "no fixture contains seed/key material");

// --- documentation consistency ----------------------------------------------
const docs = [
  "README.md", "llms.txt", "docs/INDEX.md", "docs/SIMULATION.md", "docs/FAILURE-SHAPES.md",
  "docs/REGRESSION.md", "docs/SOURCES.md", "docs/VERIFICATION.md", "docs/DECISIONS.md",
  "docs/CLAIM-VERIFICATION.md", "docs/ANALYSIS-LIMIT.md",
];
for (const rel of docs) {
  let src;
  try { src = readFileSync(join(root, rel), "utf8"); } catch { failures.push(`${rel} is missing`); fail++; continue; }
  ok(src.length > 200, `${rel} has content`);
}

// A forbidden phrase is a violation only when ASSERTED — quotation/denial is fine.
const NEGATION = /\b(no|not|never|does not|do not|must not|refuse|refuses|without|forbid|forbidden|cannot|can't|disclaim|non-signal)\b/i;
const REJECT_MARK = /(non-signal|non-claim|forbidden|rejected|not claimed|not-claimed|does not claim|doesn't claim|avoid|refus)/i;
function assertsForbidden(line, phrase) {
  if (!line.toLowerCase().includes(phrase.toLowerCase())) return false;
  if (NEGATION.test(line) || REJECT_MARK.test(line)) return false;
  if (new RegExp(`["'\`][^"'\`]*${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"'\`]*["'\`]`, "i").test(line)) return false;
  return true;
}
for (const rel of docs) {
  const src = readFileSync(join(root, rel), "utf8");
  for (const phrase of FORBIDDEN_CLAIMS) {
    const offending = src.split(/\r?\n/).filter((l) => assertsForbidden(l, phrase));
    ok(offending.length === 0,
      `${rel}: does not ASSERT forbidden claim "${phrase}"${offending[0] ? ` (offending: ${offending[0].trim().slice(0, 90)})` : ""}`);
  }
}

// --- llms.txt states the honest limits --------------------------------------
const llms = readFileSync(join(root, "llms.txt"), "utf8");
ok(/read-only/i.test(llms), "llms.txt states the tool is read-only");
ok(/Testnet/i.test(llms), "llms.txt states the scope is Testnet");
ok(/does not|never|not a guarantee/i.test(llms), "llms.txt is honest about what it does not claim");
// "guarantee" may appear in a QUESTION ("Does X guarantee Y? No.") or in a denial.
// A violation would be an affirmative guarantee. So we strip questions and denials first.
const llmsNoGuarantee = llms
  .replace(/[^\n]*\?[^\n]*/g, "")                                   // strip question lines
  .replace(/not a guarantee|no guarantee|never guarantees?/gi, "")   // strip denials
  .replace(/guarantee[sd]?\s+on-?chain\s+success\?/gi, "");          // strip the named question
ok(!/guarantee/i.test(llmsNoGuarantee), "llms.txt makes no affirmative guarantee claim");
ok(/[^\n]*guarantee[^\n]*\?/i.test(llms) || /not a guarantee|no guarantee/i.test(llms),
  "llms.txt addresses the guarantee question explicitly");

// --- the surface list used by the live probe matches the recorded surface ---
for (const p of SURFACE_PROBES) {
  ok(RPC_SURFACE.methods.some((m) => m.name === p.name), `SURFACE_PROBES includes a recorded method: ${p.name}`);
}
// and every recorded method must be probed — otherwise verify-claims would report
// an untested claim as 'unreachable', which is the exact confusion it prevents.
for (const m of RPC_SURFACE.methods) {
  ok(SURFACE_PROBES.some((p) => p.name === m.name),
    `every recorded method is probed live: ${m.name}`);
}
eq(SURFACE_PROBES.length, RPC_SURFACE.methods.length,
  "the probe covers exactly the recorded surface (no method silently unverified)");

console.log("pi-contract-simulator — invariant tests");
console.log(`  pass: ${pass}`);
console.log(`  fail: ${fail}`);
if (fail > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log("  - " + f);
  process.exitCode = 1;
}
