/**
 * Verifies the demo account's seeded data through the SAME loader
 * functions the signed-in screens call, so what passes here is what the
 * screens render. Run after seed-demo.ts:
 *
 *   $env:NODE_OPTIONS='--conditions=react-server'; npx tsx scripts/verify-demo-data.ts --user <clerk_user_id>
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

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (!ok) failures += 1;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const i = process.argv.indexOf("--user");
  const userId = i >= 0 ? process.argv[i + 1] : null;
  if (!userId) {
    console.error("Usage: verify-demo-data.ts --user <clerk_user_id>");
    process.exit(1);
  }

  // Dashboard
  const { getDashboardSnapshot } = await import("../lib/projects");
  const dash = await getDashboardSnapshot(userId);
  check("dashboard snapshot loads", Boolean(dash));
  if (dash) {
    check("dashboard: recent runs populated", dash.runs.length >= 5, `${dash.runs.length} runs`);
    check("dashboard: recent failures present", dash.failures.length >= 1, `${dash.failures.length} failures`);
    const daysWithData = dash.scoreSeries.filter((p: { score: number | null }) => p.score != null).length;
    check("dashboard: 7-day score series has data", daysWithData >= 6, `${daysWithData}/7 days`);
    check("dashboard: weekly run count sane", dash.totalRuns >= 20, `${dash.totalRuns} runs in 7d`);
  }

  // Trace detail: most recent failed run
  const { getRunForUser } = await import("../lib/runs");
  const failedRun = dash?.runs.find((r: { status: string }) => r.status === "fail");
  check("a failed run appears in recent runs", Boolean(failedRun));
  if (failedRun) {
    const detail = await getRunForUser(userId, failedRun.id);
    check("trace detail loads for failed run", Boolean(detail));
    if (detail) {
      check("trace detail: has steps", detail.steps.length >= 3, `${detail.steps.length} steps`);
      const failStep = detail.steps.find((s: { status: string | null }) => s.status === "fail");
      check("trace detail: failing step present", Boolean(failStep), failStep?.tool_name ?? "");
    }
  }

  // Suggestions queue
  const { getSuggestionsSummary } = await import("../lib/suggestions");
  const sugg = await getSuggestionsSummary(userId);
  check("suggestions summary loads", Boolean(sugg));
  if (sugg) {
    check("suggestions: pending fallback present", sugg.pending.length >= 1, `${sugg.pending.length} pending`);
    check("suggestions: engine configured", sugg.engineConfigured);
  }

  // Tests list
  const { getTestsSnapshot } = await import("../lib/tests");
  const tests = await getTestsSnapshot(userId);
  check("tests snapshot loads", Boolean(tests));
  if (tests) {
    check("tests: active tests present", tests.tests.length >= 4, `${tests.tests.length} tests`);
    // hasExecutionHistory is intentionally false until the in-app runner
    // ships; the screen explains that in a banner. Assert the stub state
    // so we notice if it flips without this script being updated.
    check("tests: execution history correctly absent (runner not shipped)", tests.hasExecutionHistory === false);
  }

  console.log("");
  console.log(failures === 0 ? "DEMO DATA VERIFICATION: ALL PASSED" : `DEMO DATA VERIFICATION: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify crashed:", e);
  process.exit(1);
});
