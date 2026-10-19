# Failure shapes — the exact wording, and why it matters

> The most useful part of a simulation tool is not its success path. It is whether it tells the
> developer **which of several very different things went wrong**. These shapes were measured live and
> are reproduced by `node sim.mjs --failures`.

---

## The five shapes

### F1 — envelope error (the trap)

```
trigger:    simulateTransaction with a missing or malformed `transaction` field
transport:  HTTP 200 — no JSON-RPC error
observed:   { "error": "Could not unmarshal transaction", "latestLedger": 0 }
```

This is the shape that misleads people. The failure arrives **inside `result`**, over a successful
HTTP response, with **no JSON-RPC error object**. A tool that only checks `jsonrpc.error` reports
this as a **success**.

**What it means:** the node could not decode the envelope. It is not a contract problem, not a fee
problem, and not an outage.
**What to look at first:** how the transaction was built and encoded — not the contract.

---

### F2 — absent key is not an error

```
trigger:    getLedgerEntries for a key that does not exist
transport:  HTTP 200 — no error at all
observed:   { "entries": [], "latestLedger": 27254785 }
```

An absent ledger entry is an **empty set**, not a failure. A tool that treats "empty" as "the node
broke" sends the developer hunting for a fault that does not exist.

**What it means:** the queried key has no entry at this ledger.
**What to look at first:** whether the ledger key matches the contract's storage layout.

---

### F3 — validation error, distinguishable by code

```
trigger:    getLedgerEntries with keys: []
transport:  JSON-RPC error -32603
observed:   { "code": -32603, "message": "could not query captive core: no keys specified in request" }
```

**What it means:** the request was rejected before execution. The message names the field to fix.
**What it does NOT mean:** that the contract logic is wrong.

---

### F4 — method absent (do not retry)

```
trigger:    an unsupported method, e.g. getContractData
transport:  JSON-RPC error -32601
observed:   { "code": -32601, "message": "method not found" }
```

**What it means:** this node does not implement the method. Retrying will not help.
**What to do:** use a supported method — contract state is read with `getLedgerEntries`.

---

### F5 — a correction the node names for you

```
trigger:    getEvents with a non-positive startLedger
transport:  JSON-RPC error -32602
observed:   { "code": -32602, "message": "startLedger must be positive" }
```

**What it means:** a validation error whose message contains the fix. The tool surfaces it verbatim
rather than paraphrasing it.

---

## The rule that connects them

| Transport outcome | Classification | Never confused with |
|---|---|---|
| fetch failed / timeout | `unreachable` | a contract failure |
| JSON-RPC `-32601` | `method-absent` | the node being down |
| JSON-RPC `-32602` / `-32603` | `validation-error` | contract logic being wrong |
| in-result `error` (F1) | `envelope-error` | a JSON-RPC error **or** a success |
| `entries: []` (F2) | `absent-not-error` | a failure |

This table is enforced by tests: `classify()` in [`../report.mjs`](../report.mjs) is asserted against
each row in [`../test/sim.test.mjs`](../test/sim.test.mjs). If a rule drifts, the tests fail.

## Reproduce

```bash
node sim.mjs --failures        # all five, live
node sim.mjs --report F1       # one shape, rendered as a developer report (offline)
```
