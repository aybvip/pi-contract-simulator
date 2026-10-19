# Decision record — including what was deliberately **not** built

This repository is part of a set of proposals. Recording why some were **declined** is part of being
honest about what the set claims.

---

## D1 — Scope is Testnet, with an explicit `unreachable` verdict

**Decision:** the simulator targets `rpc.testnet.minepi.com` only.

**Reason (measured):** the Mainnet Soroban RPC is not reachable, reproduced by `node sim.mjs --mainnet`.
Pointing at Mainnet would make every case `unreachable`, which is noise, not measurement.

**What would change this:** the Mainnet RPC becoming reachable. Then this decision is revisited **with
a new measurement**, not by assumption.

---

## D2 — No claims about contract logic correctness

**Decision:** the tool reports what the node said. It never states that a contract's business logic is
correct, or that a simulation success implies an on-chain success.

**Reason:** that inference is not supported by a simulation, and stating it would be a claim the tool
cannot stand behind. The inference is a **forbidden claim** in [`../lib.mjs`](../lib.mjs), enforced by
the test suite.

---

## D3 — A "capability passport" with signed test evidence was **declined**

**Proposed:** a document that attests an application passed specific tests (authentication, payments,
error handling), carrying **signed test evidence** and an expiry.

**Decision:** **not built**, and recorded here instead.

**Reason:** the phrase "signed evidence" requires answering *who signs*. Two options, neither
supportable:

| Signer | Why it is not usable |
|---|---|
| This project signs | It would imply an authority to attest that no third party here has. That is a claim of authority, not a measurement. |
| Pi signs | Outside this project's control, and would imply an endorsement that does not exist. |

**What is built instead:** nothing that speaks *about an application's capabilities*. The simulator
produces a **per-run report** of what a node returned, which is a measurement with a timestamp — not
an attestation, and not transferable as a credential.

**If revisited, the honest shape would be:** a **local**, unsigned self-check a team runs on its own
repository, whose output stays with them and carries no mark implying anyone's endorsement. That is a
different artifact from a "passport", and it is not built here.

---

## D4 — No fee or gas numbers in snapshots

**Decision:** snapshots store verdicts and error strings, not fee/gas values.

**Reason:** fee values are a function of the ledger and network load. Comparing them across runs
produces differences that are not about the code under test. See [`REGRESSION.md`](REGRESSION.md).

---

## D5 — `getContractData` is recorded as absent, not worked around silently

**Decision:** the tool documents that `getContractData` returns `-32601 method not found`, and directs
readers to `getLedgerEntries`.

**Reason:** silently substituting a different method hides a real compatibility detail from the reader.
A tool that quietly papers over a missing method produces developers who do not know their target.

---

## D6 — Recorded claims are endpoint- and version-scoped; re-measurement is mandatory

**Decision:** every recorded method claim is bound to `endpoint`, `nodeVersion`, and `protocolVersion`,
and the CLI provides `node sim.mjs --verify-claims` that **fails (exit 2)** if the claim no longer
matches a live measurement (or if the node version moved).

**Reason:** a date is not evidence. The measured state of a public RPC can change with upgrades. The
guard catches version moves (`superseded`), behavioural changes at the same version (`stale`), and
unreachable endpoints (`unreachable`), and refuses to publish conclusions in those cases.

---

## D7 — A contract-analysis layer cannot be derived from this RPC alone

**Decision:** the repository explicitly records that fetching WASM, enumerating storage, and listing
contract entries are **not available** on this endpoint (measured: `-32601 method not found`, and no
enumerate method exists). This is documented in [`ANALYSIS-LIMIT.md`](ANALYSIS-LIMIT.md), not left as
an omission.

**Reason:** accepting the technical limit is more honest than expanding scope. Adding such a layer
would require the WASM and/or storage layout from a separate source, and this tool deliberately keeps
its scope to "read and classify" what the node returns. See also D3 for why it does not attempt to
produce signed attestations.
