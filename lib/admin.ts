import "server-only";
import { getServiceSupabase } from "./supabase";

/**
 * Owner-only metrics for /admin. Two gates: ADMIN_USER_IDS (Clerk ids)
 * or the standalone owner session from lib/adminAuth.
 */

export function isAdmin(userId: string): boolean {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

const DAY_MS = 86_400_000;
const PRICE_USD = 29.99;
const CHART_DAYS = 14;

export type ActivityItem = {
  at: string;
  kind: "signup" | "failure" | "suggestion" | "accepted" | "waitlist";
  text: string;
};

export type AdminSnapshot = {
  waitlist: {
    total: number;
    last7d: number;
    recent: Array<{ email: string; created_at: string }>;
  };
  users: { total: number; last7d: number };
  projects: { total: number; activated: number };
  runs: {
    last24h: number;
    last7d: number;
    failures7d: number;
    lastIngestAt: string | null;
  };
  suggestions: { pending: number; accepted: number; skipped: number };
  tests: { active: number };
  /** Activation funnel in USERS: how far each signup made it. */
  funnel: {
    signedUp: number;
    createdProject: number;
    sentFirstTrace: number;
    gotSuggestion: number;
    acceptedTest: number;
  };
  /** Daily series for the last CHART_DAYS days, oldest first. */
  charts: {
    days: string[];
    runs: number[];
    failures: number[];
    signups: number[];
    waitlist: number[];
  };
  billing: {
    active: number;
    trialing: number;
    canceled: number;
    none: number;
    mrr: number;
  };
  engine: {
    configured: boolean;
    callsToday: number;
    acceptRate: number | null;
  };
  integrations: Array<{ name: string; ok: boolean; note: string }>;
  activity: ActivityItem[];
};

export type AdminUserRow = {
  id: string;
  email: string;
  created_at: string;
  subscription_status: string;
  projects: number;
  runs: number;
  lastActiveAt: string | null;
  isAdmin: boolean;
};

function dayBuckets(n: number): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(today.getTime() - i * DAY_MS).toISOString().slice(0, 10));
  }
  return out;
}

