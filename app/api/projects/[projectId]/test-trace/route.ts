import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Fakes a "first trace just landed" so the onboarding success state is
// reachable before the real SDK is wired up. Inserts a synthetic run +
// 5 trace rows, and stamps projects.first_trace_at if unset.

const SYNTHETIC_STEPS = [
  { tool_name: "classify_intent", kind: "llm",  duration_ms: 214, status: "ok"  },
  { tool_name: "fetch_context",   kind: "llm",  duration_ms: 261, status: "ok"  },
  { tool_name: "search_kb",       kind: "tool", duration_ms: 408, status: "warn" },
  { tool_name: "draft_reply",     kind: "llm",  duration_ms: 612, status: "ok"  },
  { tool_name: "policy_check",    kind: "tool", duration_ms:  88, status: "ok"  },
];

export async function POST(
  _req: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = getServiceSupabase();

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, first_trace_at")
    .eq("id", params.projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projErr || !project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const totalMs = SYNTHETIC_STEPS.reduce((s, x) => s + x.duration_ms, 0);

  const { data: run, error: runErr } = await supabase
    .from("runs")
    .insert({
      project_id: project.id,
      trigger: "manual",
      score: 95,
      status: "ok",
      duration_ms: totalMs,
      model: "gpt-5.1-mini",
    })
    .select("id")
    .single();

  if (runErr || !run) {
    return NextResponse.json({ error: "run_insert_failed" }, { status: 500 });
  }

  const traceRows = SYNTHETIC_STEPS.map((step, i) => ({
    run_id: run.id,
    step_index: i + 1,
    tool_name: step.tool_name,
    kind: step.kind,
    duration_ms: step.duration_ms,
    status: step.status,
    input: { synthetic: true },
    output: { synthetic: true },
  }));

  const { error: tracesErr } = await supabase.from("traces").insert(traceRows);
  if (tracesErr) {
    return NextResponse.json({ error: "traces_insert_failed" }, { status: 500 });
  }

  if (!project.first_trace_at) {
    await supabase
      .from("projects")
      .update({ first_trace_at: new Date().toISOString() })
      .eq("id", project.id);
  }

  return NextResponse.json({ ok: true, run_id: run.id, steps: traceRows.length });
}
