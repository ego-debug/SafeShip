/**
 * Deterministic scorer for one suggest-engine output against the gold
 * block of an eval case. See README.md for the rubric.
 *
 * Everything here is regex/string heuristics — fast, reproducible, no
 * second LLM call. Heuristics are intentionally loose where the gold
 * doesn't pin a specific token, so we don't penalise valid variations
 * (e.g. `output.amount == lookup.total` vs `output contains lookup.total`).
 */

import type { Suggestion } from "../../lib/suggest-core";
import type { RunDetail } from "../../lib/runs";

export type AssertionKind =
  | "equality"
  | "contains"
  | "not_empty"
  | "regex"
  | "count"
  | "schema";

export type Severity = "low" | "medium" | "high";

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2 };

export type EvalGold = {
  /** The tool_name the suggestion's `when:` clause should pin. */
  expected_target_step: string;
  /** Categorical match the assertion expression must satisfy. */
  expected_assertion_kind: AssertionKind;
  /**
   * Dot-paths (or substrings) that must each appear at least once in
   * the assertion expression. e.g. `["lookup_order", "total"]`.
   */
  expected_fields_referenced: string[];
  /**
   * Minimum acceptable severity. Suggestion can exceed it (high beats
   * medium beats low) but must not undershoot.
   */
  expected_severity_min: Severity;
};

export type EvalCase = {
  id: string;
  failure_type: string;
  description: string;
  run: RunDetail;
  gold: EvalGold;
};

export type DimensionScores = {
  schema_valid: number;
  target_step: number;
  assertion_kind: number;
  fields_referenced: number;
  severity_ok: number;
};

export type CaseScore = {
  case_id: string;
  failure_type: string;
  schema_error: string | null;
  dimensions: DimensionScores;
  /** Mean of the five dimensions. */
  total: number;
  /** What the suggester actually produced (for debug). */
  suggestion: Suggestion | null;
};

/**
 * Score one suggestion against one case. `schemaError` is non-null
 * when the suggester's tool output failed the Zod schema in
 * `lib/suggest.ts` — that's a 0 on schema_valid, but we still try the
 * other dimensions on whatever raw text we can salvage.
 */
export function scoreOne(
  c: EvalCase,
  suggestion: Suggestion | null,
  schemaError: string | null,
): CaseScore {
  const dims: DimensionScores = {
    schema_valid: schemaError ? 0 : 1,
    target_step: 0,
    assertion_kind: 0,
    fields_referenced: 0,
    severity_ok: 0,
  };

  if (suggestion) {
    dims.target_step = scoreTargetStep(suggestion, c.gold);
    dims.assertion_kind = scoreAssertionKind(suggestion, c.gold);
    dims.fields_referenced = scoreFieldsReferenced(suggestion, c.gold);
    dims.severity_ok = scoreSeverity(suggestion, c.gold);
  }

  const total =
    (dims.schema_valid +
      dims.target_step +
      dims.assertion_kind +
      dims.fields_referenced +
      dims.severity_ok) /
    5;

  return {
    case_id: c.id,
    failure_type: c.failure_type,
    schema_error: schemaError,
    dimensions: dims,
    total,
    suggestion,
  };
}

// --- dimension scorers ---------------------------------------------------

function scoreTargetStep(s: Suggestion, gold: EvalGold): number {
  // Extract the step name from `when: step == "<name>"`.
  const m = s.code_yaml.match(/when:\s*step\s*==\s*["']([^"']+)["']/);
  if (!m) return 0;
  return m[1] === gold.expected_target_step ? 1 : 0;
}

function scoreAssertionKind(s: Suggestion, gold: EvalGold): number {
  const kind = categorizeAssertion(s.code_yaml);
  return kind === gold.expected_assertion_kind ? 1 : 0;
}

/**
 * Heuristic categorisation. Order matters:
 *   count (most specific) > regex > schema (multi-presence) > not_empty
 *   > contains > equality (most general).
 */
