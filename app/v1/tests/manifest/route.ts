import { NextResponse } from "next/server";
import { projectByApiKey } from "@/lib/ingestion";
import { getServiceSupabase } from "@/lib/supabase";

// GET /v1/tests/manifest
// Headers: Authorization: Bearer sk_live_xxx
//
// Returns the project's active regression tests in the shape the SafeShip
// Python CLI / GitHub Action expects:
//
//   {
//     tests: [
//       {
//         id: "<uuid>",
//         name: "draft_reply.refund_matches_order",
//         test_yaml: "test: ...\nwhen: ...\nassert: ...\n",
//         replay_input: { args: [...], kwargs: {...} } | <any> | null,
//         original_trace_id: "<run uuid>" | null,
//         created_at: "2026-05-13T...Z"
//       },
//       ...
//     ]
//   }
//
// Only tests with status='active' AND a non-null replay_input are returned.
// Older tests accepted before the Phase-2 schema change don't have a
// replay_input and aren't runnable by the CLI — the customer can re-accept
// a fresh suggestion to get a runnable test.

export const dynamic = "force-dynamic";

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

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("tests")
    .select("id, name, code_yaml, replay_input, origin_run_id, created_at, status")
    .eq("project_id", project.id)
    .eq("status", "active")
    .not("replay_input", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  type Row = {
    id: string;
    name: string;
    code_yaml: string | null;
    replay_input: unknown;
    origin_run_id: string | null;
    created_at: string;
  };
  const rows = (data ?? []) as unknown as Row[];

  const tests = rows
    // Defensive: only ship rows with a non-empty code_yaml. Without it the
    // CLI runner has nothing to evaluate.
    .filter((r) => typeof r.code_yaml === "string" && r.code_yaml.trim().length > 0)
    .map((r) => ({
      id: r.id,
      name: r.name,
      test_yaml: r.code_yaml,
      replay_input: r.replay_input,
      original_trace_id: r.origin_run_id,
      created_at: r.created_at,
    }));

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      environment: project.environment,
    },
    tests,
    count: tests.length,
  });
}
