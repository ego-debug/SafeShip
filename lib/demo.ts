import "server-only";
import { getServiceSupabase } from "./supabase";
import {
  getDashboardSnapshotForProject,
  type DashboardSnapshot,
  type ProjectSummary,
} from "./projects";

/**
 * Read-only data for the public /demo page. Reads the project named by
 * DEMO_PROJECT_ID (a real project kept seeded with believable history by
 * scripts/seed-demo.ts). No auth — nothing here is sensitive, and that's
 * the point: a stranger sees the product in ten seconds.
 */

export type DemoStep = {
  id: string;
  step_index: number;
  tool_name: string | null;
  kind: string | null;
  input: unknown;
  output: unknown;
  duration_ms: number | null;
  status: string | null;
};

export type DemoFailedRun = {
  id: string;
  started_at: string;
  model: string | null;
  score: number | null;
  steps: DemoStep[];
};

export type DemoSuggestion = {
  name: string;
  plain_english: string;
  code_yaml: string;
  severity: string | null;
  rationale: string | null;
};

export type DemoData = {
  snapshot: DashboardSnapshot;
  failedRun: DemoFailedRun | null;
  suggestion: DemoSuggestion;
};

// Shown when the demo project has no pending suggestion (e.g. it was
// accepted during a live demo). Mirrors what the engine produces for the
// seeded refund failure, so the page never has a hole in its story.
const FALLBACK_SUGGESTION: DemoSuggestion = {
  name: "draft_reply.refund_matches_order",
  plain_english:
    "Refund amounts in draft_reply output must exactly match the order total returned by lookup_order. No invented numbers.",
  code_yaml:
    'test: draft_reply.refund_matches_order\nwhen: step == "draft_reply"\nassert: output.text contains lookup_order.output.total',
  severity: "high",
  rationale:
    "draft_reply stated a refund of $249.00 when lookup_order returned a total of $24.99. This test fails any time the order total is missing from the reply.",
};

export async function getDemoData(): Promise<DemoData | null> {
  const projectId = process.env.DEMO_PROJECT_ID;
  if (!projectId) return null;

  const supabase = getServiceSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, environment, first_trace_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const snapshot = await getDashboardSnapshotForProject(
    project as ProjectSummary,
  );

  // Most recent failed run, with its full trace.
  const { data: failed } = await supabase
    .from("runs")
    .select("id, started_at, model, score")
    .eq("project_id", projectId)
    .eq("status", "fail")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let failedRun: DemoFailedRun | null = null;
  if (failed) {
    const { data: steps } = await supabase
      .from("traces")
      .select("id, step_index, tool_name, kind, input, output, duration_ms, status")
      .eq("run_id", failed.id)
      .order("step_index", { ascending: true });
    failedRun = { ...failed, steps: (steps ?? []) as DemoStep[] };
  }

  const { data: pending } = await supabase
    .from("suggested_tests")
    .select("name, plain_english, code_yaml, severity, rationale")
    .eq("project_id", projectId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const suggestion: DemoSuggestion =
    pending && pending.plain_english && pending.code_yaml
      ? {
          name: pending.name,
          plain_english: pending.plain_english,
          code_yaml: pending.code_yaml,
          severity: pending.severity,
          rationale: pending.rationale,
        }
      : FALLBACK_SUGGESTION;

  return { snapshot, failedRun, suggestion };
}
