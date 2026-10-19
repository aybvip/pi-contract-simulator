// report.mjs — classify a probe result into a verdict a developer can act on.
//
// This module is pure: it takes the output of probe.mjs (or any object of the
// same shape) and returns a report. It performs no I/O, so it can be used to
// build snapshots, compare regression runs, or be embedded in CI.
//
// The classification rules are anchored to the measured failure shapes (F1–F5)
// in lib.mjs. If a rule is wrong, test/sim.test.mjs fails.

import { VERDICTS, FAILURE_SHAPES, verdictById, FORBIDDEN_INFERENCE } from "./lib.mjs";

/**
 * Classify a single raw JSON-RPC attempt.
 *
 * Order matters, and it encodes the lesson of this repo:
 *   1. transport failure  -> unreachable   (never confused with a contract failure)
 *   2. JSON-RPC error     -> validation / method-absent, by code
 *   3. in-result error    -> envelope-error (F1: the trap)
 *   4. a result           -> success, with its explicit limits
 */
export function classify(attempt) {
  if (!attempt || typeof attempt !== "object") {
    return { verdict: "unreachable", reason: "no attempt object supplied" };
  }
  if (attempt.transport === "unreachable") {
    return { verdict: "unreachable", reason: `transport failure: ${attempt.error ?? "no detail"}` };
  }
  if (attempt.json?.error) {
    const code = attempt.json.error.code;
    const message = attempt.json.error.message ?? "";
    if (code === -32601) return { verdict: "method-absent", code, reason: message };
    if (code === -32602 || code === -32603) return { verdict: "validation-error", code, reason: message };
    return { verdict: "validation-error", code: code ?? null, reason: message || "unrecognised JSON-RPC error" };
  }
  const result = attempt.json?.result;
  if (result === undefined) {
    return { verdict: "unreachable", reason: "no result and no error in the response" };
  }
  // F1: the node reports an execution/decode problem INSIDE the result object.
  if (result && typeof result === "object" && typeof result.error === "string") {
    return { verdict: "envelope-error", reason: result.error, latestLedger: result.latestLedger ?? null };
  }
  // F2: an empty entry set is information, not a failure.
  if (result && typeof result === "object" && Array.isArray(result.entries) && result.entries.length === 0) {
    return { verdict: "absent-not-error", reason: "the queried key has no entry (this is not a failure)" };
  }
  return { verdict: "simulated-ok", reason: "the node returned a result" };
}

/**
 * Build a full report for one attempt. The report carries, for every verdict,
 * the explicit list of things it does NOT mean — taken from lib.mjs, so the
 * disclaimer can never drift from the classification.
 */
export function buildReport({ method, attempt, ledger = null, nodeVersion = null }) {
  const c = classify(attempt);
  const v = verdictById(c.verdict);
  return {
    method,
    verdict: c.verdict,
    reason: c.reason ?? null,
    code: c.code ?? null,
    latestLedger: attempt?.json?.result?.latestLedger ?? ledger,
    nodeVersion,
    meaning: v?.meaning ?? "(unclassified)",
    doesNotMean: v?.doesNotMean ?? [],
    nextStep: v?.nextStep ?? null,
  };
}

/**
 * Render a report as text. The last two lines are not optional: they are the
 * reason this tool exists. A report that omits them is a report that can be
 * misread as a guarantee.
 */
export function renderReport(report) {
  const lines = [];
  lines.push(`method:   ${report.method}`);
  lines.push(`verdict:  ${report.verdict}`);
  lines.push(`reason:   ${report.reason ?? "-"}`);
  if (report.code != null) lines.push(`code:     ${report.code}`);
  if (report.latestLedger != null) lines.push(`ledger:   ${report.latestLedger}`);
  if (report.nodeVersion) lines.push(`node:     ${report.nodeVersion}`);
  lines.push(`means:    ${report.meaning}`);
  if (report.doesNotMean.length) {
    lines.push("does NOT mean:");
    for (const d of report.doesNotMean) lines.push(`  - ${d}`);
  }
  if (report.nextStep) lines.push(`next:     ${report.nextStep}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Regression: compare two runs honestly
// ---------------------------------------------------------------------------

/**
 * Compare two snapshots. Rules (from lib.mjs REGRESSION_REQUIREMENTS):
 *   - a node-version change is reported FIRST;
 *   - only verdicts and error strings are compared, never gas numbers;
 *   - a change in verdict is a regression signal; identical verdicts are "stable".
 */
export function compareRuns(before, after) {
  const out = {
    nodeChanged: before.nodeVersion !== after.nodeVersion,
    beforeNode: before.nodeVersion ?? null,
    afterNode: after.nodeVersion ?? null,
    rows: [],
    regressions: 0,
    changes: 0,
  };
  const beforeByKey = new Map(before.cases.map((c) => [c.key, c]));
  for (const a of after.cases) {
    const b = beforeByKey.get(a.key);
    if (!b) { out.rows.push({ key: a.key, status: "new", before: null, after: a.verdict }); out.changes++; continue; }
    if (b.verdict !== a.verdict) {
      out.rows.push({ key: a.key, status: "changed", before: b.verdict, after: a.verdict });
      out.changes++;
      // a move AWAY from a terminal, understood verdict is a regression signal
      if (a.verdict === "unreachable" && b.verdict !== "unreachable") out.regressions++;
    } else {
      out.rows.push({ key: a.key, status: "stable", before: b.verdict, after: a.verdict });
    }
  }
  return out;
}

/** A snapshot is only comparable if it records the environment. */
export function isComparable(snapshot) {
  return Boolean(snapshot && snapshot.nodeVersion && snapshot.protocolVersion && Array.isArray(snapshot.cases));
}

// ---------------------------------------------------------------------------
// Self-description — what this report never claims
// ---------------------------------------------------------------------------

export const REPORT_DISCLAIMER = [
  FORBIDDEN_INFERENCE,
  "A verdict describes what the node returned at one ledger. It is not a statement about contract correctness.",
  "The fee reported is the fee of the simulation, not a promise about a future transaction.",
  "No report is a statement that Pi approved, endorsed, or reviewed anything.",
];

export { FAILURE_SHAPES };
