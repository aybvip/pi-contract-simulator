// lib.mjs — the measured contract of the Pi Testnet Soroban RPC, as pure data.
//
// Everything here is either MEASURED (reproduced by probe.mjs against
// rpc.testnet.minepi.com) or DOCUMENTED (Soroban's published RPC semantics).
// No writes, no keys, no signing.

// ---------------------------------------------------------------------------
// 1. Claim kinds — the honesty contract
// ---------------------------------------------------------------------------
export const CLAIM_KINDS = [
  { id: "measured", meaning: "reproduced by a command in this repo, against rpc.testnet.minepi.com, right now" },
  { id: "documented", meaning: "published Soroban JSON-RPC semantics; cites the protocol, not the node" },
  { id: "external", meaning: "third-party commentary, flagged UNOFFICIAL" },
  { id: "not-claimed", meaning: "out of scope: correctness of a contract's business logic, Mainnet behaviour, fees on Mainnet" },
];

/** Phrases that must never be asserted in this repo. */
export const FORBIDDEN_CLAIMS = [
  "guarantees the transaction will succeed",
  "proves the contract is correct",
  "Pi approved",
  "Pi is obliged to",
  "we are first",
  "works on Mainnet",
];

// ---------------------------------------------------------------------------
// 2. The RPC surface — a CLAIM, scoped to an endpoint AND a node version
// ---------------------------------------------------------------------------
//
// This is the single most important distinction in this file:
//
//   "method absent"  !=  "method not supported at this endpoint/version"
//
// The second is what we can actually measure. So every row below is a CLAIM
// that carries the endpoint, node version and protocol version it was measured
// against — never a statement about "Pi's RPC in general".
//
// A method is "supported" when the node answers it (even with a validation
// error). A method is "absent" when the node answers -32601 method not found.
// Both are properties of THIS endpoint AT THIS VERSION, and both can change.
//
// `verifyClaim()` (in probe.mjs) re-measures any row live and returns
// `current` / `stale` / `superseded` — so no conclusion is published without a
// fresh measurement. The static `measuredAt` date is deliberately accompanied
// by a warning: a date is not evidence, a re-run is.

export const RPC_SURFACE = {
  endpoint: "https://rpc.testnet.minepi.com",
  measuredAt: "2026-10-19",
  /** What the measuredAt date means, and what it does not. */
  measuredAtMeaning:
    "the date this claim was recorded; it is NOT a guarantee that the claim still holds — re-run with --verify-claims",
  protocolVersion: 28,
  nodeVersion: "28.0.1",
  captiveCoreVersion: "v28.0.1",
  /** Every row is scoped to the version above; a version change invalidates it. */
  scope: "this endpoint, at this node version and protocol version",
  methods: [
    { name: "getHealth", supported: true, note: "status, latestLedger, oldestLedger, ledgerRetentionWindow" },
    { name: "getNetwork", supported: true, note: "passphrase, protocolVersion" },
    { name: "getLatestLedger", supported: true, note: "sequence, closeTime, headerXdr" },
    { name: "getVersionInfo", supported: true, note: "version, commitHash, captiveCoreVersion, protocolVersion" },
    { name: "getFeeStats", supported: true, note: "sorobanInclusionFee + inclusionFee percentiles" },
    { name: "getLedgerEntries", supported: true, note: "reads contract/ledger state by key; empty set is NOT an error" },
    { name: "simulateTransaction", supported: true, note: "simulation; failures arrive INSIDE result.error, not as a JSON-RPC error" },
    { name: "getTransaction", supported: true, note: "requires a full 32-byte hash" },
    { name: "getEvents", supported: true, note: "bounded window; cap 100; endLedger exclusive" },
    { name: "getContractData", supported: false, note: "NOT PRESENT at this version (-32601 method not found) — use getLedgerEntries" },
  ],
};

export const isSupported = (name) =>
  RPC_SURFACE.methods.find((m) => m.name === name)?.supported ?? false;

/**
 * The types of claim a row can be, so a publisher cannot confuse them:
 *   - endpoint-scoped: true here, maybe not elsewhere (a different endpoint)
 *   - version-scoped:  true at nodeVersion 28.0.1, maybe not after an upgrade
 *   - protocol-scoped: true under protocol 28
 * There is deliberately NO "always true" kind.
 */
