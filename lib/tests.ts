import "server-only";
import { getServiceSupabase } from "./supabase";

export type TestRow = {
  id: string;
  name: string;
  plain_english: string | null;
  code_yaml: string | null;
  status: "active" | "muted" | "deleted";
  created_at: string;
};

export type TestsSnapshot = {
  tests: TestRow[];
  totals: {
    active: number;
    muted: number;
    deletedThisWeek: number;
    pendingSuggestions: number;
  };
  weeklyRuns: number;
  // Latest run timestamp across the whole project — used as a stand-in
  // for "last run" until a real per-test runner ships.
  lastRunAt: string | null;
  // True once a real test-runner records pass/fail per test. For now
  // every row is in the same "no execution history yet" state.
  hasExecutionHistory: boolean;
};

export async function getTestsSnapshot(
  userId: string,
): Promise<TestsSnapshot | null> {
  const supabase = getServiceSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!project) return null;

  const sinceWeek = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [testsRes, mutedRes, deletedRes, pendingRes, weeklyRunsRes, lastRunRes] =
    await Promise.all([
      supabase
        .from("tests")
        .select("id, name, plain_english, code_yaml, status, created_at")
        .eq("project_id", project.id)
        .neq("status", "deleted")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("tests")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .eq("status", "muted"),
      supabase
        .from("tests")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .eq("status", "deleted")
        .gte("created_at", sinceWeek),
      supabase
        .from("suggested_tests")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .eq("status", "pending"),
      supabase
        .from("runs")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id)
        .gte("started_at", sinceWeek),
      supabase
        .from("runs")
        .select("started_at")
        .eq("project_id", project.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const tests = (testsRes.data ?? []) as TestRow[];
  const active = tests.filter((t) => t.status === "active").length;

  return {
    tests,
    totals: {
      active,
      muted: mutedRes.count ?? 0,
      deletedThisWeek: deletedRes.count ?? 0,
      pendingSuggestions: pendingRes.count ?? 0,
    },
    weeklyRuns: weeklyRunsRes.count ?? 0,
    lastRunAt: lastRunRes.data?.started_at ?? null,
    hasExecutionHistory: false,
  };
}

export async function muteTest(userId: string, testId: string): Promise<void> {
  await updateTestStatus(userId, testId, "muted", ["active"]);
}

export async function unmuteTest(userId: string, testId: string): Promise<void> {
  await updateTestStatus(userId, testId, "active", ["muted"]);
}

export async function deleteTest(userId: string, testId: string): Promise<void> {
  await updateTestStatus(userId, testId, "deleted", ["active", "muted"]);
}

async function updateTestStatus(
  userId: string,
  testId: string,
  next: "active" | "muted" | "deleted",
  fromStatuses: Array<"active" | "muted" | "deleted">,
) {
  const supabase = getServiceSupabase();

  const { data: row } = await supabase
    .from("tests")
    .select("id, status, projects!inner(user_id)")
    .eq("id", testId)
    .maybeSingle();

  type Row = {
    id: string;
    status: string;
    projects:
      | { user_id: string }
      | Array<{ user_id: string }>
      | null;
  };
  const r = row as unknown as Row | null;
  if (!r) throw new Error("not_found");
  const project = Array.isArray(r.projects) ? r.projects[0] : r.projects;
  if (!project || project.user_id !== userId) throw new Error("not_found");
  if (!fromStatuses.includes(r.status as "active" | "muted" | "deleted")) {
    throw new Error("invalid_transition");
  }

  await supabase.from("tests").update({ status: next }).eq("id", r.id);
}
