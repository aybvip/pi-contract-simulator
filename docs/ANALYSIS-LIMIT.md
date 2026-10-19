# What this RPC cannot provide a contract-analysis layer

> **The conclusion is measured:** a logic-analysis layer cannot be derived from this RPC alone. The
> endpoint does not expose WASM, does not enumerate storage, and provides no method to list contract
> state.

---

## What the RPC **does** make possible

| Capability | Method | Status | Measured basis |
|---|---|---|---|
| Execute a fully-built transaction and read the node's simulation result | `simulateTransaction` | available | probe returns a result with `result.error` or `result.entries` in the normal case |
| Read a known ledger key exactly | `getLedgerEntries` | available (exact keys required) | `entries: []` for an absent key is observed (F2); the node rejects `keys: []` (F3) |
| Identify the node version for reproducibility | `getVersionInfo` | available | version 28.0.1, protocol 28, commit hash captured |
| Read fee percentiles for the current window | `getFeeStats` | available | fee percentiles are returned in the result |

Each of these is observable, reproducible and version-scoped (see
[`CLAIM-VERIFICATION.md`](CLAIM-VERIFICATION.md)).

## What the RPC **does not** make possible

| Capability | Method | Status (measured) | What the measurement shows |
|---|---|---|---|
| Fetch a contract's WASM | `getContractWasm` | **absent** — `-32601 method not found` | The node rejects the method entirely. Retrying will not help. |
| Fetch a contract's code entry | `getContractCode` | **absent** — `-32601 method not found` | Same: the code-loading surface is not exposed. |
| Read a generic account state | `getAccount` | **absent** — `-32601 method not found` | Not implemented on this endpoint. |
| Enumerate a contract's storage entries | (none) | **no enumerate method exists** | `getLedgerEntries` **requires exact keys**. Without a storage key or enumeration, you cannot list entries. There is no listing endpoint. |
| Fetch ledger entries in bulk without knowing keys | (none) | **not present** | The validation error for `keys: []` (F3) is the explicit signal: you must supply keys. |

These are all measured by probing the endpoint directly against `rpc.testnet.minepi.com` (node 28.0.1,
protocol 28). The classification is `method-absent` in the cases where the RPC returns `-32601`.

## The conclusion

A **logic-analysis layer** (which would include things like precondition checking, exploring state
transitions, or constructing a model of contract storage) **cannot be derived from this RPC alone.**

Such an analysis would require **at least one of**:

1. **The contract WASM** from a separate source (the RPC provides no way to fetch it).
2. **The contract's storage layout/schema** from source or documentation (there is no enumeration).
3. **A known set of keys** to inspect (the RPC does not list them).

Therefore, this tool **does not attempt that analysis**, and explicitly records that it does not
claim it. That is a **boundary**, not a missing feature — see
[`DECISIONS.md`](DECISIONS.md) for why (including the decision to **not** build a "capability
passport" with signed evidence, and to keep to the "read and classify" scope).

## What this repository **does** instead

- **Classifies** exactly what the node returns for simulations and ledger reads.
- **States the limits** of every verdict (a successful simulation is **not** an on-chain guarantee).
- **Makes the limits verifiable:** every claim is endpoint- and version-scoped, and
  `node sim.mjs --verify-claims` re-measures and **refuses** to publish if the behaviour has moved.

## Reproduce

```bash
node sim.mjs --analysis-limit    # this page, offline
node sim.mjs --verify-claims     # live: confirms the absent methods remain absent at this version
```
