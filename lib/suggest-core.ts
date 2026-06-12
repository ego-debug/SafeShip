/**
 * Pure suggest-engine core — no `server-only` import, so it can be
 * exercised from the offline eval runner (`evals/suggest/run.ts`)
 * without going through Next.js' bundler.
 *
 * Application code should import from `./suggest` (which re-exports
 * everything here with the `server-only` guard in place).
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { RunDetail } from "./runs";

// Configurable via SAFESHIP_SUGGEST_MODEL env var. Defaults to Sonnet 4.6 —
// good balance of structured-output quality and cost (~$0.01/call with
// system-prompt caching). Drop to claude-haiku-4-5 for ~3x cheaper if test
// suggestions look acceptable in your evals; bump to claude-opus-4-7 if
// quality regresses. Pricing per million tokens (cached 2026-04):
//   opus-4-7:   $5 in / $25 out   — overkill for this task
//   sonnet-4-6: $3 in / $15 out   — current default
//   haiku-4-5:  $1 in / $5  out   — try first if cost matters more than quality
const MODEL = (process.env.SAFESHIP_SUGGEST_MODEL ||
  "claude-sonnet-4-6") as string;
const MAX_TOKENS = Number(process.env.SAFESHIP_SUGGEST_MAX_TOKENS) || 2048;

const SuggestionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_.]*$/, "must be snake_case with dots"),
  plain_english: z.string().min(8).max(280),
  code_yaml: z.string().min(8).max(4000),
  severity: z.enum(["low", "medium", "high"]),
  rationale: z.string().min(8).max(600),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

export const SYSTEM_PROMPT = `You are SafeShip's regression-test author. Your job: given a single failed agent run (with the trace of every step), propose ONE regression test that would have caught this exact failure mode, and that would catch the failure if it recurred in production.

# What makes a good regression test

1. **Specific to the failure mode, not the failure**. If draft_reply produced "$249.00" when the correct order total was "$24.99", a good test asserts "the refund amount in draft_reply.output must equal order.total", not "draft_reply must equal '$24.99'".
2. **Mechanically checkable**. Express the assertion as a relation between fields in the trace (input → output equality, regex matches, value-in-set, value-must-not-contain). Don't ask the test runner to "use judgment".
3. **Targets the root-cause step**, not the entire run. The YAML test should pin a \`when: step == "<tool_name>"\` clause to the step that caused the failure. Important: the step marked FAILED in the trace is where the failure *surfaced*, which is often NOT the root cause. When a tool crashes because an earlier step handed it malformed or empty data, the root cause is that earlier step (often marked warn or even ok). Pin \`when:\` to the step that *produced* the bad output, not the downstream victim.
4. **Stable name**. Short snake_case with a dot separator. Format: \`<tool_name>.<rule>\`, e.g. \`draft_reply.refund_matches_order\`, \`classify_intent.confidence_above_threshold\`, \`lookup_order.no_silent_404\`.

# Pick the assertion shape that fits the failure

The trace shows you which of these failure modes happened. Pick the matching shape:

- **Hallucinated value**: an LLM step output contains a value that contradicts a fact from an earlier tool step. → \`output contains <earlier_step>.<field>\` (or \`==\`). Pin \`when:\` to the LLM step that hallucinated.
- **Silent empty result**: a tool returned empty list / null / zero matches and the agent proceeded as if it had data. → \`output.<results_field> != [] and output.<results_field> != null\` (or \`or output.status == "not_found"\` if a fallback status is reasonable). Pin \`when:\` to the tool that silently returned empty — NOT the downstream LLM step that consumed the emptiness, even if that's the step marked failed. The contract being enforced is "this tool must not return empty without saying so".
- **Schema violation**: output is missing a required field or has the wrong type. → presence checks: \`output.<field_a> != null and output.<field_b> != null\`. Assert EVERY required field of the schema, including ones that happened to be present in this run — the test pins the whole contract, so always at least two presence checks. Use plain \`!= null\` checks only; don't mix in regex or count, which dilute the schema shape. Pin \`when:\` to the step that produced the malformed output, not the downstream step that crashed reading it. Severity is usually medium-to-high because downstream steps crash.
- **Tool loop**: the same tool was called repeatedly without converging. → \`count(steps where step == "<tool_name>") <= <budget>\`. Pin \`when:\` to that tool. Pick a budget that's clearly above legitimate retry (e.g. 2 or 3) but well below the observed runaway count.

# Output format

Call the \`record_suggestion\` tool exactly once. Fields:

- **name**: \`<tool>.<rule>\` snake_case identifier
- **plain_english**: one sentence stating what the test enforces. Plain language, no jargon.
- **code_yaml**: YAML block in this shape:

    test: <same name>
    when: step == "<tool_name>"
    assert: <expression>

  The \`assert\` expression is a single-line predicate using these primitives:
  - dot access: \`output.amount\`, \`input.order.total\`, \`<other_step>.output.<field>\`
  - equality / inequality: \`==\`, \`!=\`
  - regex: \`output matches /pattern/\`
  - contains: \`output contains "substring"\` or \`output contains <other_step>.output.<field>\`
  - non-empty: \`output.<field> != []\`, \`output.<field> != null\`
  - count over the run: \`count(steps where step == "<tool_name>") <= N\`
  - boolean ops: \`and\`, \`or\`, \`not\`

  Use multiple lines (newline-separated YAML) when you need a list of assertions.

- **severity**: \`low\` / \`medium\` / \`high\`. Use \`high\` if this failure mode would directly cost the customer money or trust if it recurred; \`medium\` if it'd produce a wrong-but-recoverable answer; \`low\` for cosmetic or latency issues.
- **rationale**: 1-2 sentences explaining why this test would catch the regression. Reference the specific input/output that went wrong.

Style rule for plain_english and rationale: write plainly, like a senior engineer in a code review. Never use em dashes; use periods, commas, or colons instead.

# Examples

## Example A: hallucinated refund amount

Failing step: draft_reply (LLM)
input: {ctx: "order"}
output: "refund of $249.00"
Other steps show: lookup_order returned {total: "$24.99"}

→ name: \`draft_reply.refund_matches_order\`
→ plain_english: "Refund amounts in draft_reply output must exactly match the order.total returned by lookup_order. No invented numbers."
→ code_yaml:
    test: draft_reply.refund_matches_order
    when: step == "draft_reply"
    assert: output contains lookup_order.output.total
→ severity: high
→ rationale: "draft_reply hallucinated a $249.00 refund instead of the correct $24.99 from lookup_order. This test fails when the dollar amount in the reply doesn't appear in the order context."

## Example B: silent KB miss

Failing step: search_kb (tool)
output: empty list, no error
Other steps proceeded as if results were valid

→ name: \`search_kb.no_silent_empty\`
→ plain_english: "search_kb must not return an empty result list. It must either return matches or raise an explicit not_found error."
→ code_yaml:
    test: search_kb.no_silent_empty
    when: step == "search_kb"
    assert: (output.results != [] and output.results != null) or output.status == "not_found"
→ severity: medium
→ rationale: "search_kb returned [] silently while the agent proceeded as if it had matches. This test fails on empty results unless an explicit not_found status accompanies them."

## Example C: schema violation

Failing step: classify_intent (LLM)
output: bare string "refund_request"
Downstream: route_to_queue crashed with TypeError reading .intent

→ name: \`classify_intent.returns_object_with_confidence\`
→ plain_english: "classify_intent must return an object with both intent and confidence fields, not a bare string."
→ code_yaml:
    test: classify_intent.returns_object_with_confidence
    when: step == "classify_intent"
    assert: output.intent != null and output.confidence != null
→ severity: high
→ rationale: "classify_intent returned the string 'refund_request' so the downstream router crashed reading .intent. The test fails whenever either field is missing or null."

## Example D: tool loop

Failing step pattern: lookup_order called 8 times with the same input, each returning not_found

→ name: \`lookup_order.call_count_budget\`
→ plain_english: "lookup_order must not be called more than 2 times in a single run."
→ code_yaml:
    test: lookup_order.call_count_budget
    when: step == "lookup_order"
    assert: count(steps where step == "lookup_order") <= 2
→ severity: medium
→ rationale: "lookup_order was invoked 8 times for the same order_id, each returning not_found. The test fires once the call count exceeds the budget."

# Hard rules

- Output ONE tool call, no prose before or after.
- Never reference a step or field that isn't in the provided trace.
- Never hardcode literal values copied from this run's outputs when the value can be referenced by field path. Write \`output.text contains lookup_order.output.total\`, not \`output.text contains "$24.99"\`; write \`output.text contains list_availability.output.slots\`, not an or-chain of the slot strings from this run. Hardcoded literals only match this exact run and won't catch the regression on the next one.
- Never invent test infrastructure ("call function X"). Assertions must read directly off trace fields.
- If the trace doesn't contain enough information to write a meaningful test (no failing step, no observable wrong output), still call the tool, set severity=low, and explain in rationale why the trace is insufficient. Don't refuse.`;

const TOOL: Anthropic.Tool = {
  name: "record_suggestion",
  description:
    "Record the regression test suggestion. Call this exactly once per trace.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Short snake_case identifier with dot separator, e.g. 'draft_reply.refund_matches_order'.",
      },
      plain_english: {
        type: "string",
        description:
          "One sentence stating what the test enforces. Plain language, no jargon.",
      },
      code_yaml: {
        type: "string",
        description:
          "YAML test definition with test/when/assert keys. See system prompt for exact format.",
      },
      severity: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Estimated severity if this regression recurred.",
      },
      rationale: {
        type: "string",
        description:
          "1-2 sentences explaining why this test would catch the failure mode.",
      },
    },
    required: ["name", "plain_english", "code_yaml", "severity", "rationale"],
  },
};

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY missing in .env.local");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export function isSuggestEngineConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Generate one suggestion from a failed run. Throws on auth / quota / model
 * errors so the caller can decide how to report (per-trace skip vs full stop).
 */
