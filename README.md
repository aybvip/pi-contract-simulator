# pi-contract-simulator

**Simulate Pi Testnet contract calls and read the result honestly.**

> **What this is.** A read-only tool that exercises the Pi **Testnet** Soroban JSON-RPC, classifies
> every outcome into a verdict a developer can act on, and prints — for every verdict — what that
> verdict does **not** mean. Failures are reported with the node's **exact** wording, because the
> failure wording is what tells you where to look.
>
> **What this is not.** It is **not** a promise that a transaction will succeed. It does **not** analyse
> your contract's business logic. It does **not** work against Mainnet — the Mainnet Soroban RPC is not
> reachable (measured; see below). It makes **no claim** that Pi approved or endorsed anything.

### The name vs the scope — read this first

The name says *simulator*, which can read as "simulates the contract's logic". **It does not.** It calls
the node's `simulateTransaction` method and **classifies the response**. It does not read the contract's
WASM, does not enumerate storage, and does not model state transitions — because the RPC provides none
of those (measured: `getContractWasm` / `getContractCode` / `getAccount` all return `-32601 method not
found`, and there is no enumerate method). That limit is recorded in
[`docs/ANALYSIS-LIMIT.md`](docs/ANALYSIS-LIMIT.md) rather than papered over.

> **Recorded claims are endpoint- and version-scoped, and must be re-measured before use.**
> `node sim.mjs --verify-claims` re-probes every recorded claim live and **exits 2** if anything is
> stale, superseded, or unreachable — so no conclusion is published from a stale record. See
> [`docs/CLAIM-VERIFICATION.md`](docs/CLAIM-VERIFICATION.md).

---

## The one-line answer

> The Pi Testnet node supports simulation and ledger-entry reads; it does **not** support
> `getContractData`; and a simulation failure arrives **inside the result over HTTP 200**, so a tool
> that only checks for a JSON-RPC error will report it as a **success**. This tool classifies the six
> outcomes correctly and states the limits of each.

---

## Quick start

Requires **Node.js ≥ 20**. **No npm dependencies.**

```bash
node sim.mjs --surface      # which RPC methods the node answers (live)
node sim.mjs --verify-claims # re-measure every recorded claim; exit 2 if stale
node sim.mjs --failures     # reproduce the five measured failure shapes (live)
node sim.mjs --identity     # node version / protocol / ledger (live)
node sim.mjs --mainnet      # Mainnet RPC reachability (live)
node sim.mjs --probe        # all of the above

node sim.mjs --verdicts     # the verdict model (offline)
node sim.mjs --report F1    # one failure shape as a developer report (offline)
node sim.mjs --analysis-limit # what this RPC cannot provide a logic layer (offline)
node sim.mjs --boundaries   # what this tool refuses to claim
node test/run.mjs           # offline invariant suite
```

All network activity is **read-only**. Nothing is signed, submitted, or broadcast, and no credentials
are sent.

---

## Why the failure classification is the whole point

Measured against `rpc.testnet.minepi.com`, a simulation with a missing `transaction` field returns:

```json
{ "jsonrpc": "2.0", "id": 1,
  "result": { "error": "Could not unmarshal transaction", "latestLedger": 0 } }
```

There is **no JSON-RPC error object**. A consumer that checks only `jsonrpc.error` sees no error and
concludes the simulation succeeded. This tool reports it as an **`envelope-error`** — an encoding
problem, not a contract problem:

```
verdict:  envelope-error
reason:   Could not unmarshal transaction
means:    the node could not decode the submitted envelope (F1)
does NOT mean:
  - the contract is unreachable
  - your keys are wrong
next:     check how the transaction was built and encoded; do not look at the contract yet
```

The full set of shapes — including the one where an **absent key is an empty set, not a failure** — is
in [`docs/FAILURE-SHAPES.md`](docs/FAILURE-SHAPES.md).

---

## The measured surface (today)

| Method | Classification |
|---|---|
| `simulateTransaction` | supported |
| `getLedgerEntries` | supported (empty set = **not** an error) |
| `getHealth` · `getNetwork` · `getLatestLedger` · `getVersionInfo` · `getFeeStats` · `getTransaction` · `getEvents` | supported |
| `getContractData` | **absent** — `-32601 method not found` |

Node identity at measurement time: `passphrase: Pi Testnet`, `protocolVersion: 28`, `nodeVersion: 28.0.1`.

