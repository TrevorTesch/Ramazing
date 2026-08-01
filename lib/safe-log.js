// Minimal safe logger: no request/response bodies, only metadata
export function safeLog(level, meta = {}) {
  // meta: { route, upstream, status, latencyMs, bytes, errorCode }
  const allowed = {};
  for (const k of ['route','upstream','status','latencyMs','bytes','errorCode']) {
    if (meta[k] !== undefined) allowed[k] = meta[k];
  }
  const out = { level, ...allowed, ts: new Date().toISOString() };
  // Single-line JSON output
  console.log(JSON.stringify(out));
}