export async function suggestFromRun(run: RunDetail): Promise<Suggestion> {
  const client = getClient();

  const userPrompt = renderRunAsPrompt(run);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Cache the system prompt — same bytes across every suggestion call.
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "record_suggestion" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("suggest_no_tool_call");
  }

  const parsed = SuggestionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`suggest_invalid_schema: ${parsed.error.message}`);
  }

  return parsed.data;
}

function renderRunAsPrompt(run: RunDetail): string {
  const failingStep = run.steps.find((s) => s.status === "fail");
  const lines: string[] = [
    `# Failed agent run`,
    ``,
    `run_id: ${run.id}`,
    `project: ${run.project_name} (${run.project_environment})`,
    `model: ${run.model ?? "(unknown)"}`,
    `trigger: ${run.trigger}`,
    `status: ${run.status}`,
    `score: ${run.score ?? "(none)"}`,
    `duration_ms: ${run.duration_ms ?? "(none)"}`,
    ``,
    `# Trace steps`,
    ``,
  ];

  for (const s of run.steps) {
    const marker = s.status === "fail" ? "❌ FAILED" : s.status === "warn" ? "⚠ warn" : "✓ ok";
    lines.push(
      `## step ${s.step_index}: ${s.tool_name ?? "(unnamed)"} [${s.kind ?? "?"}] ${marker}`,
    );
    lines.push(`duration_ms: ${s.duration_ms ?? "(none)"}`);
    lines.push(`input: ${trimForPrompt(s.input)}`);
    lines.push(`output: ${trimForPrompt(s.output)}`);
    lines.push(``);
  }

  if (failingStep) {
    lines.push(
      `# Focus`,
      ``,
      `The failure surfaced at step ${failingStep.step_index} (${failingStep.tool_name}). That is where the run broke, but it is not necessarily the root cause: check whether an earlier step (even one marked ok or warn) produced the malformed, empty, or wrong output that made this step fail. Pin the test's \`when:\` to the root-cause step per the failure-mode guidance.`,
    );
  } else {
    lines.push(
      `# Note`,
      ``,
      `No single step is marked failed, but the run status is "${run.status}". Use your judgment: pick the step that most likely caused the wrong outcome.`,
    );
  }

  return lines.join("\n");
}

const MAX_FIELD_CHARS = 2000;

function trimForPrompt(value: unknown): string {
  if (value == null) return "(none)";
  let s: string;
  if (typeof value === "string") {
    s = value;
  } else {
    try {
      s = JSON.stringify(value);
    } catch {
      s = String(value);
    }
  }
  if (s.length > MAX_FIELD_CHARS) {
    return s.slice(0, MAX_FIELD_CHARS) + "…[truncated]";
  }
  return s;
}
