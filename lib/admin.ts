import "server-only";
import { getServiceSupabase } from "./supabase";

/**
 * Owner-only metrics for /app/admin. Gated by ADMIN_USER_IDS — a
 * comma-separated list of Clerk user ids in the env. Anyone else gets a
 * 404 from the page, so the route's existence stays invisible.
 */

export function isAdmin(userId: string): boolean {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

export type AdminSnapshot = {
  waitlist: {
    total: number;
    last7d: number;
    recent: Array<{ email: string; created_at: string }>;
  };
  users: { total: number; last7d: number };
  projects: { total: number; activated: number };
  runs: { last24h: number; last7d: number; failures7d: number; lastIngestAt: string | null };
  suggestions: { pending: number; accepted: number; skipped: number };
  tests: { active: number };
  /**
   * Activation funnel, counted in USERS (not projects): how far each
   * signup made it toward the aha moment. Each stage is a subset of the
   * previous one in spirit, though not enforced.
   */
  funnel: {
    signedUp: number;
    createdProject: number;
    sentFirstTrace: number;
    gotSuggestion: number;
    acceptedTest: number;
  };
};

export type AdminUserRow = {
  id: string;
  email: string;
  created_at: string;
  subscription_status: string;
  projects: number;
  runs: number;
  isAdmin: boolean;
};

/** Every registered user with how much data they own. Owner-page only. */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const supabase = getServiceSupabase();
  const [usersRes, projectsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, created_at, subscription_status")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("id, user_id"),
  ]);

  const projects = (projectsRes.data ?? []) as Array<{ id: string; user_id: string }>;
  const projectIds = projects.map((p) => p.id);

  // Per-project run counts in one query, aggregated in JS (fine pre-traction).
  const runCountByProject = new Map<string, number>();
  if (projectIds.length) {
    const { data: runRows } = await supabase
      .from("runs")
      .select("project_id")
      .in("project_id", projectIds);
    for (const r of (runRows ?? []) as Array<{ project_id: string }>) {
      runCountByProject.set(r.project_id, (runCountByProject.get(r.project_id) ?? 0) + 1);
    }
  }

  return ((usersRes.data ?? []) as Array<{
    id: string;
    email: string;
    created_at: string;
    subscription_status: string;
  }>).map((u) => {
    const owned = projects.filter((p) => p.user_id === u.id);
    return {
      ...u,
      projects: owned.length,
      runs: owned.reduce((acc, p) => acc + (runCountByProject.get(p.id) ?? 0), 0),
      isAdmin: isAdmin(u.id),
    };
  });
}

/**
 * Deletes a user and everything they own. The schema cascades:
 * users -> projects -> runs/traces/suggested_tests/tests/test_runs.
 * Refuses to delete an admin account. Does NOT touch Clerk — if the
 * person signs in again they get a fresh, empty account.
 */
export async function deleteUserEverywhere(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isAdmin(userId)) {
    return { ok: false, error: "refusing to delete an admin account" };
  }
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Removes one email from the waitlist. */
export async function deleteWaitlistEmail(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("waitlist").delete().ilike("email", email);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const supabase = getServiceSupabase();
  const now = Date.now();
  const since24h = new Date(now - 86_400_000).toISOString();
  const since7d = new Date(now - 7 * 86_400_000).toISOString();

  const count = (table: string, filter?: (q: any) => any) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    return q;
  };

  const [
    waitlistTotal,
    waitlist7d,
    waitlistRecent,
    usersTotal,
    users7d,
    projectsTotal,
    projectsActivated,
    runs24h,
    runs7d,
    failures7d,
    lastRun,
    suggPending,
    suggAccepted,
    suggSkipped,
    testsActive,
    allProjects,
    suggestionProjects,
    testProjects,
  ] = await Promise.all([
    count("waitlist"),
    count("waitlist", (q) => q.gte("created_at", since7d)),
    supabase
      .from("waitlist")
      .select("email, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    count("users"),
    count("users", (q) => q.gte("created_at", since7d)),
    count("projects"),
    count("projects", (q) => q.not("first_trace_at", "is", null)),
    count("runs", (q) => q.gte("started_at", since24h)),
    count("runs", (q) => q.gte("started_at", since7d)),
    count("runs", (q) => q.gte("started_at", since7d).eq("status", "fail")),
    supabase
      .from("runs")
      .select("started_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    count("suggested_tests", (q) => q.eq("status", "pending")),
    count("suggested_tests", (q) => q.eq("status", "accepted")),
    count("suggested_tests", (q) => q.eq("status", "skipped")),
    count("tests", (q) => q.eq("status", "active")),
    // Funnel inputs. Full-table reads are fine at pre-traction scale;
    // revisit with SQL aggregates past a few thousand rows.
    supabase.from("projects").select("id, user_id, first_trace_at"),
    supabase.from("suggested_tests").select("project_id"),
    supabase.from("tests").select("project_id"),
  ]);

  const projectRows = (allProjects.data ?? []) as Array<{
    id: string;
    user_id: string;
    first_trace_at: string | null;
  }>;
  const ownerByProject = new Map(projectRows.map((p) => [p.id, p.user_id]));

  const usersWithProject = new Set(projectRows.map((p) => p.user_id));
  const usersWithTrace = new Set(
    projectRows.filter((p) => p.first_trace_at != null).map((p) => p.user_id),
  );
  const usersWithSuggestion = new Set(
    ((suggestionProjects.data ?? []) as Array<{ project_id: string }>)
      .map((s) => ownerByProject.get(s.project_id))
      .filter(Boolean),
  );
  const usersWithAcceptedTest = new Set(
    ((testProjects.data ?? []) as Array<{ project_id: string }>)
      .map((t) => ownerByProject.get(t.project_id))
      .filter(Boolean),
  );

  return {
    waitlist: {
      total: waitlistTotal.count ?? 0,
      last7d: waitlist7d.count ?? 0,
      recent: (waitlistRecent.data ?? []) as Array<{
        email: string;
        created_at: string;
      }>,
    },
    users: { total: usersTotal.count ?? 0, last7d: users7d.count ?? 0 },
    projects: {
      total: projectsTotal.count ?? 0,
      activated: projectsActivated.count ?? 0,
    },
    runs: {
      last24h: runs24h.count ?? 0,
      last7d: runs7d.count ?? 0,
      failures7d: failures7d.count ?? 0,
      lastIngestAt: lastRun.data?.started_at ?? null,
    },
    suggestions: {
      pending: suggPending.count ?? 0,
      accepted: suggAccepted.count ?? 0,
      skipped: suggSkipped.count ?? 0,
    },
    tests: { active: testsActive.count ?? 0 },
    funnel: {
      signedUp: usersTotal.count ?? 0,
      createdProject: usersWithProject.size,
      sentFirstTrace: usersWithTrace.size,
      gotSuggestion: usersWithSuggestion.size,
      acceptedTest: usersWithAcceptedTest.size,
    },
  };
}
