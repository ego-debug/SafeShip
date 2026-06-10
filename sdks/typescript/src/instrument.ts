/** Auto-instrumentation: patch globalThis.fetch so calls to known LLM
 * provider hosts are recorded as steps on the in-flight run, with zero
 * changes to the customer's code. The official Anthropic and OpenAI
 * Node SDKs use fetch under the hood (Node 18+), so they're captured.
 *
 * Rules:
 * - only records while inside a wrap()ed invocation (no global buffering)
 * - non-provider traffic passes through completely untouched
 * - streaming responses (text/event-stream) are recorded as a step with
 *   the request captured but the body marked as streaming; we never
 *   consume a stream the customer is about to read
 * - any internal error falls back to the original fetch; the customer's
 *   HTTP call always proceeds
 */

import { currentContext } from "./context.js";
import { safe } from "./safe.js";

const PROVIDER_HOSTS = new Set(["api.anthropic.com", "api.openai.com"]);

type FetchType = typeof globalThis.fetch;

let originalFetch: FetchType | null = null;

export function installInstrumentation(): void {
  if (originalFetch != null) return; // already installed
  if (typeof globalThis.fetch !== "function") return;
  originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = instrumentedFetch as FetchType;
}

export function uninstallInstrumentation(): void {
  if (originalFetch != null) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}

async function instrumentedFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const base = originalFetch ?? globalThis.fetch;

  let host = "";
  try {
    host = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : input.url,
    ).hostname.toLowerCase();
  } catch {
    return base(input, init);
  }

  const ctx = currentContext();
  if (!ctx || !PROVIDER_HOSTS.has(host)) {
    return base(input, init);
  }

  // Capture the request body without consuming anything the caller needs.
  let requestJson: unknown = null;
  try {
    if (typeof init?.body === "string") {
      requestJson = JSON.parse(init.body);
    } else if (input instanceof Request) {
      requestJson = JSON.parse(await input.clone().text());
    }
  } catch {
    requestJson = null;
  }

  const t0 = Date.now();
  let response: Response;
  try {
    response = await base(input, init);
  } catch (err) {
    recordProviderStep(ctx, host, requestJson, "(network error)", Date.now() - t0, "fail");
    throw err;
  }

  try {
    const durationMs = Date.now() - t0;
    const contentType = response.headers.get("content-type") ?? "";
    let output: unknown;
    if (contentType.includes("text/event-stream")) {
      output = "(streaming response; body not captured)";
    } else {
      // clone() so the customer's SDK can still read the body.
      const text = await response.clone().text();
      try {
        output = extractOutput(JSON.parse(text));
      } catch {
        output = text.slice(0, 2000);
      }
    }
    recordProviderStep(
      ctx,
      host,
      requestJson,
      output,
      durationMs,
      response.ok ? "ok" : "fail",
    );
  } catch {
    // recording is best-effort; the response is returned regardless
  }
  return response;
}

function recordProviderStep(
  ctx: { steps: Array<Record<string, unknown>> } | { steps: unknown[] },
  host: string,
  requestJson: unknown,
  output: unknown,
  durationMs: number,
  status: "ok" | "fail",
): void {
  const model =
    requestJson && typeof requestJson === "object"
      ? (requestJson as { model?: unknown }).model
      : undefined;
  (ctx.steps as Array<Record<string, unknown>>).push({
    tool_name: typeof model === "string" ? model : host,
    kind: "llm",
    input: safe(requestJson),
    output: safe(output),
    duration_ms: durationMs,
    status,
  });
}

/** Pull the human-relevant text out of a provider response so the
 * dashboard shows the reply, not a wall of metadata. Falls back to the
 * full (size-capped) body for unknown shapes. */
function extractOutput(body: unknown): unknown {
  if (body == null || typeof body !== "object") return body;
  const b = body as Record<string, unknown>;

  // Anthropic Messages API: { content: [{type:"text", text:"..."}], usage }
  if (Array.isArray(b.content)) {
    const texts = (b.content as Array<Record<string, unknown>>)
      .filter((c) => c && c.type === "text" && typeof c.text === "string")
      .map((c) => c.text);
    if (texts.length > 0) {
      return { text: texts.join("\n"), usage: b.usage ?? undefined };
    }
  }

  // OpenAI Chat Completions: { choices: [{message:{content}}], usage }
  if (Array.isArray(b.choices)) {
    const first = (b.choices as Array<Record<string, unknown>>)[0];
    const msg = first?.message as Record<string, unknown> | undefined;
    if (msg && typeof msg.content === "string") {
      return { text: msg.content, usage: b.usage ?? undefined };
    }
  }

  return body;
}
