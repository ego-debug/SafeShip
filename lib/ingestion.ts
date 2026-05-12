import "server-only";
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

export type IngestPayload = {
  run?: IngestRun;
  steps?: IngestStep[];
};

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