function bucketize(days: string[], timestamps: string[]): number[] {
  const idx = new Map(days.map((d, i) => [d, i]));
  const out = new Array(days.length).fill(0);
  for (const t of timestamps) {
    const i = idx.get(t.slice(0, 10));
    if (i !== undefined) out[i] += 1;
  }
  return out;
}

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

  const runCountByProject = new Map<string, number>();
  const lastRunByProject = new Map<string, string>();
  if (projectIds.length) {
    const { data: runRows } = await supabase
      .from("runs")
      .select("project_id, started_at")
      .in("project_id", projectIds);
    for (const r of (runRows ?? []) as Array<{ project_id: string; started_at: string }>) {
      runCountByProject.set(r.project_id, (runCountByProject.get(r.project_id) ?? 0) + 1);
      const prev = lastRunByProject.get(r.project_id);
      if (!prev || r.started_at > prev) lastRunByProject.set(r.project_id, r.started_at);
    }
  }

  return ((usersRes.data ?? []) as Array<{
    id: string;
    email: string;
    created_at: string;
    subscription_status: string;
  }>).map((u) => {
    const owned = projects.filter((p) => p.user_id === u.id);
    let lastActiveAt: string | null = null;
    for (const p of owned) {
      const t = lastRunByProject.get(p.id);
      if (t && (!lastActiveAt || t > lastActiveAt)) lastActiveAt = t;
    }
    return {
      ...u,
      projects: owned.length,
      runs: owned.reduce((acc, p) => acc + (runCountByProject.get(p.id) ?? 0), 0),
      lastActiveAt,
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
  const since24h = new Date(now - DAY_MS).toISOString();
  const since7d = new Date(now - 7 * DAY_MS).toISOString();
  const days = dayBuckets(CHART_DAYS);
  const sinceChart = days[0];
  const todayStart = days[days.length - 1];

  const count = (table: string, filter?: (q: any) => any) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (filter) q = filter(q);
    return q;
  };

  const [
    waitlistRecent,
    allWaitlist,
    allUsers,
    projectsActivated,
    runs24h,
    runs7d,
    failures7d,
    lastRun,
    suggPending,
    suggAccepted,
    suggSkipped,
    suggToday,
    testsActive,
    allProjects,
    suggestionProjects,
    testProjects,
    chartRuns,
    recentFailures,
    recentSuggestions,
    recentTests,
  ] = await Promise.all([
    supabase
      .from("waitlist")
      .select("email, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("waitlist").select("created_at"),
    supabase.from("users").select("id, email, created_at, subscription_status"),
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
    count("suggested_tests", (q) => q.gte("created_at", todayStart)),
    count("tests", (q) => q.eq("status", "active")),
    // Funnel + ownership inputs. Full-table reads are fine pre-traction.
    supabase.from("projects").select("id, user_id, first_trace_at"),
    supabase.from("suggested_tests").select("project_id"),
    supabase.from("tests").select("project_id"),
    supabase
      .from("runs")
      .select("started_at, status")
      .gte("started_at", sinceChart),
    supabase
      .from("runs")
      .select("id, started_at, project_id, model")
      .eq("status", "fail")
      .order("started_at", { ascending: false })
      .limit(6),
    supabase
      .from("suggested_tests")
      .select("name, status, created_at, project_id")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("tests")
      .select("name, created_at, project_id")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const users = (allUsers.data ?? []) as Array<{
    id: string;
    email: string;
    created_at: string;
    subscription_status: string;
  }>;
  const waitlistRows = (allWaitlist.data ?? []) as Array<{ created_at: string }>;

  const projectRows = (allProjects.data ?? []) as Array<{
    id: string;
    user_id: string;
    first_trace_at: string | null;
  }>;
  const ownerByProject = new Map(projectRows.map((p) => [p.id, p.user_id]));
  const emailByUser = new Map(users.map((u) => [u.id, u.email]));
  const emailForProject = (projectId: string | null): string =>
    (projectId && emailByUser.get(ownerByProject.get(projectId) ?? "")) ?? "unknown";

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

  // Charts
  const chartRunRows = (chartRuns.data ?? []) as Array<{ started_at: string; status: string }>;
  const runsSeries = bucketize(days, chartRunRows.map((r) => r.started_at));
  const failuresSeries = bucketize(
    days,
    chartRunRows.filter((r) => r.status === "fail").map((r) => r.started_at),
  );
  const signupsSeries = bucketize(days, users.map((u) => u.created_at));
  const waitlistSeries = bucketize(days, waitlistRows.map((w) => w.created_at));

  // Billing
  const statusCount = (s: string) =>
    users.filter((u) => u.subscription_status === s).length;
  const active = statusCount("active");
  const trialing = statusCount("trialing");

  // Engine
  const accepted = suggAccepted.count ?? 0;
  const skipped = suggSkipped.count ?? 0;
  const decided = accepted + skipped;

  // Activity feed: merge recent events, newest first.
  const activity: ActivityItem[] = [
    ...users
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 5)
      .map((u) => ({
        at: u.created_at,
        kind: "signup" as const,
        text: `${u.email} signed up`,
      })),
    ...((recentFailures.data ?? []) as Array<{
      started_at: string;
      project_id: string;
      model: string | null;
    }>).map((r) => ({
      at: r.started_at,
      kind: "failure" as const,
      text: `Failed run on ${emailForProject(r.project_id)}'s agent${r.model ? ` (${r.model})` : ""}`,
    })),
    ...((recentSuggestions.data ?? []) as Array<{
      name: string;
      status: string;
      created_at: string;
      project_id: string;
    }>).map((sg) => ({
      at: sg.created_at,
      kind: "suggestion" as const,
      text: `Suggested ${sg.name} for ${emailForProject(sg.project_id)} (${sg.status})`,
    })),
    ...((recentTests.data ?? []) as Array<{
      name: string;
      created_at: string;
      project_id: string;
    }>).map((t) => ({
      at: t.created_at,
      kind: "accepted" as const,
      text: `${emailForProject(t.project_id)} accepted ${t.name}`,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 12);

  return {
    waitlist: {
      total: waitlistRows.length,
      last7d: waitlistRows.filter((w) => w.created_at >= since7d).length,
      recent: (waitlistRecent.data ?? []) as Array<{ email: string; created_at: string }>,
    },
    users: {
      total: users.length,
      last7d: users.filter((u) => u.created_at >= since7d).length,
    },
    projects: {
      total: projectRows.length,
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
      accepted,
      skipped,
    },
    tests: { active: testsActive.count ?? 0 },
    funnel: {
      signedUp: users.length,
      createdProject: usersWithProject.size,
      sentFirstTrace: usersWithTrace.size,
      gotSuggestion: usersWithSuggestion.size,
      acceptedTest: usersWithAcceptedTest.size,
    },
    charts: {
      days,
      runs: runsSeries,
      failures: failuresSeries,
      signups: signupsSeries,
      waitlist: waitlistSeries,
    },
    billing: {
      active,
      trialing,
      canceled: statusCount("canceled"),
      none: statusCount("none"),
      mrr: Math.round(active * PRICE_USD * 100) / 100,
    },
    engine: {
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      callsToday: suggToday.count ?? 0,
      acceptRate: decided ? Math.round((accepted / decided) * 100) : null,
    },
    integrations: [
      {
        name: "Supabase",
        ok: true, // this page loaded, so the DB answered
        note: "database answering",
      },
      {
        name: "Clerk",
        ok: Boolean(process.env.CLERK_SECRET_KEY),
        note: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_")
          ? "live keys"
          : "test keys",
      },
      {
        name: "Anthropic",
        ok: Boolean(process.env.ANTHROPIC_API_KEY),
        note: "suggest engine",
      },
      {
        name: "Stripe",
        ok: Boolean(process.env.STRIPE_SECRET_KEY),
        note: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live")
          ? "live mode"
          : "sandbox / not set",
      },
      {
        name: "Resend",
        ok: Boolean(process.env.RESEND_API_KEY),
        note: "failure alert emails",
      },
    ],
    activity,
  };
}