export const CLAIM_SCOPES = [
  { id: "endpoint-scoped", meaning: "measured at RPC_SURFACE.endpoint only; another endpoint may differ" },
  { id: "version-scoped", meaning: "measured at RPC_SURFACE.nodeVersion only; an upgrade may change it" },
  { id: "protocol-scoped", meaning: "measured under RPC_SURFACE.protocolVersion only" },
];

/** Verdicts produced when a recorded claim is compared against a fresh measurement. */
export const CLAIM_VERIFICATION = {
  current: "the recorded claim matches a fresh measurement at this moment",
  stale: "the recorded claim no longer matches — the node's behaviour moved; update the claim WITH the new reading",
  superseded: "a different node/protocol version answered; the old claim is about a version that is no longer live",
  unreachable: "the endpoint could not be contacted, so NO claim can be confirmed — do not publish from this run",
};

/** Verdicts that forbid publishing a conclusion built on this run. */
export const BLOCKING_VERIFICATION = ["stale", "superseded", "unreachable"];

// ---------------------------------------------------------------------------
// 3. Measured failure shapes — the part a simulator report must get right
// ---------------------------------------------------------------------------
//
// These are the exact observed responses. A simulator that does not reproduce
// these shapes will mislead a developer about WHY a call failed.

export const FAILURE_SHAPES = [
  {
    id: "F1",
    trigger: "simulateTransaction with a missing or malformed `transaction` field",
    transport: "HTTP 200, no JSON-RPC error",
    observed: { error: "Could not unmarshal transaction", latestLedger: 0 },
    meaning: "The node could not decode the envelope. It is NOT a contract outage and NOT a fee problem.",
    reportedAs: "envelope-error",
  },
  {
    id: "F2",
    trigger: "getLedgerEntries for a key that does not exist",
    transport: "HTTP 200, no error at all",
    observed: { entries: [], latestLedger: 27254785 },
    meaning: "An absent key is an EMPTY SET, not a failure. Reporting it as an error is wrong.",
    reportedAs: "absent-not-error",
  },
  {
    id: "F3",
    trigger: "getLedgerEntries with `keys: []`",
    transport: "JSON-RPC error -32603",
    observed: { code: -32603, message: "could not query captive core: no keys specified in request" },
    meaning: "A validation error. Distinguishable from a node failure by the code.",
    reportedAs: "validation-error",
  },
  {
    id: "F4",
    trigger: "an unsupported method (e.g. getContractData)",
    transport: "JSON-RPC error -32601",
    observed: { code: -32601, message: "method not found" },
    meaning: "The method does not exist on this node. Do not retry; use getLedgerEntries.",
    reportedAs: "method-absent",
  },
  {
    id: "F5",
    trigger: "getEvents with a non-positive startLedger",
    transport: "JSON-RPC error -32602",
    observed: { code: -32602, message: "startLedger must be positive" },
    meaning: "A validation error with a corrective message; it names the field to fix.",
    reportedAs: "validation-error",
  },
];

export const failureById = (id) => FAILURE_SHAPES.find((f) => f.id === id) ?? null;

// ---------------------------------------------------------------------------
// 4. Verdict model — what a simulation report may and may not say
// ---------------------------------------------------------------------------
//
// The report classifies a simulation attempt. It must NEVER claim that a
// successful simulation guarantees on-chain success.

export const VERDICTS = [
  {
    id: "simulated-ok",
    meaning: "the node executed the simulation and returned success",
    doesNotMean: [
      "the transaction will succeed on-chain",
      "the contract's business logic is correct",
      "the fee it reports is what you will pay later",
    ],
  },
  {
    id: "envelope-error",
    meaning: "the node could not decode the submitted envelope (F1)",
    doesNotMean: ["the contract is unreachable", "your keys are wrong"],
    nextStep: "check how the transaction was built and encoded; do not look at the contract yet",
  },
  {
    id: "absent-not-error",
    meaning: "the queried key has no entry (F2)",
    doesNotMean: ["the node failed", "the contract does not exist"],
    nextStep: "confirm the ledger key you built matches the contract's storage layout",
  },
  {
    id: "validation-error",
    meaning: "the request was rejected before execution (F3/F5)",
    doesNotMean: ["your contract logic is wrong"],
    nextStep: "fix the named field; the message identifies it",
  },
  {
    id: "method-absent",
    meaning: "the node does not implement the method (F4)",
    doesNotMean: ["the node is down"],
    nextStep: "use a supported method; see RPC_SURFACE.methods",
  },
  {
    id: "unreachable",
    meaning: "the endpoint could not be contacted within the time box",
    doesNotMean: ["the transaction would fail on-chain"],
    nextStep: "retry later; this is a local/network condition, recorded as such",
  },
];