export function categorizeAssertion(yaml: string): AssertionKind {
  // Pull just the assert lines so we don't confuse on `when` or `test`.
  const assertLines = yaml
    .split("\n")
    .filter((l) => /^\s*assert:/.test(l) || /^\s{2,}/.test(l))
    .join(" ")
    .toLowerCase();

  if (/\bcount\s*\(/.test(assertLines) || /\blen\s*\(/.test(assertLines)) {
    return "count";
  }
  if (/matches\s+\//.test(assertLines) || /\bregex\b/.test(assertLines)) {
    return "regex";
  }
  // Schema-violation tests assert presence of *multiple* fields. Check
  // this BEFORE not_empty so `output.a != null and output.b != null`
  // is classified as schema rather than the single-field not_empty.
  const presenceChecks =
    (assertLines.match(/!=\s*null/g) ?? []).length +
    (assertLines.match(/\bexists\s*\(/g) ?? []).length;
  if (presenceChecks >= 2) {
    return "schema";
  }
  if (
    /!=\s*\[\s*\]/.test(assertLines) ||
    /!=\s*null/.test(assertLines) ||
    /\bis\s+not\s+empty\b/.test(assertLines) ||
    /\bnot\s+empty\b/.test(assertLines) ||
    /\.length\s*>\s*0/.test(assertLines)
  ) {
    return "not_empty";
  }
  if (/\bcontains\b/.test(assertLines)) {
    return "contains";
  }
  if (/==|!=|<|>/.test(assertLines)) {
    return "equality";
  }
  return "equality";
}

function scoreFieldsReferenced(s: Suggestion, gold: EvalGold): number {
  if (gold.expected_fields_referenced.length === 0) return 1;
  const haystack = s.code_yaml.toLowerCase();
  let hit = 0;
  for (const f of gold.expected_fields_referenced) {
    if (haystack.includes(f.toLowerCase())) hit += 1;
  }
  return hit / gold.expected_fields_referenced.length;
}

function scoreSeverity(s: Suggestion, gold: EvalGold): number {
  return SEVERITY_RANK[s.severity] >= SEVERITY_RANK[gold.expected_severity_min]
    ? 1
    : 0;
}

// --- aggregate report ----------------------------------------------------

export type EvalReport = {
  cases: CaseScore[];
  aggregate: {
    total: number;
    schema_valid: number;
    target_step: number;
    assertion_kind: number;
    fields_referenced: number;
    severity_ok: number;
  };
  by_failure_type: Record<string, { total: number; count: number }>;
};

export function aggregate(cases: CaseScore[]): EvalReport {
  const n = cases.length || 1;
  const sum = (k: keyof DimensionScores) =>
    cases.reduce((acc, c) => acc + c.dimensions[k], 0) / n;

  const byType: Record<string, { total: number; count: number }> = {};
  for (const c of cases) {
    if (!byType[c.failure_type]) byType[c.failure_type] = { total: 0, count: 0 };
    byType[c.failure_type].total += c.total;
    byType[c.failure_type].count += 1;
  }

  return {
    cases,
    aggregate: {
      total: cases.reduce((a, c) => a + c.total, 0) / n,
      schema_valid: sum("schema_valid"),
      target_step: sum("target_step"),
      assertion_kind: sum("assertion_kind"),
      fields_referenced: sum("fields_referenced"),
      severity_ok: sum("severity_ok"),
    },
    by_failure_type: Object.fromEntries(
      Object.entries(byType).map(([k, v]) => [
        k,
        { total: v.total / v.count, count: v.count },
      ]),
    ),
  };
}

export function formatReport(report: EvalReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("Per-case results");
  lines.push("=".repeat(78));
  for (const c of report.cases) {
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    const tag = c.total >= 0.8 ? "PASS" : c.total >= 0.6 ? "WARN" : "FAIL";
    lines.push(
      `[${tag}] ${c.case_id.padEnd(28)} ${c.failure_type.padEnd(22)} ` +
        `total=${pct(c.total).padStart(4)}  ` +
        `schema=${c.dimensions.schema_valid} ` +
        `step=${c.dimensions.target_step} ` +
        `kind=${c.dimensions.assertion_kind} ` +
        `fields=${pct(c.dimensions.fields_referenced).padStart(4)} ` +
        `sev=${c.dimensions.severity_ok}`,
    );
    if (c.schema_error) lines.push(`       schema_error: ${c.schema_error}`);
  }

  lines.push("");
  lines.push("=".repeat(78));
  lines.push("By failure type");
  lines.push("=".repeat(78));
  for (const [ft, v] of Object.entries(report.by_failure_type)) {
    lines.push(
      `  ${ft.padEnd(28)} ${(v.total * 100).toFixed(1).padStart(5)}%   (n=${v.count})`,
    );
  }

  lines.push("");
  lines.push("=".repeat(78));
  lines.push("Aggregate (all cases)");
  lines.push("=".repeat(78));
  const a = report.aggregate;
  const row = (label: string, v: number) =>
    `  ${label.padEnd(28)} ${(v * 100).toFixed(1).padStart(5)}%`;
  lines.push(row("schema_valid", a.schema_valid));
  lines.push(row("target_step", a.target_step));
  lines.push(row("assertion_kind", a.assertion_kind));
  lines.push(row("fields_referenced", a.fields_referenced));
  lines.push(row("severity_ok", a.severity_ok));
  lines.push("  " + "-".repeat(34));
  lines.push(row("TOTAL", a.total));
  lines.push("");
  lines.push(
    a.total >= 0.8
      ? "RESULT: PASS (>= 80% target)"
      : `RESULT: BELOW TARGET (need >= 80%, got ${(a.total * 100).toFixed(1)}%)`,
  );
  lines.push("");
  return lines.join("\n");
}
