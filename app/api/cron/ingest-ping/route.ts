// Synthetic ingest health check — invoked by Vercel cron every 5 minutes.
//
// What it measures: the full server-side ingestion pipeline (auth-less
// internal call into `ingestRun`, run + traces row inserts, first_trace_at
// stamp). Result is the same code path a real customer trace exercises;
// only the network round-trip from the customer's process to ours is not
// included (and that's bounded externally by their internet).
//
// Each call writes one row to `health_checks` and prunes anything older
// than 24h. The /status page reads the last hour and shows real p95.

import { NextResponse } from "next/server";
import { ingestRun } from "@/lib/ingestion";
import { getServiceSupabase } from "@/lib/supabase";

// Vercel runs cron handlers with `Authorization: Bearer <CRON_SECRET>`.
// In production we require it; locally we allow unauthenticated calls so
// you can manually trigger the ping while testing.
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

const HEALTH_PROJECT_NAME = "_safeship_health_synthetic";
const HEALTH_USER_ID = "system_safeship_health";

async function ensureHealthProject(): Promise<string> {
  const supabase = getServiceSupabase();
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", HEALTH_USER_ID)
    .eq("name", HEALTH_PROJECT_NAME)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // First time: lazily create the system user + project.
  await supabase.from("users").upsert(
    {
      id: HEALTH_USER_ID,
      email: "health-checks@safeship.dev",
      subscription_status: "none",
    },
    { onConflict: "id" },
  );
  const apiKey = `sk_live_health_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const { data: created, error } = await supabase
    .from("projects")
    .insert({
      user_id: HEALTH_USER_ID,
      name: HEALTH_PROJECT_NAME,
      environment: "synthetic",
      api_key: apiKey,
      alerts_enabled: false, // health pings should not page the team
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`health_project_create_failed: ${error?.message}`);
  }
  return created.id;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  let projectId: string;
  try {
    projectId = await ensureHealthProject();
  } catch (err) {
    return NextResponse.json(
      {
        error: "health_project_setup_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }

  // Synthetic 3-step payload — roughly representative of a real customer
  // trace (one LLM call, one tool call, one wrap-up step).
  const payload = {
    run: {
      trigger: "scheduled" as const,
      status: "ok" as const,
      score: 100,
      duration_ms: 0,
      model: "synthetic",
    },
    steps: [
      {
        tool_name: "synthetic_llm",
        kind: "llm" as const,
        input: { synthetic: true, t: Date.now() },
        output: { synthetic: true },
        duration_ms: 1,
        status: "ok" as const,
      },
      {
        tool_name: "synthetic_tool",
        kind: "tool" as const,
        input: { synthetic: true },
        output: { synthetic: true },
        duration_ms: 1,
        status: "ok" as const,
      },
      {
        tool_name: "synthetic_finalize",
        kind: "tool" as const,
        input: { synthetic: true },
        output: { synthetic: true },
        duration_ms: 1,
        status: "ok" as const,
      },
    ],
  };

  const start = performance.now();
  let ok = false;
  let runId: string | null = null;
  let detail: string | null = null;
  try {
    const result = await ingestRun(projectId, payload);
    runId = result.run_id;
    ok = true;
  } catch (err) {
    detail = err instanceof Error ? err.message : "ingest_failed";
  }
  const durationMs = Math.round(performance.now() - start);

  // Record the measurement, even on failure (failed pings = SLA breaches).
  await supabase.from("health_checks").insert({
    kind: "ingest_synthetic",
    ok,
    duration_ms: durationMs,
    detail,
  });

  // Best-effort cleanup so health rows don't pile up forever.
  const cutoffRuns = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h
  await supabase
    .from("runs")
    .delete()
    .eq("project_id", projectId)
    .lt("started_at", cutoffRuns);

  const cutoffHealth = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("health_checks")
    .delete()
    .lt("checked_at", cutoffHealth);

  return NextResponse.json({
    ok,
    duration_ms: durationMs,
    run_id: runId,
    detail,
  });
}
