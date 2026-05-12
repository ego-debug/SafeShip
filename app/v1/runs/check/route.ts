import { NextResponse } from "next/server";
import { projectByApiKey } from "@/lib/ingestion";
import { getServiceSupabase } from "@/lib/supabase";

// GET /v1/runs/check?min_score=80[&trigger=deploy]
// Headers: Authorization: Bearer sk_live_xxx
//
// Returns 200 with { ok: true, ... }   when the latest matching run's score
//                                       is >= min_score.
// Returns 422 with { ok: false, ... }  when it's below threshold.
// Returns 404 with { error: "no_runs" } when the project has no runs yet.
//
// Designed for CI: a 200 means the deploy is safe, anything else is a fail.

const ALLOWED_TRIGGERS = new Set(["production", "deploy", "scheduled", "manual"]);

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(sk_live_[A-Za-z0-9_-]{8,})$/.exec(auth);
  if (!m) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 401 });
  }

  const project = await projectByApiKey(m[1]);
  if (!project) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  }

  const url = new URL(req.url);
  const minScoreRaw = url.searchParams.get("min_score");
  const minScore = clampInt(minScoreRaw, 0, 100, 80);
  const trigger = url.searchParams.get("trigger");

  const supabase = getServiceSupabase();

  let query = supabase
    .from("runs")
    .select("id, score, status, started_at, model, trigger, duration_ms")
    .eq("project_id", project.id)
    .order("started_at", { ascending: false })
    .limit(1);

  if (trigger && ALLOWED_TRIGGERS.has(trigger)) {
    query = query.eq("trigger", trigger);
  }

  const { data: row, error } = await query.maybeSingle();
  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json(
      {
        error: "no_runs",
        hint: trigger
          ? `No runs found for project with trigger=${trigger}. Send a trace first.`
          : "No runs found for this project. Send a trace first.",
      },
      { status: 404 },
    );
  }

  const score = row.score as number | null;
  const passed = score != null && score >= minScore;

  return NextResponse.json(
    {
      ok: passed,
      project: { id: project.id, name: project.name, environment: project.environment },
      run: {
        id: row.id,
        score,
        status: row.status,
        started_at: row.started_at,
        model: row.model,
        trigger: row.trigger,
        duration_ms: row.duration_ms,
      },
      min_score: minScore,
      message: passed
        ? `Latest run scored ${score}/100 ≥ ${minScore}. Safe to deploy.`
        : score == null
        ? `Latest run has no regression score yet. Cannot verify deploy safety.`
        : `Latest run scored ${score}/100 < ${minScore}. Regression detected — block this deploy.`,
    },
    { status: passed ? 200 : 422 },
  );
}

function clampInt(s: string | null, lo: number, hi: number, def: number): number {
  if (s == null) return def;
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}
