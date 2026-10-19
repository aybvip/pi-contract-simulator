# Claim verification — why a recorded measurement is not evidence

> **The rule this page exists to enforce:** *no conclusion about the network is published from a
> recorded measurement.* A measurement is only true of the endpoint and the node version that
> answered at that moment. This page, and the `--verify-claims` command, make re-measurement a step
> that must pass before anything is published.

---

## 1. The distinction that is easy to get wrong

Three different statements are commonly collapsed into one:

| Statement | What it actually claims | Checkable? |
|---|---|---|
| "`getContractData` is not supported" | **unknown scope** — where? which version? | **no** |
| "`getContractData` is not supported **at this endpoint**" | endpoint-scoped | yes — call that endpoint |
| "`getContractData` is not supported **at this endpoint, at node version 28.0.1**" | endpoint- and version-scoped | yes — call it and read `getVersionInfo` |

Only the last two are measurements. The first is a rumour. This repository records **only** the last
form: every row in [`../lib.mjs`](../lib.mjs) carries the endpoint, the node version, and the protocol
version, and there is **no "always true" scope** (`CLAIM_SCOPES`).

## 2. What can change, and therefore must be re-checked

| Change | Effect on a recorded claim |
|---|---|
| a **node upgrade** (`getVersionInfo.version` moves) | every recorded row is **superseded** — it describes a version that is no longer answering |
| a **protocol bump** (`getNetwork.protocolVersion` moves) | same: **superseded** |
| a method **removed** from a method set at the same version | the row becomes **stale** |
| a method **added** (e.g. `getContractData` appears) | a row recorded as `supported: false` becomes **stale** |
| the **endpoint** moved | the recorded endpoint is stale by definition |

None of these can be ruled out from a date. They can only be ruled out by **asking the endpoint
again**.

## 3. The command

```bash
node sim.mjs --verify-claims
```

It performs, in order:

1. Reads `getVersionInfo` and `getNetwork` **live**.
2. If the live node/protocol version differs from the recorded one, **every row is `superseded`** —
   regardless of what it says. A claim about a version that is no longer live cannot be confirmed.
3. Otherwise, re-probes every recorded method and compares the live classification to the recorded
   `supported` value, yielding:

| Verdict | Meaning | Blocks publishing? |
|---|---|---|
| `current` | recorded value matches a fresh measurement | no |
| `stale` | the node's behaviour moved at the same version | **yes** |
| `superseded` | a different version answered | **yes** |
| `unreachable` | the endpoint could not be contacted | **yes** |

4. Exits **2** if any row blocks. The output says, in words, **"DO NOT PUBLISH from this run."**

## 4. A worked example (and why it matters)

Running `--verify-claims` for the first time produced this:

```
UNREACHABLE getTransaction       recorded=supported live=unreachable
UNREACHABLE getEvents            recorded=supported live=unreachable
```

Those two methods **do exist**. They had simply been **left out of the probe list**, so the verifier
had no live reading for them and — correctly, but for the wrong reason — refused to confirm them.
The fix was to **probe every recorded method**, and a test now enforces that the probe list and the
recorded surface are the **same length**, so a method can never be silently unverified again.

**This is the point of the command.** It is not a formality: on its first run it found a real
inconsistency between what the repository claimed and what it had actually measured.

## 5. What a passing run does and does not mean

| `--verify-claims` passing says | It does **not** say |
|---|---|
| every recorded row matches a measurement taken now | that the behaviour will hold tomorrow |
| the claims are true of **this endpoint at this version** | that another endpoint behaves the same |
| the run is fit to draw conclusions from | that the conclusions are about "Pi's RPC in general" |

The last column is why the output ends by naming the scope explicitly rather than declaring success.

## 6. Reproduce

```bash
node sim.mjs --verify-claims     # live; exit 2 if any claim is not current
node test/run.mjs                # offline; asserts the rules above
```
