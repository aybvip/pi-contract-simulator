# Contract simulation on Pi Testnet — what the node actually supports

> **Claim discipline.** Everything on this page is either **measured** (reproduced by
> `node sim.mjs --surface` against `rpc.testnet.minepi.com`) or **documented** (published Soroban
> JSON-RPC semantics). Nothing is inferred about Mainnet.

---

## 1. The measured surface

Probed by calling each method with minimal (often invalid) params — because a **validation error
still proves the method exists**, while `-32601` proves it does not.

| Method | Classification | Result keys observed | Note |
|---|---|---|---|
| `getHealth` | supported | `status, latestLedger, oldestLedger, ledgerRetentionWindow` | |
| `getNetwork` | supported | `passphrase, protocolVersion` | |
| `getLatestLedger` | supported | `sequence, closeTime, headerXdr` | |
| `getVersionInfo` | supported | `version, commitHash, captiveCoreVersion, protocolVersion` | used for comparability |
| `getFeeStats` | supported | `sorobanInclusionFee, inclusionFee, latestLedger` | percentiles per fee type |
| `getLedgerEntries` | supported | `entries, latestLedger` | empty set is **not** an error |
| `simulateTransaction` | supported | `error, latestLedger` on failure | the core of this tool |
| `getTransaction` | supported | — | requires a full 32-byte hash |
| `getEvents` | supported | — | bounded window; cap 100; `endLedger` exclusive |
| `getContractData` | **ABSENT** | — | `-32601 method not found` |

**The consequence for a tool builder:** the intuitive name `getContractData` does not exist. Contract
state is read with **`getLedgerEntries`**, by building the correct ledger key.

## 2. Node identity at the time of measurement

```
passphrase:         Pi Testnet
protocolVersion:    28
nodeVersion:        28.0.1
captiveCoreVersion: v28.0.1
```

Record these in every run. Two runs are only comparable when this block matches — see
[`REGRESSION.md`](REGRESSION.md).

## 3. Why the tool is Testnet-only

The Mainnet Soroban RPC is **not reachable** (measured; see
[`SOURCES.md`](SOURCES.md) and `node sim.mjs --mainnet`). A simulator that silently pointed at
Mainnet would produce "unreachable" for every case and teach the developer nothing. So this tool
targets Testnet and **says so everywhere**, including in the `unreachable` verdict text.

## 4. What simulation does and does not tell you

| Simulation says | Simulation does **not** say |
|---|---|
| the node executed this envelope against this ledger | that the transaction will succeed on-chain |
| the cost/host-function result the node computed | that the contract's business logic is correct |
| the failure the node produced, with its exact wording | that your keys, or your fee, are right for later |

That distinction is not a formality: it is why **every report this tool prints carries a
"does NOT mean" section**, generated from [`lib.mjs`](../lib.mjs) rather than typed by hand.

## 5. Reproduce this page

```bash
node sim.mjs --surface      # the table above
node sim.mjs --identity     # the identity block above
node sim.mjs --mainnet      # the reachability verdict
```

If any classification changed, **this page must be updated with the new measurement**.
