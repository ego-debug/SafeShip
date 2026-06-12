/**
 * Demo-data seeder for the AWS Summit demo.
 *
 * Seeds YOUR real signed-in account's project with a week of believable
 * production history for a customer-support triage agent:
 *
 *   - 28 runs across the last 7 days (score chart shows a dip + recovery)
 *   - 3 failed runs with demo-worthy stories:
 *       refund hallucination ($24.99 -> $249.00)  <- open this one on stage
 *       tool loop (lookup_order called 6x)
 *       silent empty KB result -> fabricated policy
 *   - 5 accepted regression tests with pass/fail history (sparklines)
 *   - 1 pending suggestion as a wifi-dies fallback; the other 2 failures
 *     are left unsuggested so "Generate suggestions" makes a LIVE Claude
 *     call during the demo.
 *
 * Usage (PowerShell, after signing in once so your project exists):
 *   $env:NODE_OPTIONS='--conditions=react-server'; npx tsx scripts/seed-demo.ts --email you@example.com
 * Wipe the project's data and reseed:
 *   ... scripts/seed-demo.ts --email you@example.com --reset
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  }
}
loadDotEnvLocal();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

type StepSeed = {
  tool_name: string;
  kind: "llm" | "tool";
  status: "ok" | "warn" | "fail";
  duration_ms: number;
  input: unknown;
  output: unknown;
};

function okSteps(orderId: string, total: string): StepSeed[] {
  return [
    { tool_name: "classify_intent", kind: "llm", status: "ok", duration_ms: 700 + rnd(400), input: { message: "where is my order?" }, output: { intent: "order_status", confidence: 0.96 } },
    { tool_name: "lookup_order", kind: "tool", status: "ok", duration_ms: 150 + rnd(250), input: { order_id: orderId }, output: { id: orderId, status: "shipped", total } },
    { tool_name: "draft_reply", kind: "llm", status: "ok", duration_ms: 1800 + rnd(1500), input: { ctx: "order_status" }, output: { text: `Your order ${orderId} shipped and should arrive in 2-3 business days. Total charged: ${total}.` } },
  ];
}

const REFUND_FAIL_STEPS: StepSeed[] = [
  { tool_name: "classify_intent", kind: "llm", status: "ok", duration_ms: 840, input: { message: "I want a refund, this broke after two days" }, output: { intent: "refund_request", confidence: 0.94 } },
  { tool_name: "lookup_order", kind: "tool", status: "ok", duration_ms: 212, input: { order_id: "B-2047" }, output: { id: "B-2047", status: "delivered", total: "$24.99" } },
  { tool_name: "draft_reply", kind: "llm", status: "fail", duration_ms: 4100, input: { ctx: "order_refund" }, output: { text: "Hi! I've processed your refund of $249.00 for order B-2047. You should see it in 3-5 business days." } },
];

const LOOP_FAIL_STEPS: StepSeed[] = [
  { tool_name: "classify_intent", kind: "llm", status: "ok", duration_ms: 790, input: { message: "status on order X-0091?" }, output: { intent: "order_status", confidence: 0.91 } },
  ...Array.from({ length: 6 }, (_, i) => ({
    tool_name: "lookup_order",
    kind: "tool" as const,
    status: (i === 5 ? "fail" : "warn") as "warn" | "fail",
    duration_ms: 180 + i * 12,
    input: { order_id: "X-0091" },
    output: { error: "not_found" },
  })),
];

const KB_FAIL_STEPS: StepSeed[] = [
  { tool_name: "classify_intent", kind: "llm", status: "ok", duration_ms: 760, input: { message: "can I still return this? bought it in January" }, output: { intent: "return_policy", confidence: 0.93 } },
  { tool_name: "search_kb", kind: "tool", status: "ok", duration_ms: 480, input: { query: "return window after 90 days" }, output: { results: [], total_matches: 0 } },
  { tool_name: "draft_reply", kind: "llm", status: "fail", duration_ms: 3300, input: { ctx: "returns" }, output: { text: "Per our return policy, items can be returned within 120 days of purchase, so you're all set!" } },
];

const SCHEMA_WARN_STEPS: StepSeed[] = [
  { tool_name: "classify_intent", kind: "llm", status: "warn", duration_ms: 1900, input: { message: "want my money back, this thing broke" }, output: "refund_request" },
  { tool_name: "route_to_queue", kind: "tool", status: "ok", duration_ms: 25, input: { fallback: true, queue: "general" }, output: { queued: true, queue: "general" } },
];

const ACCEPTED_TESTS = [
  {
    name: "draft_reply.refund_matches_order",
    plain_english: "Refund amounts in draft_reply output must exactly match the order total returned by lookup_order. No invented numbers.",
    code_yaml: 'test: draft_reply.refund_matches_order\nwhen: step == "draft_reply"\nassert: output.text contains lookup_order.output.total',
    failSlots: [9, 10],
  },
  {
    name: "lookup_order.call_count_budget",
    plain_english: "lookup_order must not be called more than 2 times in a single run.",
    code_yaml: 'test: lookup_order.call_count_budget\nwhen: step == "lookup_order"\nassert: count(steps where step == "lookup_order") <= 2',
    failSlots: [6],
  },
  {
    name: "search_kb.no_silent_empty",
    plain_english: "search_kb must either return matches or raise an explicit not_found status, never a silent empty list.",
    code_yaml: 'test: search_kb.no_silent_empty\nwhen: step == "search_kb"\nassert: (output.results != [] and output.results != null) or output.status == "not_found"',
    failSlots: [],
  },
  {
    name: "classify_intent.returns_object_with_confidence",
    plain_english: "classify_intent must return an object with both intent and confidence fields, not a bare string.",
    code_yaml: 'test: classify_intent.returns_object_with_confidence\nwhen: step == "classify_intent"\nassert: output.intent != null and output.confidence != null',
    failSlots: [4],
  },
  {
    name: "draft_reply.order_id_matches_lookup",
    plain_english: "Order IDs mentioned in replies must exactly match the ID returned by lookup_order.",
    code_yaml: 'test: draft_reply.order_id_matches_lookup\nwhen: step == "draft_reply"\nassert: output.text contains lookup_order.output.id',
    failSlots: [],
  },
];

const PENDING_SUGGESTION = {
  name: "lookup_order.no_retry_storm",
  plain_english: "lookup_order must not be retried more than twice for the same order id within one run.",
  code_yaml: 'test: lookup_order.no_retry_storm\nwhen: step == "lookup_order"\nassert: count(steps where step == "lookup_order") <= 2',
  severity: "medium",
  rationale: "lookup_order was invoked 6 times for order X-0091, each returning not_found, until the run failed. Capping the call count stops the retry storm early.",
};

function rnd(n: number): number {
  return Math.floor(Math.random() * n);
}

async function main() {
  const { getServiceSupabase } = await import("../lib/supabase");
  const supabase = getServiceSupabase();

  const email = arg("email");
  const userIdArg = arg("user");
  if (!email && !userIdArg) {
    console.error("Usage: seed-demo.ts --email <your-signin-email> [--reset]");
    process.exit(1);
  }

  let userId = userIdArg;
  if (!userId) {
    const { data: user, error } = await supabase
      .from("users")
      .select("id")
      .ilike("email", email!)
      .maybeSingle();
    if (error || !user) {
      console.error(`No users row for ${email}. Sign in once first (provisioning creates it). ${error?.message ?? ""}`);
      process.exit(1);
    }
    userId = user.id;
  }

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (projErr || !project) {
    console.error(`No project for user ${userId}. Visit /app/onboarding once first. ${projErr?.message ?? ""}`);
    process.exit(1);
  }
  console.log(`Seeding project ${project.id} (${project.name}) for user ${userId}`);

  if (process.argv.includes("--reset")) {
    const { data: oldRuns } = await supabase.from("runs").select("id").eq("project_id", project.id);
    const oldRunIds = (oldRuns ?? []).map((r: { id: string }) => r.id);
    const { data: oldTests } = await supabase.from("tests").select("id").eq("project_id", project.id);
    const oldTestIds = (oldTests ?? []).map((t: { id: string }) => t.id);
    if (oldTestIds.length) await supabase.from("test_runs").delete().in("test_id", oldTestIds);
    await supabase.from("suggested_tests").delete().eq("project_id", project.id);
    await supabase.from("tests").delete().eq("project_id", project.id);
    if (oldRunIds.length) await supabase.from("traces").delete().in("run_id", oldRunIds);
    await supabase.from("runs").delete().eq("project_id", project.id);
    console.log("reset: cleared existing runs/traces/tests/suggestions for the project");
  }

  const now = Date.now();
  // 28 runs over 7 days. Slot 0 = oldest. Failures placed for a story:
  // smooth week, dip 2 days ago, recovery, refund failure 2 hours ago.
  type RunPlan = { offsetMs: number; steps: StepSeed[]; status: "ok" | "warn" | "fail"; score: number; trigger: string; tag?: string };
  const plans: RunPlan[] = [];
  for (let slot = 0; slot < 28; slot++) {
    const day = Math.floor(slot / 4); // 0..6, 0 = 7 days ago
    const offsetMs = (7 - day) * DAY - (slot % 4) * 5 * HOUR - rnd(90) * 60_000;
    const orderId = `A-${1200 + slot}`;
    const total = `$${(20 + rnd(180))}.${String(10 + rnd(89))}`;
    plans.push({
      offsetMs,
      steps: okSteps(orderId, total),
      status: "ok",
      score: 86 + rnd(13),
      trigger: slot % 9 === 0 ? "deploy" : "production",
    });
  }
  // Overwrite chosen slots with story runs (slot index -> day position).
  plans[4] = { offsetMs: 6 * DAY + 3 * HOUR, steps: SCHEMA_WARN_STEPS, status: "warn", score: 71, trigger: "production", tag: "schema_warn" };
  plans[12] = { offsetMs: 4 * DAY + 6 * HOUR, steps: KB_FAIL_STEPS, status: "fail", score: 44, trigger: "production", tag: "kb_fail" };
  plans[20] = { offsetMs: 2 * DAY + 5 * HOUR, steps: LOOP_FAIL_STEPS, status: "fail", score: 38, trigger: "production", tag: "loop_fail" };
  plans[21] = { offsetMs: 2 * DAY + 2 * HOUR, steps: SCHEMA_WARN_STEPS, status: "warn", score: 68, trigger: "production", tag: "schema_warn_2" };
  plans[27] = { offsetMs: 2 * HOUR, steps: REFUND_FAIL_STEPS, status: "fail", score: 41, trigger: "production", tag: "refund_fail" };

  const runIdByTag: Record<string, string> = {};
  const allRunIds: string[] = [];
  for (const plan of plans) {
    const startedAt = new Date(now - plan.offsetMs).toISOString();
    const durationMs = plan.steps.reduce((a, s) => a + s.duration_ms, 0) + 80;
    const { data: run, error: runErr } = await supabase
      .from("runs")
      .insert({
        project_id: project.id,
        trigger: plan.trigger,
        score: plan.score,
        status: plan.status,
        started_at: startedAt,
        duration_ms: durationMs,
        model: "claude-sonnet-4-6",
      })
      .select("id")
      .single();
    if (runErr || !run) {
      console.error("run insert failed:", runErr?.message);
      process.exit(1);
    }
    allRunIds.push(run.id);
    if (plan.tag) runIdByTag[plan.tag] = run.id;

    const traceRows = plan.steps.map((s, i) => ({
      run_id: run.id,
      step_index: i,
      tool_name: s.tool_name,
      kind: s.kind,
      input: s.input,
      output: s.output,
      duration_ms: s.duration_ms,
      status: s.status,
    }));
    const { error: traceErr } = await supabase.from("traces").insert(traceRows);
    if (traceErr) {
      console.error("trace insert failed:", traceErr.message);
      process.exit(1);
    }
  }
  console.log(`inserted ${plans.length} runs with traces`);

  // first_trace_at so onboarding shows SUCCESS state
  await supabase
    .from("projects")
    .update({ first_trace_at: new Date(now - 7 * DAY).toISOString() })
    .eq("id", project.id)
    .is("first_trace_at", null);

  // Accepted tests + execution history for sparklines.
  let testCount = 0;
  for (const [ti, t] of ACCEPTED_TESTS.entries()) {
    const createdAt = new Date(now - (6 - ti) * DAY - rnd(8) * HOUR).toISOString();
    const { data: test, error: testErr } = await supabase
      .from("tests")
      .insert({
        project_id: project.id,
        name: t.name,
        plain_english: t.plain_english,
        code_yaml: t.code_yaml,
        status: "active",
        created_at: createdAt,
        origin_run_id: runIdByTag["refund_fail"] ?? null,
      })
      .select("id")
      .single();
    if (testErr || !test) {
      console.error("test insert failed:", testErr?.message);
      process.exit(1);
    }
    testCount += 1;

    // 12 executions over the week against seeded runs.
    const execRows = Array.from({ length: 12 }, (_, i) => ({
      test_id: test.id,
      run_id: allRunIds[Math.min(allRunIds.length - 1, 2 + i * 2)],
      passed: !t.failSlots.includes(i),
      duration_ms: 180 + rnd(600),
      created_at: new Date(now - (11 - i) * 14 * HOUR).toISOString(),
    }));
    const { error: execErr } = await supabase.from("test_runs").insert(execRows);
    if (execErr) {
      console.error("test_runs insert failed:", execErr.message);
      process.exit(1);
    }
  }
  console.log(`inserted ${testCount} accepted tests with execution history`);

  // One pending suggestion (wifi-dies fallback) attached to the loop failure.
  // The kb_fail and refund_fail runs stay unsuggested so the live
  // "Generate suggestions" demo has real material.
  const { error: sugErr } = await supabase.from("suggested_tests").insert({
    project_id: project.id,
    run_id: runIdByTag["loop_fail"] ?? null,
    name: PENDING_SUGGESTION.name,
    plain_english: PENDING_SUGGESTION.plain_english,
    code_yaml: PENDING_SUGGESTION.code_yaml,
    severity: PENDING_SUGGESTION.severity,
    rationale: PENDING_SUGGESTION.rationale,
    status: "pending",
    created_at: new Date(now - 2 * DAY + HOUR).toISOString(),
  });
  if (sugErr) {
    console.error("pending suggestion insert failed:", sugErr.message);
    process.exit(1);
  }
  console.log("inserted 1 pending suggestion (fallback); 2 failed runs left for live generation");

  console.log("");
  console.log("SEED COMPLETE. Demo state:");
  console.log("  dashboard: 7-day score chart with a dip 2 days ago, 28 runs, 3 failures");
  console.log(`  trace detail: open the refund failure (run ${runIdByTag["refund_fail"]})`);
  console.log("  suggestions: 1 pending now; click Generate for live Claude suggestions");
  console.log("  tests: 5 active tests with sparkline history");
}

main().catch((e) => {
  console.error("seed crashed:", e);
  process.exit(1);
});
