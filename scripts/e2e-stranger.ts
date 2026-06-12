/**
 * End-to-end "stranger test" for the data plane.
 *
 * Simulates a brand-new user's full journey against a RUNNING dev server
 * (localhost:3000) and the real Supabase + Claude backends:
 *
 *   provision user/project -> ingest ok trace (onboarding's "test trace")
 *   -> ingest a FAILED production trace -> generate suggestion (live
 *   Claude call) -> accept it -> verify it landed in the tests table.
 *
 * Run (PowerShell):
 *   $env:NODE_OPTIONS='--conditions=react-server'; npx tsx scripts/e2e-stranger.ts
 * Cleanup created rows:
 *   $env:NODE_OPTIONS='--conditions=react-server'; npx tsx scripts/e2e-stranger.ts --cleanup
 *
 * The react-server condition makes the `server-only` guard a no-op so the
 * app's own lib code runs unmodified. Exit 0 = every stage passed.
 */

import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

function loadDotEnvLocal() {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(__dirname, "..", ".env.local"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const [, key, raw] = m;
      if (process.env[key] !== undefined) continue;
      process.env[key] = raw.replace(/^"|"$/g, "");
    }
    return;
  }
}
loadDotEnvLocal();

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const E2E_USER_ID = "user_e2e_stranger_demo";
const E2E_EMAIL = "e2e-stranger@safeship.dev";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`[${tag}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const { getServiceSupabase } = await import("../lib/supabase");
  const supabase = getServiceSupabase();

  if (process.argv.includes("--cleanup")) {
    await cleanup(supabase);
    return;
  }

  // --- stage 0: dev server reachable ------------------------------------
  const ping = await fetch(BASE_URL, { method: "HEAD" }).catch(() => null);
  check("dev server reachable", Boolean(ping && ping.ok));
  if (!ping || !ping.ok) process.exit(1);

  // --- stage 1: provision user + project (mirrors lib/provision.ts,
  // minus the Clerk lookup, since this user never goes through the UI) ---
  await cleanup(supabase, /*quiet*/ true); // idempotent re-runs

  const { error: userErr } = await supabase
    .from("users")
    .upsert({ id: E2E_USER_ID, email: E2E_EMAIL }, { onConflict: "id" });
  check("users row created", !userErr, userErr?.message);

  const apiKey = "sk_live_" + randomBytes(24).toString("base64url");
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({
      user_id: E2E_USER_ID,
      name: "default",
      environment: "prod",
      api_key: apiKey,
    })
    .select("id, api_key, first_trace_at")
    .single();
  check("project + API key created", Boolean(project) && !projErr, projErr?.message);
  if (!project) process.exit(1);

  // --- stage 2: ingest an OK run via the public SDK endpoint ------------
  const okPayload = {
    run: {
      trigger: "manual",
      score: 95,
      status: "ok",
      duration_ms: 4100,
      model: "claude-sonnet-4-6",
    },
    steps: [
      { step_index: 0, tool_name: "classify_intent", kind: "llm", status: "ok", duration_ms: 900, input: { message: "where is my order?" }, output: { intent: "order_status", confidence: 0.97 } },
      { step_index: 1, tool_name: "lookup_order", kind: "tool", status: "ok", duration_ms: 300, input: { order_id: "A-1001" }, output: { id: "A-1001", status: "shipped", total: "$84.50" } },
      { step_index: 2, tool_name: "draft_reply", kind: "llm", status: "ok", duration_ms: 2900, input: { ctx: "order" }, output: { text: "Your order A-1001 shipped and is on its way." } },
    ],
  };
  const okRes = await fetch(`${BASE_URL}/v1/traces`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(okPayload),
  });
  const okBody = await okRes.json().catch(() => ({}));
  check(
    "ingest ok run via POST /v1/traces",
    okRes.status === 200 && okBody.ok === true,
    `status=${okRes.status} body=${JSON.stringify(okBody)}`,
  );

  // first_trace_at should now be set (onboarding SUCCESS detection)
  const { data: afterFirst } = await supabase
    .from("projects")
    .select("first_trace_at")
    .eq("id", project.id)
    .single();
  check("first_trace_at set after first ingest", Boolean(afterFirst?.first_trace_at));

  // --- stage 3: ingest a FAILED run (hallucinated refund) ---------------
  const failPayload = {
    run: {
      trigger: "production",
      score: 41,
      status: "fail",
      duration_ms: 5200,
      model: "claude-sonnet-4-6",
    },
    steps: [
      { step_index: 0, tool_name: "classify_intent", kind: "llm", status: "ok", duration_ms: 850, input: { message: "I want a refund, this broke after two days" }, output: { intent: "refund_request", confidence: 0.94 } },
      { step_index: 1, tool_name: "lookup_order", kind: "tool", status: "ok", duration_ms: 210, input: { order_id: "B-2047" }, output: { id: "B-2047", status: "delivered", total: "$24.99" } },
      { step_index: 2, tool_name: "draft_reply", kind: "llm", status: "fail", duration_ms: 4100, input: { ctx: "order_refund" }, output: { text: "Hi! I've processed your refund of $249.00 for order B-2047. You should see it in 3-5 business days." } },
    ],
  };
  const failRes = await fetch(`${BASE_URL}/v1/traces`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(failPayload),
  });
  const failBody = await failRes.json().catch(() => ({}));
  check(
    "ingest failed run via POST /v1/traces",
    failRes.status === 200 && failBody.ok === true,
    `status=${failRes.status} body=${JSON.stringify(failBody)}`,
  );

  // --- stage 4: generate suggestion (live Claude call) -------------------
  const { generateSuggestionsForUser, getSuggestionsSummary, acceptSuggestion } =
    await import("../lib/suggestions");

  const gen = await generateSuggestionsForUser(E2E_USER_ID);
  check(
    "suggestion generated from failed run",
    gen.generated >= 1,
    JSON.stringify(gen),
  );

  const summary = await getSuggestionsSummary(E2E_USER_ID);
  const pending = summary?.pending ?? [];
  check("suggestion visible in pending queue", pending.length >= 1);
  if (pending.length) {
    console.log(`       name: ${pending[0].name}`);
    console.log(`       severity: ${pending[0].severity}`);
    console.log(`       plain: ${pending[0].plain_english}`);
    console.log(`       yaml: ${pending[0].code_yaml.replace(/\n/g, " | ")}`);
  }

  // --- stage 5: accept -> lands in tests table ---------------------------
  if (pending.length) {
    const accept = await acceptSuggestion(E2E_USER_ID, pending[0].id);
    const testId = (accept as { test_id?: string }).test_id;
    check("suggestion accepted", Boolean(testId), JSON.stringify(accept));

    if (testId) {
      const { data: testRow } = await supabase
        .from("tests")
        .select("id, name, status, plain_english")
        .eq("id", testId)
        .single();
      check(
        "accepted test exists in tests table with status=active",
        testRow?.status === "active",
        testRow ? `name=${testRow.name}` : "row missing",
      );
    }

    // double-accept must be rejected (atomic claim)
    const double = await acceptSuggestion(E2E_USER_ID, pending[0].id).catch(
      (e: Error) => ({ error: e.message }),
    );
    const doubleOk =
      (double as { ok?: boolean }).ok !== true ||
      (double as { already?: boolean }).already === true;
    check("double-accept is a no-op (atomic claim)", doubleOk, JSON.stringify(double));
  }

  console.log("");
  if (failures === 0) {
    console.log("E2E STRANGER TEST: ALL STAGES PASSED");
    console.log(`(test data left in place for UI inspection — run with --cleanup to remove; user=${E2E_USER_ID})`);
  } else {
    console.log(`E2E STRANGER TEST: ${failures} FAILURE(S)`);
    process.exit(1);
  }
}

async function cleanup(
  supabase: ReturnType<typeof import("../lib/supabase").getServiceSupabase>,
  quiet = false,
) {
  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", E2E_USER_ID);
  const projectIds = (projects ?? []).map((p: { id: string }) => p.id);

  if (projectIds.length) {
    const { data: runs } = await supabase
      .from("runs")
      .select("id")
      .in("project_id", projectIds);
    const runIds = (runs ?? []).map((r: { id: string }) => r.id);
    const { data: tests } = await supabase
      .from("tests")
      .select("id")
      .in("project_id", projectIds);
    const testIds = (tests ?? []).map((t: { id: string }) => t.id);

    if (testIds.length) await supabase.from("test_runs").delete().in("test_id", testIds);
    if (runIds.length) await supabase.from("test_runs").delete().in("run_id", runIds);
    await supabase.from("suggested_tests").delete().in("project_id", projectIds);
    if (testIds.length) await supabase.from("tests").delete().in("project_id", projectIds);
    if (runIds.length) await supabase.from("traces").delete().in("run_id", runIds);
    await supabase.from("runs").delete().in("project_id", projectIds);
    await supabase.from("projects").delete().in("id", projectIds);
  }
  await supabase.from("users").delete().eq("id", E2E_USER_ID);
  if (!quiet) console.log("cleanup: removed all e2e-stranger rows");
}

main().catch((e) => {
  console.error("E2E crashed:", e);
  process.exit(1);
});
