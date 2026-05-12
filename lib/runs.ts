import "server-only";
import { getServiceSupabase } from "./supabase";

export type RunDetailStep = {
  id: string;
  step_index: number;
  tool_name: string | null;
  kind: string | null;
  duration_ms: number | null;
  status: string | null;
  input: unknown;
  output: unknown;
};

export type RunDetail = {
  id: string;
  trigger: string;
  score: number | null;
  status: string;
  started_at: string;
  duration_ms: number | null;
  model: string | null;
  project_id: string;
  project_name: string;
  project_environment: string;
  steps: RunDetailStep[];
};

/**
 * Load a single run + its trace steps, verifying the caller (Clerk userId)
 * owns the project the run belongs to. Returns null if not found OR not
 * owned, so callers can render a single 404 regardless.
 */
export async function getRunForUser(
  userId: string,
  runId: string,
): Promise<RunDetail | null> {
  if (!isUuid(runId)) return null;

  const supabase = getServiceSupabase();

  const { data: run, error: runErr } = await supabase
    .from("runs")
    .select(
      "id, trigger, score, status, started_at, duration_ms, model, project_id, projects!inner(user_id, name, environment)",
    )
    .eq("id", runId)
    .maybeSingle();

  if (runErr || !run) return null;

  type RunRow = {
    id: string;
    trigger: string;
    score: number | null;
    status: string;
    started_at: string;
    duration_ms: number | null;
    model: string | null;
    project_id: string;
    projects:
      | { user_id: string; name: string; environment: string }
      | Array<{ user_id: string; name: string; environment: string }>;
  };
  const r = run as unknown as RunRow;
  const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;

  if (!project || project.user_id !== userId) return null;

  const { data: traces, error: tracesErr } = await supabase
    .from("traces")
    .select("id, step_index, tool_name, kind, duration_ms, status, input, output")
    .eq("run_id", r.id)
    .order("step_index", { ascending: true });

  if (tracesErr) return null;

  return {
    id: r.id,
    trigger: r.trigger,
    score: r.score,
    status: r.status,
    started_at: r.started_at,
    duration_ms: r.duration_ms,
    model: r.model,
    project_id: r.project_id,
    project_name: project.name,
    project_environment: project.environment,
    steps: (traces ?? []) as RunDetailStep[],
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}
