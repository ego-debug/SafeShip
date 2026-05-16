import "server-only";
import { getServiceSupabase } from "./supabase";
import { getRunForUser } from "./runs";
import { suggestFromRun, isSuggestEngineConfigured } from "./suggest";
import { checkSuggestRateLimit, RateLimitError } from "./rateLimit";

export type PendingSuggestion = {
  id: string;
  project_id: string;
  trace_id: string | null;
  run_id: string | null;
  name: string;
  plain_english: string;
  code_yaml: string;
  severity: "low" | "medium" | "high" | null;
  rationale: string | null;
  created_at: string;
};

export type AcceptedTest = {
  id: string;
  name: string;
  plain_english: string | null;
  code_yaml: string | null;
  created_at: string;
};

export type SuggestionsSummary = {
  pending: PendingSuggestion[];
  pendingTotal: number;
  acceptedToday: number;
  recentlyAccepted: AcceptedTest[];
  engineConfigured: boolean;
};

const DAY_MS = 86_400_000;

export async function getSuggestionsSummary(
  userId: string,
): Promise<SuggestionsSummary | null> {
  const supabase = getServiceSupabase();

  // Get the user's default project id
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!project) return null;

  const since = new Date(Date.now() - DAY_MS).toISOString();

  const [pendingRes, pendingCountRes, todayCountRes, recentRes] = await Promise.all([
    supabase
      .from("suggested_tests")
      .select(
        "id, project_id, trace_id, name, plain_english, code_yaml, severity, rationale, created_at, run_id",
      )
      .eq("project_id", project.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("suggested_tests")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("status", "pending"),
    supabase
      .from("suggested_tests")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("status", "accepted")
      .gte("created_at", since),
    supabase
      .from("tests")
      .select("id, name, plain_english, code_yaml, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    pending: (pendingRes.data ?? []) as PendingSuggestion[],
    pendingTotal: pendingCountRes.count ?? 0,
    acceptedToday: todayCountRes.count ?? 0,
    recentlyAccepted: (recentRes.data ?? []) as AcceptedTest[],
    engineConfigured: isSuggestEngineConfigured(),
  };
}

export type GenerateResult = {
  generated: number;
  skipped: number;
  errors: number;
  rateLimited: number;
  retry_after_seconds?: number;
  reason?: "engine_not_configured" | "no_project" | "no_candidates";
};

/**
 * Scan the user's failed runs for those without a suggestion yet, generate
 * one each via the auto-suggest engine, and store them as 'pending' rows.
 * Idempotent — runs that already have a pending or accepted suggestion are
 * skipped. Hard-caps to `limit` runs per call so a backlog doesn't burn
 * through quota.
 */
export async function generateSuggestionsForUser(
  userId: string,
  limit = 5,
): Promise<GenerateResult> {
  if (!isSuggestEngineConfigured()) {
    return { generated: 0, skipped: 0, errors: 0, rateLimited: 0, reason: "engine_not_configured" };
  }

  const supabase = getServiceSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!project) {
    return { generated: 0, skipped: 0, errors: 0, rateLimited: 0, reason: "no_project" };
  }

  // Find failing runs that don't yet have any suggestion (pending or accepted)
  const { data: candidates } = await supabase
    .from("runs")
    .select("id")
    .eq("project_id", project.id)
    .in("status", ["fail", "warn"])
    .order("started_at", { ascending: false })
    .limit(50);

  if (!candidates || candidates.length === 0) {
    return { generated: 0, skipped: 0, errors: 0, rateLimited: 0, reason: "no_candidates" };
  }

  const runIds = candidates.map((r) => r.id as string);

  // Filter out runs that already have a non-skipped suggestion
  const { data: existing } = await supabase
    .from("suggested_tests")
    .select("run_id")
    .eq("project_id", project.id)
    .in("status", ["pending", "accepted"])
    .in("run_id", runIds);

  const taken = new Set((existing ?? []).map((r) => (r as { run_id: string }).run_id));
  const todo = runIds.filter((id) => !taken.has(id)).slice(0, limit);

  let generated = 0;
  let errors = 0;
  let rateLimited = 0;
  let retryAfter: number | undefined;

  for (const runId of todo) {
    // Per-project rate limit — bail out of the loop (not skip) since every
    // subsequent attempt in this batch would hit the same limit.
    const rl = await checkSuggestRateLimit(project.id);
    if (!rl.ok) {
      rateLimited = todo.length - (generated + errors);
      retryAfter = rl.retry_after_seconds;
      break;
    }

    try {
      const run = await getRunForUser(userId, runId);
      if (!run) continue;
      const suggestion = await suggestFromRun(run);

      await supabase.from("suggested_tests").insert({
        project_id: project.id,
        run_id: runId,
        trace_id: run.steps.find((s) => s.status === "fail")?.id ?? null,
        name: suggestion.name,
        plain_english: suggestion.plain_english,
        code_yaml: suggestion.code_yaml,
        severity: suggestion.severity,
        rationale: suggestion.rationale,
        status: "pending",
      });

      generated++;
    } catch (e) {
      errors++;
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[suggest] failed for run ${runId}:`, e);
      }
    }
  }

  return {
    generated,
    skipped: runIds.length - todo.length,
    rateLimited,
    retry_after_seconds: retryAfter,
    errors,
  };
}

/**
 * Accept a pending suggestion: copy it into the `tests` table as an active
 * test, mark the suggestion as 'accepted'. Returns the new test id.
 * Throws on not-found / not-owned (handled at the API layer as 404).
 */
export async function acceptSuggestion(
  userId: string,
  suggestionId: string,
): Promise<{ test_id: string }> {
  const supabase = getServiceSupabase();

  const { data: suggestion } = await supabase
    .from("suggested_tests")
    .select(
      "id, project_id, run_id, name, plain_english, code_yaml, status, projects!inner(user_id)",
    )
    .eq("id", suggestionId)
    .maybeSingle();

  type Row = {
    id: string;
    project_id: string;
    run_id: string | null;
    name: string;
    plain_english: string | null;
    code_yaml: string | null;
    status: string;
    projects:
      | { user_id: string }
      | Array<{ user_id: string }>
      | null;
  };
  const row = suggestion as unknown as Row | null;
  if (!row) throw new Error("not_found");
  const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
  if (!project || project.user_id !== userId) throw new Error("not_found");
  if (row.status !== "pending") throw new Error("not_pending");

  // Pull the top-level input from the originating run so the CI test runner
  // can replay it. step_index=0 is the synthesized "agent" step when the
  // customer didn't add explicit safeship.step() calls; its `input` field
  // is the {args, kwargs} payload our SDK records. For runs with explicit
  // steps we just take whatever's at index 0 — the runner falls back to
  // single-positional-arg invocation if it's not in {args, kwargs} shape.
  // We also pull the Phase 3 cached_llm_calls so the runner can replay
  // Anthropic/OpenAI calls without spending real LLM tokens in CI.
  let replayInput: unknown = null;
  let cachedLLMCalls: unknown = null;
  if (row.run_id) {
    const [firstStepRes, runRes] = await Promise.all([
      supabase
        .from("traces")
        .select("input")
        .eq("run_id", row.run_id)
        .order("step_index", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("runs")
        .select("cached_llm_calls")
        .eq("id", row.run_id)
        .maybeSingle(),
    ]);
    replayInput =
      (firstStepRes.data as { input?: unknown } | null)?.input ?? null;
    cachedLLMCalls =
      (runRes.data as { cached_llm_calls?: unknown } | null)?.cached_llm_calls ??
      null;
  }

  const { data: created, error: insertErr } = await supabase
    .from("tests")
    .insert({
      project_id: row.project_id,
      name: row.name,
      plain_english: row.plain_english,
      code_yaml: row.code_yaml,
      status: "active",
      replay_input: replayInput,
      origin_run_id: row.run_id,
      cached_llm_calls: cachedLLMCalls,
    })
    .select("id")
    .single();

  if (insertErr || !created) {
    throw new Error(`test_insert_failed: ${insertErr?.message}`);
  }

  await supabase
    .from("suggested_tests")
    .update({ status: "accepted" })
    .eq("id", row.id);

  return { test_id: created.id };
}

export async function skipSuggestion(
  userId: string,
  suggestionId: string,
): Promise<void> {
  const supabase = getServiceSupabase();

  const { data: suggestion } = await supabase
    .from("suggested_tests")
    .select("id, status, projects!inner(user_id)")
    .eq("id", suggestionId)
    .maybeSingle();

  type Row = {
    id: string;
    status: string;
    projects: { user_id: string } | Array<{ user_id: string }> | null;
  };
  const row = suggestion as unknown as Row | null;
  if (!row) throw new Error("not_found");
  const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
  if (!project || project.user_id !== userId) throw new Error("not_found");
  if (row.status !== "pending") throw new Error("not_pending");

  await supabase
    .from("suggested_tests")
    .update({ status: "skipped" })
    .eq("id", row.id);
}

/**
 * One-shot: generate a single suggestion from a specific run (used by the
 * Trace Detail "Add to regression suite" button).
 */
export async function suggestFromRunId(
  userId: string,
  runId: string,
): Promise<{ suggestion_id: string }> {
  if (!isSuggestEngineConfigured()) {
    throw new Error("engine_not_configured");
  }
  const run = await getRunForUser(userId, runId);
  if (!run) throw new Error("not_found");

  const supabase = getServiceSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", run.project_id)
    .maybeSingle();
  if (!project) throw new Error("not_found");

  const rl = await checkSuggestRateLimit(run.project_id);
  if (!rl.ok) throw new RateLimitError(rl);

  const suggestion = await suggestFromRun(run);

  const { data: created, error } = await supabase
    .from("suggested_tests")
    .insert({
      project_id: run.project_id,
      run_id: runId,
      trace_id: run.steps.find((s) => s.status === "fail")?.id ?? null,
      name: suggestion.name,
      plain_english: suggestion.plain_english,
      code_yaml: suggestion.code_yaml,
      severity: suggestion.severity,
      rationale: suggestion.rationale,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`suggestion_insert_failed: ${error?.message}`);
  }

  return { suggestion_id: created.id };
}
