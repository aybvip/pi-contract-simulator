# Sources

Every statement in this repository is exactly one of: **measured**, **documented**, **external**, or
**not-claimed**.

---

## Measured (reproduced by this repo, right now)

| Ref | Endpoint | Used for | Reproduce |
|---|---|---|---|
| M1 | `https://rpc.testnet.minepi.com` | the RPC surface, node identity, fee stats, failure shapes F1–F5 | `node sim.mjs --probe` |
| M2 | `https://rpc.mainnet.minepi.com` | reachability (which is why the scope is Testnet) | `node sim.mjs --mainnet` |

Both are **read-only** JSON-RPC reads. No credentials are sent. Every call is time-boxed.

## Documented (Soroban protocol semantics)

| Ref | Subject | Used for | Status |
|---|---|---|---|
| D1 | Soroban JSON-RPC method semantics (`simulateTransaction`, `getLedgerEntries`, error codes) | classifying results and errors | **protocol documentation** |
| D2 | JSON-RPC 2.0 error codes (`-32601` method not found, `-32602` invalid params, `-32603` internal) | the code-to-verdict mapping | **protocol documentation** |

Where this page says "protocol documentation", it means the behaviour is defined by the Soroban /
JSON-RPC lineage, **not** invented for Pi. The measured values are Pi-Testnet-specific; the code
meanings are not.

## External (unofficial — flagged)

| Ref | Source | Used for | Status |
|---|---|---|---|
| X1 | Public Soroban tooling and community discussion | context on standard simulation workflows | **Unofficial** |

Nothing **external** is used to support a claim about Pi's intent, plans, or future behaviour.

## Not-claimed

The following are **never** asserted, and no source is offered because none exists:

- Correctness of any contract's business logic.
- That a successful simulation implies an on-chain success.
- Any Mainnet behaviour (the Mainnet RPC is not reachable).
- Approval, endorsement, or review by Pi of this tool or of any application.
- Priority or novelty.

## Update rule

If any **measured** value changes, [`SIMULATION.md`](SIMULATION.md) and [`FAILURE-SHAPES.md`](FAILURE-SHAPES.md)
must be updated **with the new measurement**, and the affected test assertions must be updated in the
same change.
