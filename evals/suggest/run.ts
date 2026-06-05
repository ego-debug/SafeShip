/**
 * Offline eval runner for the suggest engine.
 *
 * Loads every JSON fixture under `cases/`, calls `suggestFromRun()`
 * for each, scores the output against the case's gold block, prints a
 * report. Exit code 0 if aggregate >= 0.80, 1 otherwise — so CI can
 * gate on this.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx evals/suggest/run.ts
 * or:
 *   npm run eval:suggest
 *
 * Cost: 12 cases × Sonnet 4.6 call ≈ $0.15 per pass with the prompt
 * cache warm.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aggregate, formatReport, scoreOne, type EvalCase, type CaseScore } from "./score";
import type { Suggestion } from "../../lib/suggest-core";

/**
 * Minimal .env.local loader so the runner picks up ANTHROPIC_API_KEY
 * the same way next dev does. Does NOT overwrite anything already in
 * process.env (so `ANTHROPIC_API_KEY=... npm run eval:suggest` wins).
 */
function loadDotEnvLocal() {
  // Look in both the runner's relative repo root AND the process cwd
  // (npm run launches from repo root, so cwd is the reliable case).
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.resolve(thisDir, "..", "..", ".env.local"),
  ];
  const p = candidates.find((c) => existsSync(c));
  if (!p) return;
  // Strip UTF-8 BOM if present — Windows editors love to add one.
  const raw = readFileSync(p, "utf-8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/);
  let count = 0;
  let skippedLines = 0;
  const loadedNames: string[] = [];
  const skippedAlreadySet: string[] = [];
  for (const line of lines) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) {
      skippedLines++;
      continue;
    }
    // Only respect already-set process.env values when they're
    // non-empty. An empty string in process.env is effectively
    // "unset" for our purposes and the .env.local value should win.
    if (process.env[m[1]] !== undefined && process.env[m[1]] !== "") {
      skippedAlreadySet.push(m[1]);
      continue;
    }
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
    loadedNames.push(m[1]);
    count++;
  }
  if (process.env.DEBUG_ENV) {
    console.log(`[env] file: ${p}`);
    console.log(`[env] total lines: ${lines.length}, loaded ${count}, skipped (no match) ${skippedLines}, skipped (already set) ${skippedAlreadySet.length}`);
    console.log(`[env] loaded names: ${loadedNames.join(", ")}`);
    if (skippedAlreadySet.length) console.log(`[env] already in process.env: ${skippedAlreadySet.join(", ")}`);
  }
}

// Resolve __dirname under both ESM and CJS — tsx may pick either.
const thisDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

async function main() {
  loadDotEnvLocal();

  const dryRun = process.argv.includes("--dry-run");

  if (!dryRun && !process.env.ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY missing in env. Set it before running.");
    console.error("(Or pass --dry-run to validate the scoring rubric without an LLM call.)");
    process.exit(2);
  }

  const cases = loadCases();
  if (cases.length === 0) {
    console.error("ERROR: no cases found under evals/suggest/cases/. Add some fixtures.");
    process.exit(2);
  }

  console.log(
    dryRun
      ? `[dry-run] Scoring ${cases.length} hand-written gold-equivalent suggestions to verify the rubric works…`
      : `Running ${cases.length} cases against the suggest engine…`,
  );
  console.log("");

  // Lazy-load suggest core only when we actually need it. Avoids
  // importing @anthropic-ai/sdk in dry-run mode.
  const suggestFromRun = dryRun
    ? null
    : (await import("../../lib/suggest-core")).suggestFromRun;

  const results: CaseScore[] = [];
  for (const c of cases) {
    process.stdout.write(`  ${c.id.padEnd(36)} ${c.failure_type.padEnd(22)} … `);
    let suggestion: Suggestion | null = null;
    let schemaError: string | null = null;
    if (dryRun) {
      suggestion = goldEquivalentSuggestion(c);
    } else {
      try {
        suggestion = await suggestFromRun!(c.run);
      } catch (err) {
        schemaError = err instanceof Error ? err.message : String(err);
      }
    }
    const score = scoreOne(c, suggestion, schemaError);
    results.push(score);
    process.stdout.write(`${(score.total * 100).toFixed(0).padStart(3)}%\n`);
  }

  const report = aggregate(results);
  console.log(formatReport(report));

  // Save a machine-readable artifact too so we can diff scores
  // across prompt changes.
  const artifact = {
    timestamp: new Date().toISOString(),
    model: process.env.SAFESHIP_SUGGEST_MODEL ?? "claude-sonnet-4-6",
    report,
  };
  const outPath = path.join(thisDir, "last-run.json");
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`Wrote machine-readable report → evals/suggest/last-run.json`);

  process.exit(report.aggregate.total >= 0.8 ? 0 : 1);
}

/**
 * Hand-written "ideal" suggestion derived directly from a case's gold
 * block. Used by --dry-run to verify the scoring rubric — these should
 * all score 100%. If a case scores below 100% in dry-run, the gold
 * block and the scorer are inconsistent and one of them needs fixing.
 */
function goldEquivalentSuggestion(c: EvalCase): Suggestion {
  const g = c.gold;
  const t = g.expected_target_step;
  let assertExpr: string;
  switch (g.expected_assertion_kind) {
    case "contains":
      assertExpr = `output contains ${g.expected_fields_referenced.join(".")}`;
      break;
    case "not_empty":
      assertExpr = `output.${g.expected_fields_referenced[0] ?? "result"} != [] and output.${g.expected_fields_referenced[0] ?? "result"} != null`;
      break;
    case "schema":
      assertExpr = g.expected_fields_referenced
        .map((f) => `output.${f} != null`)
        .join(" and ");
      break;
    case "count":
      assertExpr = `count(steps where step == "${t}") <= 2`;
      break;
    case "regex":
      assertExpr = `output matches /^.+$/`;
      break;
    case "equality":
    default:
      assertExpr = `output == ${g.expected_fields_referenced[0] ?? "expected"}`;
  }
  const name = `${t.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.gold_equivalent`;
  return {
    name,
    plain_english: `Test that ${t} satisfies the ${g.expected_assertion_kind} constraint over the gold-required fields.`,
    code_yaml: `test: ${name}\nwhen: step == "${t}"\nassert: ${assertExpr}`,
    severity: g.expected_severity_min,
    rationale: `Synthetic gold-equivalent suggestion for case ${c.id}. Scoring should be 100%; if it isn't, the scorer or gold block needs fixing.`,
  };
}

function loadCases(): EvalCase[] {
  const casesDir = path.join(thisDir, "cases");
  const cases: EvalCase[] = [];
  const types = readdirSync(casesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const t of types) {
    const dir = path.join(casesDir, t);
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      const raw = readFileSync(path.join(dir, f), "utf-8");
      const parsed = JSON.parse(raw) as EvalCase;
      cases.push(parsed);
    }
  }
  return cases;
}

main().catch((err) => {
  console.error("Eval runner crashed:", err);
  process.exit(2);
});
