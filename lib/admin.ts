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
