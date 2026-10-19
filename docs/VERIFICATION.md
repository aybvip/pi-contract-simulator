# Verification — reproduce every claim yourself

Two kinds of check: **offline** (the tool's invariants) and **live** (the measured surface).

---

## 0. Requirements

```bash
node --version   # expect v20 or newer
```

No dependencies. Nothing to install.

## 1. Offline — the invariants

```bash
node test/run.mjs
```

Runs with **no network**. It asserts, among others:

- no forbidden operation (`signTransaction`, `submitTransaction`, …) exists in any source file;
- the probe builds no `Authorization` header and reads no key material;
- every network call is time-boxed with `AbortController`;
- the classifier maps each measured failure shape to the right verdict — **including the trap**:
  an in-result `error` is an `envelope-error`, never a success;
- an empty entry set classifies as `absent-not-error`, never as a failure;
- every verdict lists what it does **not** mean, and `simulated-ok` explicitly disclaims on-chain
  success;
- regression comparison reports a node-version change first, and stores no fee numbers;
- no document **asserts** a forbidden claim (quotation and denial are allowed — the guard
  distinguishes them).

## 2. The verdict model, offline

```bash
node sim.mjs --verdicts      # each verdict and what it does NOT mean
node sim.mjs --report F1     # one failure shape rendered as a developer report
node sim.mjs --boundaries    # what this tool refuses to do
```

## 3. Live — the read-only probes

```bash
node sim.mjs --surface       # which RPC methods the node answers
node sim.mjs --identity      # node version / protocol / ledger
node sim.mjs --failures      # the five measured failure shapes
node sim.mjs --mainnet       # Mainnet reachability (expected: not reachable)
node sim.mjs --probe         # all of the above
```

Expected shape (values move with the network; the **classifications** are the point):

| Probe | What to look for |
|---|---|
| surface | `simulateTransaction` and `getLedgerEntries` **supported**; `getContractData` **method-absent (-32601)** |
| identity | `passphrase: Pi Testnet`, `protocolVersion: 28`, a node version |
| failures | F1 = **in-result error over HTTP 200**; F2 = **`entries: []`, no error**; F3/F5 = validation codes; F4 = `-32601` |
| mainnet | **not reachable** |

## 4. Regression, offline

```bash
node sim.mjs --snapshot before.json
# ... change something, or wait ...
node sim.mjs --snapshot after.json
node sim.mjs --compare before.json after.json
```

## 5. What you should **not** find

- Any write, sign, submit, or broadcast call.
- Any credential, key, token, or API key.
- Any personal data.
- Any claim that a simulation guarantee's on-chain success.
- Any unlabelled claim: every statement is measured, documented, external, or not-claimed.

If any of these appear, this repository has violated its own rules — and `node test/run.mjs` should
be failing.
