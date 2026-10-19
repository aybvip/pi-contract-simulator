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
// 2. The RPC surface — measured today against rpc.testnet.minepi.com
// ---------------------------------------------------------------------------
//
// A method is "supported" when the node answers it (even with a validation
// error). A method is "absent" when the node answers -32601 method not found.

export const RPC_SURFACE = {
  endpoint: "https://rpc.testnet.minepi.com",
  measuredAt: "2026-10-19",
  protocolVersion: 28,
  nodeVersion: "28.0.1",
  captiveCoreVersion: "v28.0.1",
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
    { name: "getContractData", supported: false, note: "NOT PRESENT (-32601 method not found) — use getLedgerEntries" },
  ],
};

export const isSupported = (name) =>
  RPC_SURFACE.methods.find((m) => m.name === name)?.supported ?? false;

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
