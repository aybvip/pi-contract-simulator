# Documentation index — pi-contract-simulator

Simulate Pi **Testnet** contract calls and read the result honestly: a verdict that names what went
wrong, and what that verdict does **not** mean. Read-only — nothing is signed, submitted, or
broadcast.

## Start here

| Document | What it answers |
|---|---|
| [`../README.md`](../README.md) | What this is, what it refuses to claim, quick start |
| [`SIMULATION.md`](SIMULATION.md) | What the Testnet node actually supports (measured) |
| [`FAILURE-SHAPES.md`](FAILURE-SHAPES.md) | The five measured failure shapes, verbatim |
| [`REGRESSION.md`](REGRESSION.md) | How two runs are compared honestly |
| [`DECISIONS.md`](DECISIONS.md) | Decision record, including what was **not** built and why |
| [`SOURCES.md`](SOURCES.md) | Every source, by claim kind |
| [`VERIFICATION.md`](VERIFICATION.md) | Reproduce every claim yourself |

## Commands

| Command | Does |
|---|---|
| `node sim.mjs --surface` | which RPC methods the node answers (live) |
| `node sim.mjs --identity` | node version / protocol / ledger (live) |
| `node sim.mjs --failures` | reproduce failure shapes F1–F5 (live) |
| `node sim.mjs --mainnet` | Mainnet RPC reachability (live) |
| `node sim.mjs --probe` | all live probes |
| `node sim.mjs --snapshot FILE` | write a comparable run snapshot |
| `node sim.mjs --compare A B` | compare two snapshots |
| `node sim.mjs --verdicts` | the verdict model (offline) |
| `node sim.mjs --report F1` | one failure shape as a report (offline) |
| `node sim.mjs --boundaries` | what this tool refuses to claim |
| `node test/run.mjs` | offline invariant suite |

## At a glance

| Concept | Value |
|---|---|
| Scope | Pi **Testnet** Soroban JSON-RPC (Mainnet RPC not reachable) |
| Claim kinds | measured · documented · external · not-claimed |
| Verdicts | simulated-ok · envelope-error · absent-not-error · validation-error · method-absent · unreachable |
| Forbidden inference | simulation success ⇒ on-chain success |
| Network writes | none — read-only probes |
| Report engine | [`../report.mjs`](../report.mjs) |

## Related repositories

- [`pi-gap-index`](https://github.com/aybvip/pi-gap-index) — measured gaps in the public Pi surface, with a reference read contract
- [`pi-soroban-events`](https://github.com/aybvip/pi-soroban-events) — event-window semantics
- [`pi-user-behavior`](https://github.com/aybvip/pi-user-behavior) — what the chain does and does not show
- [`pi-contribution-evidence-model`](https://github.com/aybvip/pi-contribution-evidence-model) — a contribution evidence *model*
