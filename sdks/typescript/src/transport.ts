/** Fire-and-forget trace delivery.
 *
 * Traces are POSTed in the background; the wrapped agent call returns the
 * moment the agent returns. On serverless platforms (Vercel, Lambda) the
 * runtime can freeze the process right after the response is sent, so
 * handlers should `await safeship.flush()` before returning (or hand
 * `flush()` to the platform's waitUntil). Documented in the README.
 *
 * Reliability rules, mirrored from the Python SDK:
 * - never throws into the agent path
 * - retries 5xx/429 with capped backoff, drops permanent 4xx
 * - per-request timeout so a dead ingest can't pin the process
 */

import { debugLog, getConfig } from "./config.js";

const MAX_RETRIES = 3;
const BACKOFF_MS = [250, 1000, 3000];

const inflight = new Set<Promise<void>>();

export function enqueue(payload: unknown): void {
  const cfg = getConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    debugLog("trace dropped: SDK disabled or no apiKey");
    return;
  }
  const p = deliver(payload)
    .catch((err) => debugLog("trace delivery failed:", err))
    .finally(() => {
      inflight.delete(p);
    });
  inflight.add(p);
}

/** Await all in-flight trace deliveries. Safe to call repeatedly. */
export async function flush(): Promise<void> {
  while (inflight.size > 0) {
    await Promise.allSettled([...inflight]);
  }
}

async function deliver(payload: unknown): Promise<void> {
  const cfg = getConfig();
  const body = JSON.stringify(payload);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetchWithTimeout(cfg.endpoint, body, cfg.apiKey!, cfg.timeoutMs);
      if (resp.ok) return;
      // Retry transient failures; drop permanent client errors.
      if (resp.status === 429 || resp.status >= 500) {
        debugLog(`ingest returned ${resp.status}, attempt ${attempt + 1}`);
      } else {
        debugLog(`ingest rejected trace (${resp.status}), dropping`);
        return;
      }
    } catch (err) {
      debugLog(`ingest unreachable, attempt ${attempt + 1}:`, err);
    }
    if (attempt < MAX_RETRIES) {
      await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
    }
  }
  debugLog("trace dropped after retries");
}

function fetchWithTimeout(
  url: string,
  body: string,
  apiKey: string,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
