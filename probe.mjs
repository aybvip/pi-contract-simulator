// probe.mjs — READ-ONLY probes against the Pi Testnet Soroban RPC.
//
// Rules, enforced by test/sim.test.mjs:
//   - POST reads only. No signing, no submission, no broadcast.
//   - Every network call is time-boxed with AbortController.
//   - No API keys, tokens, or credentials are read or sent.
//   - Where a probe cannot reach the endpoint, that IS the measurement.

const TESTNET_RPC = "https://rpc.testnet.minepi.com";
const MAINNET_RPC = "https://rpc.mainnet.minepi.com";
const TIMEOUT_MS = 15000;

/**
 * Time-boxed JSON-RPC call. Returns a classified result and never throws.
 * The classification is the whole point: it separates a transport failure, a
 * JSON-RPC error, an in-result error, and a success.
 */
export async function rpcCall(endpoint, method, params = {}, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return { transport: res.ok ? "http-ok" : "http-error", status: res.status, json, text, method, endpoint };
  } catch (e) {
    return { transport: "unreachable", status: null, json: null, text: null, error: e.message, method, endpoint };
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// P1 — the RPC surface: which methods does the node actually answer?
// ---------------------------------------------------------------------------

/** Methods a simulator needs, and the minimal probe params for each. */
export const SURFACE_PROBES = [
  { name: "getHealth", params: {} },
  { name: "getNetwork", params: {} },
  { name: "getLatestLedger", params: {} },
  { name: "getVersionInfo", params: {} },
  { name: "getFeeStats", params: {} },
  { name: "getLedgerEntries", params: { keys: [] } },
  { name: "simulateTransaction", params: {} },
  { name: "getContractData", params: {} },
];

/** Classify a raw rpcCall result into a support verdict. */
export function classifySupport(result) {
  if (result.transport === "unreachable") return "unreachable";
  const code = result.json?.error?.code;
  if (code === -32601) return "method-absent";
  if (result.json?.error) return "supported-validation-error";
  if (result.json?.result !== undefined) return "supported";
  return "unexpected-shape";
}

export async function probeSurface(endpoint = TESTNET_RPC, timeoutMs = TIMEOUT_MS) {
  const rows = [];
  for (const p of SURFACE_PROBES) {
    const r = await rpcCall(endpoint, p.name, p.params, timeoutMs);
    rows.push({
      method: p.name,
      classification: classifySupport(r),
      code: r.json?.error?.code ?? null,
      message: r.json?.error?.message ?? null,
      resultKeys: r.json?.result && typeof r.json.result === "object" ? Object.keys(r.json.result) : null,
    });
  }
  return { endpoint, rows };
}

// ---------------------------------------------------------------------------
// P2 — the failure shapes, reproduced one by one
// ---------------------------------------------------------------------------

export async function probeFailureShapes(endpoint = TESTNET_RPC, timeoutMs = TIMEOUT_MS) {
  const shapes = [];
  {
    const r = await rpcCall(endpoint, "simulateTransaction", {}, timeoutMs);
    shapes.push({
      id: "F1", trigger: "simulateTransaction with no transaction field",
      transport: `${r.transport} (HTTP ${r.status})`,
      rpcError: r.json?.error ?? null,
      result: r.json?.result ?? null,
      verdict: r.json?.error ? "jsonrpc-error" : r.json?.result?.error ? "in-result-error" : "none",
    });
  }
  {
    const r = await rpcCall(endpoint, "getLedgerEntries", { keys: ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="] }, timeoutMs);
    shapes.push({
      id: "F2", trigger: "getLedgerEntries for an absent key",
      transport: `${r.transport} (HTTP ${r.status})`,
      rpcError: r.json?.error ?? null,
      result: r.json?.result ?? null,
      verdict: Array.isArray(r.json?.result?.entries) ? `absent-not-error (entries=${r.json.result.entries.length})` : "check",
    });
  }
  {
    const r = await rpcCall(endpoint, "getLedgerEntries", { keys: [] }, timeoutMs);
    shapes.push({
      id: "F3", trigger: "getLedgerEntries with keys: []",
      transport: `${r.transport} (HTTP ${r.status})`,
      rpcError: r.json?.error ?? null,
      result: r.json?.result ?? null,
      verdict: r.json?.error?.code === -32603 ? "validation-error" : "check",
    });
  }
  {
    const r = await rpcCall(endpoint, "getContractData", {}, timeoutMs);
    shapes.push({
      id: "F4", trigger: "an unsupported method (getContractData)",
      transport: `${r.transport} (HTTP ${r.status})`,
      rpcError: r.json?.error ?? null,
      result: r.json?.result ?? null,
      verdict: r.json?.error?.code === -32601 ? "method-absent" : "check",
    });
  }
  {
    const r = await rpcCall(endpoint, "getEvents", { startLedger: 0 }, timeoutMs);
    shapes.push({
      id: "F5", trigger: "getEvents with a non-positive startLedger",
      transport: `${r.transport} (HTTP ${r.status})`,
      rpcError: r.json?.error ?? null,
      result: r.json?.result ?? null,
      verdict: r.json?.error?.code === -32602 ? "validation-error" : "check",
    });
  }
  return { endpoint, shapes };
}

// ---------------------------------------------------------------------------
// P3 — Mainnet RPC reachability (the reason this tool is Testnet-only)
// ---------------------------------------------------------------------------

export async function probeMainnet(endpoint = MAINNET_RPC, timeoutMs = TIMEOUT_MS) {
  const r = await rpcCall(endpoint, "getHealth", {}, timeoutMs);
  return {
    endpoint,
    transport: r.transport,
    status: r.status,
    error: r.error ?? null,
    verdict: r.transport === "unreachable"
      ? "not reachable — this is why the simulator is Testnet-only"
      : `reachable (HTTP ${r.status}) — update the repo if this changed`,
  };
}

// ---------------------------------------------------------------------------
// P4 — node identity, so two runs can be compared honestly
// ---------------------------------------------------------------------------

export async function probeIdentity(endpoint = TESTNET_RPC, timeoutMs = TIMEOUT_MS) {
  const [net, ver, health] = await Promise.all([
    rpcCall(endpoint, "getNetwork", {}, timeoutMs),
    rpcCall(endpoint, "getVersionInfo", {}, timeoutMs),
    rpcCall(endpoint, "getHealth", {}, timeoutMs),
  ]);
  return {
    endpoint,
    passphrase: net.json?.result?.passphrase ?? null,
    protocolVersion: net.json?.result?.protocolVersion ?? null,
    nodeVersion: ver.json?.result?.version ?? null,
    captiveCoreVersion: ver.json?.result?.captiveCoreVersion ?? null,
    latestLedger: health.json?.result?.latestLedger ?? null,
    retentionWindow: health.json?.result?.ledgerRetentionWindow ?? null,
  };
}

export async function runAllProbes() {
  return {
    identity: await probeIdentity(),
    surface: await probeSurface(),
    failures: await probeFailureShapes(),
    mainnet: await probeMainnet(),
  };
}

export const ENDPOINTS = { testnetRpc: TESTNET_RPC, mainnetRpc: MAINNET_RPC };

// Allow direct execution: node probe.mjs
if (process.argv[1]?.endsWith("probe.mjs")) {
  const p = await runAllProbes();
  console.log("=== IDENTITY ===");
  console.log(JSON.stringify(p.identity, null, 2));
  console.log("\n=== RPC SURFACE ===");
  for (const r of p.surface.rows) console.log(`  ${r.method.padEnd(20)} ${r.classification}${r.code != null ? ` (${r.code})` : ""}`);
  console.log("\n=== FAILURE SHAPES ===");
  for (const s of p.failures.shapes) console.log(`  ${s.id} ${s.verdict} — ${s.trigger}`);
  console.log("\n=== MAINNET RPC ===");
  console.log("  " + p.mainnet.verdict);
  console.log("\nnote: every probe above is read-only; nothing was signed or submitted.");
}
