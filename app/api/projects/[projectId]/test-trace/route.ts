import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { ingestRun } from "@/lib/ingestion";

// Inserts a synthetic 5-step run for the user's project so the onboarding
// success state is reachable before any real SDK is wired up. Authenticated
// via Clerk (not API key) since this is a UI-driven action, but the actual
// insertion path is identical to the public /v1/traces endpoint.

const SYNTHETIC_STEPS = [
  { tool_name: "classify_intent", kind: "llm" as const,  duration_ms: 214, status: "ok"   as const },
  { tool_name: "fetch_context",   kind: "llm" as const,  duration_ms: 261, status: "ok"   as const },
  { tool_name: "search_kb",       kind: "tool" as const, duration_ms: 408, status: "warn" as const },
  { tool_name: "draft_reply",     kind: "llm" as const,  duration_ms: 612, status: "ok"   as const },
  { tool_name: "policy_check",    kind: "tool" as const, duration_ms:  88, status: "ok"   as const },
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

  try {
    const result = await ingestRun(project.id, {
      run: {
        trigger: "manual",
        score: 95,
        status: "ok",
        duration_ms: totalMs,
        model: "gpt-5.1-mini",
      },
      steps: SYNTHETIC_STEPS.map((s) => ({
        ...s,
        input: { synthetic: true },
        output: { synthetic: true },
      })),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ingest_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