export const verdictById = (id) => VERDICTS.find((v) => v.id === id) ?? null;

/** The forbidden inference: success in simulation => success on-chain. */
export const FORBIDDEN_INFERENCE =
  "A successful simulation MUST NOT be reported as a guarantee of on-chain success.";

// ---------------------------------------------------------------------------
// 5. Regression support — what makes two runs comparable
// ---------------------------------------------------------------------------

export const REGRESSION_REQUIREMENTS = [
  "both runs must record the node version and protocol version",
  "both runs must record the ledger sequence they simulated against",
  "only verdicts and reported error strings are compared, never gas numbers across ledgers",
  "a difference in node version is reported FIRST, before any verdict difference",
];

// ---------------------------------------------------------------------------
// 6. Boundaries
// ---------------------------------------------------------------------------
export const BOUNDARIES = [
  "It does not sign, submit, or broadcast anything. It only simulates and reads.",
  "It does not claim a simulated success means an on-chain success.",
  "It does not analyse contract business logic; it reports what the node said.",
  "It does not work against Mainnet: rpc.mainnet.minepi.com is not reachable (measured).",
  "It does not estimate fees as a promise; it reports the fee the node returned.",
  "It does not store keys, tokens, or personal data.",
];

export const FORBIDDEN_OPERATIONS = [
  "signTransaction",
  "submitTransaction",
  "sendTransaction",
  "postTransaction",
];

// ---------------------------------------------------------------------------
// 6b. The contract-analysis layer — measured as NOT supported by this RPC
// ---------------------------------------------------------------------------
//
// A frequent request is to analyse a contract's *logic*: preconditions, state
// transitions, test cases. The honest question is whether the RPC can supply
// what such a layer needs. It cannot, and this is MEASURED, not assumed:
//
//   getContractWasm   -> -32601 method not found
//   getContractCode   -> -32601 method not found
//   getLedgerEntry    -> -32601 method not found
//   getAccount        -> -32601 method not found
//   (enumerate)       -> no method exists; getLedgerEntries requires exact keys
//
// There is no method that returns a contract's WASM. There is no method that
// enumerates a contract's storage. So "analyse the contract's logic" cannot be
// derived from this RPC alone. This is recorded so the limit is a measurement
// rather than an omission.

export const ANALYSIS_REQUIREMENTS = {
  available: [
    { need: "execute a fully-built transaction and read the node's result", method: "simulateTransaction", status: "available" },
    { need: "read a known ledger key exactly", method: "getLedgerEntries", status: "available (exact keys required)" },
    { need: "identify the node version for reproducibility", method: "getVersionInfo", status: "available" },
    { need: "read fee percentiles", method: "getFeeStats", status: "available" },
  ],
  unavailable: [
    { need: "fetch a contract's WASM", method: "getContractWasm", status: "absent (-32601 method not found)" },
    { need: "fetch a contract's code entry", method: "getContractCode", status: "absent (-32601 method not found)" },
    { need: "enumerate a contract's storage entries", method: "(none)", status: "no enumerate method exists on this endpoint" },
    { need: "read an account's state", method: "getAccount", status: "absent (-32601 method not found)" },
  ],
  conclusion:
    "A logic-analysis layer cannot be derived from this RPC alone. It would require the contract's WASM from a separate source AND the storage layout, neither of which this endpoint provides.",
};

/** The claim a logic-analysis feature would have to make, and why it is not made. */
export const ANALYSIS_NOT_CLAIMED =
  "This tool does not analyse contract logic, preconditions, or state transitions. It reports what the node returned for a simulation and a ledger read.";

// ---------------------------------------------------------------------------
// 7. Fixtures — synthetic, clearly labelled, never a real transaction
// ---------------------------------------------------------------------------

export const FIXTURES = {
  /** Intentionally not a valid envelope: used to reproduce F1 deterministically. */
  malformedEnvelope: "AAAAAA==",
  /** Intentionally empty key list: used to reproduce F3 deterministically. */
  emptyKeys: [],
  /** A structurally valid-looking but unknown ledger key: reproduces F2 (absent, not error). */
  unknownLedgerKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
};

export const FIXTURE_NOTE = "All fixtures are synthetic and contain no real account, key, or transaction.";
