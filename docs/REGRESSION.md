# Regression testing — comparing two runs honestly

A simulator is most useful **after** a change, when you want to know whether behaviour moved. That
comparison is easy to do badly. This page states the rules this tool follows.

---

## 1. What a snapshot contains

`node sim.mjs --snapshot run.json` writes a snapshot with:

| Field | Why it is there |
|---|---|
| `generatedAt` | when the run happened |
| `endpoint` | which RPC was contacted |
| `passphrase`, `protocolVersion`, `nodeVersion` | the environment, without which nothing is comparable |
| `latestLedger` | the point in chain history |
| `cases[]` | each case's `key`, `trigger`, and **verdict only** |
| `disclaimer` | the limits of what a snapshot means |

A snapshot **deliberately does not store fee or gas numbers.** They are not comparable across ledgers:
the same call on ledger N and ledger N+1000 can legitimately differ, so comparing them produces false
alarms. This is enforced by the test suite.

## 2. The comparison rules

`node sim.mjs --compare before.json after.json` applies, in order:

1. **Node version first.** If the node version or protocol version changed, that is printed **before**
   any verdict difference, with a warning that the differences below may simply be an upgrade.
2. **Verdicts and error strings only.** Never fee numbers.
3. **A move to `unreachable` is a regression signal.** It is counted separately, because it means the
   run could not be completed — a different thing from a case that ran and behaved differently.

## 3. What a comparison may and may not claim

| A comparison says | A comparison does **not** say |
|---|---|
| the verdict for these cases changed (or did not) | that the contract became correct or incorrect |
| the environment changed between runs | that any change is caused by the code under test |
| a case could not be reached in the later run | that it would fail on-chain |

The last row of the second column is the reason `unreachable` is a distinct verdict and not folded
into "failure".

## 3. Using it in CI (GitHub Actions or any CI)

```bash
# 1. capture a baseline once, and commit it
node sim.mjs --snapshot baseline.json

# 2. on each change, capture again and compare
node sim.mjs --snapshot current.json
node sim.mjs --compare baseline.json current.json
```

A non-zero exit is **not** produced for changes by default: a changed verdict may be an upgrade, a
real fix, or a new problem, and the tool does not pretend to know which. Read the output; the node
version line tells you where to start.

> **Why no automatic pass/fail?** Because "the verdict changed" is not the same as "you broke
> something". A tool that fails a pipeline on any difference trains people to ignore it.

## 4. Reproduce

```bash
node sim.mjs --identity     # what to record
node test/run.mjs           # the regression logic, asserted offline
```