> **Scope.** Every row above is true of **this endpoint at this node version**. It is **not** a claim
> about "Pi's RPC in general", and it is not guaranteed to hold after an upgrade. `--verify-claims`
> re-measures and refuses to publish if the behaviour moved.

**Mainnet:** `rpc.mainnet.minepi.com` is **not reachable** (measured). That is why this tool is
Testnet-only, and why it says so rather than silently pointing at an endpoint that answers nothing.

---

## The verdict model

| Verdict | Means | Notably does **not** mean |
|---|---|---|
| `simulated-ok` | the node executed the simulation and returned a result | the transaction will succeed on-chain |
| `envelope-error` | the node could not decode the envelope (F1) | the contract is unreachable |
| `absent-not-error` | the queried key has no entry (F2) | the node failed |
| `validation-error` | the request was rejected before execution (F3/F5) | your contract logic is wrong |
| `method-absent` | the node does not implement the method (F4) | the node is down |
| `unreachable` | the endpoint could not be contacted in the time box | the transaction would fail on-chain |

Every report this tool prints carries the "does NOT mean" section, generated from
[`lib.mjs`](lib.mjs) rather than typed by hand — so the disclaimer cannot drift from the classifier.

---

## Regression testing

```bash
node sim.mjs --snapshot baseline.json
node sim.mjs --snapshot current.json
node sim.mjs --compare baseline.json current.json
```

The comparison reports a **node-version change first**, compares **verdicts and error strings only**
(never fee numbers, which are not comparable across ledgers), and counts a move to `unreachable` as a
distinct regression signal. See [`docs/REGRESSION.md`](docs/REGRESSION.md).

---

## What this repository deliberately does **not** contain

- **No signing, submitting, or broadcasting.** Only simulation and reads.
- **No claim that simulation success implies on-chain success.** Stated as a forbidden inference and enforced by tests.
- **No contract-logic analysis.** It does not read WASM, enumerate storage, or model state transitions
  — the RPC provides none of those; see [`docs/ANALYSIS-LIMIT.md`](docs/ANALYSIS-LIMIT.md).
- **No stale records presented as current.** `--verify-claims` fails the run if any claim is not
  freshly measured.
- **No Mainnet support.** The endpoint is not reachable; the tool says so instead of failing silently.
- **No fee promise.** It reports the fee the node returned, and does not present it as what you will pay.
- **No attestation tool.** A "capability passport" with signed test evidence was **declined** — see
  [`docs/DECISIONS.md`](docs/DECISIONS.md) §D3 for the reason.
- **No credentials, no personal data.**

---

## Documentation

- [`docs/INDEX.md`](docs/INDEX.md) — index of everything
- [`docs/SIMULATION.md`](docs/SIMULATION.md) — what the Testnet node supports (measured)
- [`docs/FAILURE-SHAPES.md`](docs/FAILURE-SHAPES.md) — the five measured failure shapes, verbatim
- [`docs/CLAIM-VERIFICATION.md`](docs/CLAIM-VERIFICATION.md) — why a recorded measurement is not evidence
- [`docs/ANALYSIS-LIMIT.md`](docs/ANALYSIS-LIMIT.md) — what this RPC cannot provide a logic layer
- [`docs/REGRESSION.md`](docs/REGRESSION.md) — comparing runs honestly
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decision record, including what was not built
- [`docs/SOURCES.md`](docs/SOURCES.md) — every source, by claim kind
- [`docs/VERIFICATION.md`](docs/VERIFICATION.md) — reproduce every claim yourself
- [`llms.txt`](llms.txt) — one-line answers for agent consumption

## Related repositories

- [`pi-gap-index`](https://github.com/aybvip/pi-gap-index) — measured gaps in the public Pi surface, with a reference read contract
- [`pi-soroban-events`](https://github.com/aybvip/pi-soroban-events) — event-window semantics, honestly
- [`pi-user-behavior`](https://github.com/aybvip/pi-user-behavior) — what the chain does and does not show
- [`pi-contribution-evidence-model`](https://github.com/aybvip/pi-contribution-evidence-model) — a contribution evidence *model*, holding no data

## License

MIT. See [`LICENSE`](LICENSE).

## Scope

- **Read-only, unofficial.** Not affiliated with Pi Network. The probes read public endpoints only.
- **Measured values are as observed at run time**; the node version and ledger are always printed.
- **Third-party sources are flagged unofficial.** Protocol sources are cited with status.
