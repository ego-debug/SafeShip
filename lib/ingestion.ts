import "server-only";
import { alertOnFailedRun } from "./alerts";
import { getServiceSupabase } from "./supabase";

export type IngestStep = {
  step_index?: number;
  tool_name?: string | null;
  kind?: "llm" | "tool" | "retry" | null;
  input?: unknown;
  output?: unknown;
  duration_ms?: number | null;
  status?: "ok" | "warn" | "fail" | null;
};

export type IngestRun = {
  trigger?: "deploy" | "production" | "scheduled" | "manual";
  score?: number | null;
  status?: "ok" | "warn" | "fail";
  started_at?: string | null;
  duration_ms?: number | null;
  model?: string | null;
};

export type CachedLLMCall = {
  index: number;
  host: string;
  method: string;
  path: string;
  request_body: string; // base64
  request_hash: string;
  response_status: number;
  response_body: string; // base64
  response_headers?: Record<string, string>;
  duration_ms?: number;
};

export type IngestPayload = {
  run?: IngestRun;
  steps?: IngestStep[];
  cached_llm_calls?: CachedLLMCall[];
};

// Phase 3 cache size safety net. Bigger than any realistic agent run,
// smaller than "leaked-key-flooding-bytes." Truncates rather than rejects
// so a chatty agent doesn't silently lose its trace.
const MAX_CACHED_CALLS = 200;
const MAX_CACHED_BYTES = 1024 * 1024; // 1 MB total per run

function sanitizeCachedCalls(input: unknown): CachedLLMCall[] | null {
  if (!Array.isArray(input)) return null;
  const out: CachedLLMCall[] = [];
  let totalBytes = 0;
  for (const raw of input.slice(0, MAX_CACHED_CALLS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const reqBody = typeof r.request_body === "string" ? r.request_body : "";
    const respBody = typeof r.response_body === "string" ? r.response_body : "";
    const entryBytes = reqBody.length + respBody.length;
    if (totalBytes + entryBytes > MAX_CACHED_BYTES) break;
    totalBytes += entryBytes;
    out.push({
      index: typeof r.index === "number" ? r.index : out.length,
      host: typeof r.host === "string" ? r.host : "",
      method: typeof r.method === "string" ? r.method : "POST",
      path: typeof r.path === "string" ? r.path : "",
      request_body: reqBody,
      request_hash: typeof r.request_hash === "string" ? r.request_hash : "",
      response_status:
        typeof r.response_status === "number" ? r.response_status : 0,
      response_body: respBody,
      response_headers:
        r.response_headers && typeof r.response_headers === "object"
          ? (r.response_headers as Record<string, string>)
          : undefined,
      duration_ms:
        typeof r.duration_ms === "number" ? r.duration_ms : undefined,
    });
  }
  return out.length > 0 ? out : null;
}

export type IngestResult = {
  run_id: string;
  steps: number;
};

const ALLOWED_TRIGGERS = new Set(["deploy", "production", "scheduled", "manual"]);
const ALLOWED_STATUSES = new Set(["ok", "warn", "fail"]);

/**
 * Insert a run + its trace steps for a project. Stamps the project's
 * first_trace_at on first ingestion so onboarding flips to success.
 *
 * Throws on validation errors with a short machine-readable message
 * suitable for returning to API callers.
 */
export async function ingestRun(
  projectId: string,
  payload: IngestPayload,
): Promise<IngestResult> {
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  if (steps.length === 0) {
    throw new Error("missing_steps");
  }
  if (steps.length > 200) {
    throw new Error("too_many_steps");
  }

  const run = payload.run ?? {};
  const trigger = run.trigger && ALLOWED_TRIGGERS.has(run.trigger)
    ? run.trigger
    : "production";
  const runStatus = run.status && ALLOWED_STATUSES.has(run.status)
    ? run.status
    : "ok";

  const cachedLLMCalls = sanitizeCachedCalls(payload.cached_llm_calls);

  const supabase = getServiceSupabase();

  const { data: createdRun, error: runErr } = await supabase
    .from("runs")
    .insert({
      project_id: projectId,
      trigger,
      score: typeof run.score === "number" ? run.score : null,
      status: runStatus,
      started_at: run.started_at ?? new Date().toISOString(),
      duration_ms: typeof run.duration_ms === "number" ? run.duration_ms : null,
      model: run.model ?? null,
      cached_llm_calls: cachedLLMCalls,
    })
    .select("id")
    .single();

  if (runErr || !createdRun) {
    throw new Error(`run_insert_failed: ${runErr?.message}`);
  }

  const traceRows = steps.map((s, i) => ({
    run_id: createdRun.id,
    step_index: typeof s.step_index === "number" ? s.step_index : i + 1,
    tool_name: s.tool_name ?? null,
    kind: s.kind ?? null,
    input: s.input ?? null,
    output: s.output ?? null,
    duration_ms: typeof s.duration_ms === "number" ? s.duration_ms : null,
    status: s.status ?? "ok",
  }));

  const { error: tracesErr } = await supabase.from("traces").insert(traceRows);
  if (tracesErr) {
    throw new Error(`traces_insert_failed: ${tracesErr.message}`);
  }

  // Stamp first_trace_at on first ingestion (no-op afterwards)
  await supabase
    .from("projects")
    .update({ first_trace_at: new Date().toISOString() })
    .eq("id", projectId)
    .is("first_trace_at", null);

  // Fire-and-forget alert dispatch for failed runs. Awaiting would block
  // the ingest response on Resend/Slack latency, so we deliberately don't
  // — alertOnFailedRun swallows every error internally.
  if (runStatus === "fail") {
    const ctx = {
      projectId,
      runId: createdRun.id as string,
      runStatus: "fail" as const,
      durationMs: typeof run.duration_ms === "number" ? run.duration_ms : null,
      triggeredAt: run.started_at ?? new Date().toISOString(),
    };
    void alertOnFailedRun(ctx);
  }

  return { run_id: createdRun.id, steps: traceRows.length };
}

/**
 * Look up the project that owns a given `sk_live_*` API key. Returns null
 * if not found. Constant-time enough for our scale; we'll add proper
 * timing safety if/when we ship public ingestion at volume.
 */
export async function projectByApiKey(apiKey: string) {
  if (!apiKey.startsWith("sk_live_")) return null;
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id, name, environment, first_trace_at")
    .eq("api_key", apiKey)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
