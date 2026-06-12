import "server-only";
import { getServiceSupabase } from "./supabase";

export type ProjectSummary = {
  id: string;
  name: string;
  environment: string;
  first_trace_at: string | null;
};

export async function getDefaultProject(
  userId: string,
): Promise<ProjectSummary | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, environment, first_trace_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export type DashboardRun = {
  id: string;
  trigger: string;
  score: number | null;
  status: string;
  started_at: string;
  duration_ms: number | null;
  model: string | null;
};

export type DashboardFailure = {
  run_id: string;
  step_index: number;
  tool_name: string | null;
  status: string;
  started_at: string;
  model: string | null;
};

export type DashboardSnapshot = {
  project: ProjectSummary;
  runs: DashboardRun[];
  failures: DashboardFailure[];
  scoreSeries: Array<{ day: string; score: number | null }>;
  totalRuns: number;
};

const DAY_MS = 86_400_000;

export async function getDashboardSnapshot(
  userId: string,
): Promise<DashboardSnapshot | null> {
  const project = await getDefaultProject(userId);
  if (!project) return null;
  return getDashboardSnapshotForProject(project);
}

/**
 * Same snapshot, keyed by project instead of user. Used by the public
 * /demo page (which reads a designated demo project) in addition to the
 * signed-in dashboard.
 */
export async function getDashboardSnapshotForProject(
  project: ProjectSummary,
): Promise<DashboardSnapshot> {
  const supabase = getServiceSupabase();

  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();

  // Daily buckets for the 7-day score chart, computed up front so the
  // weekRuns query can join the parallel batch below instead of running
  // as a sequential fourth round-trip after it.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: Array<{ day: string; total: number; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    buckets.push({ day: d.toISOString().slice(0, 10), total: 0, count: 0 });
  }

  const [runsRes, failuresRes, countRes, weekRunsRes] = await Promise.all([
    supabase
      .from("runs")
      .select("id, trigger, score, status, started_at, duration_ms, model")
      .eq("project_id", project.id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("traces")
      .select(
        "run_id, step_index, tool_name, status, runs!inner(started_at, model, project_id)",
      )
      .eq("status", "fail")
      .eq("runs.project_id", project.id)
      .order("step_index", { ascending: true })
      .limit(3),
    supabase
      .from("runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .gte("started_at", since),
    supabase
      .from("runs")
      .select("started_at, score")
      .eq("project_id", project.id)
      .gte("started_at", buckets[0].day),
  ]);

  const runs: DashboardRun[] = (runsRes.data ?? []) as DashboardRun[];

  type FailureRow = {
    run_id: string;
    step_index: number;
    tool_name: string | null;
    status: string;
    runs:
      | { started_at: string; model: string | null }
      | Array<{ started_at: string; model: string | null }>
      | null;
  };
  const failures: DashboardFailure[] = (
    (failuresRes.data ?? []) as unknown as FailureRow[]
  ).map((row) => {
    const r = Array.isArray(row.runs) ? row.runs[0] : row.runs;
    return {
      run_id: row.run_id,
      step_index: row.step_index,
      tool_name: row.tool_name,
      status: row.status,
      started_at: r?.started_at ?? "",
      model: r?.model ?? null,
    };
  });

  // Average score per daily bucket
  for (const r of weekRunsRes.data ?? []) {
    if (r.score == null) continue;
    const d = (r.started_at as string).slice(0, 10);
    const bucket = buckets.find((b) => b.day === d);
    if (bucket) {
      bucket.total += r.score as number;
      bucket.count += 1;
    }
  }

  const scoreSeries = buckets.map((b) => ({
    day: b.day,
    score: b.count ? Math.round(b.total / b.count) : null,
  }));

  return {
    project,
    runs,
    failures,
    scoreSeries,
    totalRuns: countRes.count ?? 0,
  };
}
