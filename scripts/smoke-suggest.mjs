// Smoke-test the auto-suggest engine end-to-end against a real Anthropic
// call. Bypasses the Next.js dev server (which has a local env-loading
// quirk) by using Node's --env-file flag directly.
//
// Usage:
//   node --env-file=.env.local scripts/smoke-suggest.mjs
//
// What it does:
//   1. Builds a synthetic failing run with a classic "hallucinated
//      refund amount" failure mode.
//   2. Renders it the same way lib/suggest.ts:renderRunAsPrompt does.
//   3. Calls Claude with the same model, system prompt, and tool
//      definition as the production engine.
//   4. Prints the resulting YAML + name + plain English + severity +
//      rationale.
//
// Cost: ~$0.01 per run at Sonnet 4.6 prices. Use sparingly; this is for
// validation, not regression coverage.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.SAFESHIP_SUGGEST_MODEL || "claude-sonnet-4-6";
const MAX_TOKENS = Number(process.env.SAFESHIP_SUGGEST_MAX_TOKENS) || 2048;

// Note: kept in sync by hand with lib/suggest.ts SYSTEM_PROMPT. If you
// change either, change both. (Long-term: factor into a shared file.)
const SYSTEM_PROMPT = `You are SafeShip's regression-test author. Your job: given a single failed agent run (with the trace of every step), propose ONE regression test that would have caught this exact failure mode, and that would catch the failure if it recurred in production.

# What makes a good regression test

1. **Specific to the failure mode, not the failure**. If draft_reply produced "$249.00" when the correct order total was "$24.99", a good test asserts "the refund amount in draft_reply.output must equal order.total" — not "draft_reply must equal '$24.99'".
2. **Mechanically checkable**. Express the assertion as a relation between fields in the trace (input → output equality, regex matches, value-in-set, value-must-not-contain). Don't ask the test runner to "use judgment".
3. **Targets the step that broke**, not the entire run. The YAML test should pin a \`when: step == "<tool_name>"\` clause to the failing step.
4. **Stable name**. Short snake_case with a dot separator. Format: \`<tool_name>.<rule>\` — e.g. \`draft_reply.refund_matches_order\`, \`classify_intent.confidence_above_threshold\`, \`lookup_order.no_silent_404\`.

# Output format

Call the \`record_suggestion\` tool exactly once. Fields:

- **name** — \`<tool>.<rule>\` snake_case identifier
- **plain_english** — one sentence stating what the test enforces. Plain language, no jargon.
- **code_yaml** — YAML block in this shape:

    test: <same name>
    when: step == "<tool_name>"
    assert: <expression>

  The \`assert\` expression is a single-line predicate using these primitives:
  - dot access: \`output.amount\`, \`input.order.total\`
  - equality / inequality: \`==\`, \`!=\`
  - regex: \`output matches /pattern/\`
  - contains: \`output contains "substring"\`
  - boolean ops: \`and\`, \`or\`, \`not\`

  Use multiple lines (newline-separated YAML) when you need a list of assertions.

- **severity** — \`low\` / \`medium\` / \`high\`. Use \`high\` if this failure mode would directly cost the customer money or trust if it recurred; \`medium\` if it'd produce a wrong-but-recoverable answer; \`low\` for cosmetic or latency issues.
- **rationale** — 1-2 sentences explaining why this test would catch the regression. Reference the specific input/output that went wrong.

# Hard rules

- Output ONE tool call, no prose before or after.
- Never reference a step or field that isn't in the provided trace.
- Never invent test infrastructure ("call function X") — assertions must read directly off trace fields.
- If the trace doesn't contain enough information to write a meaningful test (no failing step, no observable wrong output), still call the tool, set severity=low, and explain in rationale why the trace is insufficient. Don't refuse.`;

const TOOL = {
  name: "record_suggestion",
  description:
    "Record the regression test suggestion. Call this exactly once per trace.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      plain_english: { type: "string" },
      code_yaml: { type: "string" },
      severity: { type: "string", enum: ["low", "medium", "high"] },
      rationale: { type: "string" },
    },
    required: ["name", "plain_english", "code_yaml", "severity", "rationale"],
  },
};

// Synthetic failing run — classic refund-hallucination scenario from the
// system prompt's Example A. If the engine works, it should produce
// something close to `draft_reply.refund_matches_order` or equivalent.
const SYNTHETIC_RUN = {
  id: "smoke-test-run-001",
  project_name: "smoke-test-project",
  project_environment: "dev",
  trigger: "manual",
  status: "fail",
  score: null,
  duration_ms: 1240,
  model: "claude-sonnet-4-6",
  steps: [
    {
      step_index: 0,
      tool_name: "classify_intent",
      kind: "llm",
      input: "I need a refund for my order #4829",
      output: { intent: "refund_request", order_id: "4829" },
      duration_ms: 214,
      status: "ok",
    },
    {
      step_index: 1,
      tool_name: "lookup_order",
      kind: "tool",
      input: { order_id: "4829" },
      output: {
        order_id: "4829",
        total: "$24.99",
        items: [{ name: "USB cable", price: "$24.99" }],
      },
      duration_ms: 320,
      status: "ok",
    },
    {
      step_index: 2,
      tool_name: "draft_reply",
      kind: "llm",
      input: {
        intent: "refund_request",
        order: { order_id: "4829", total: "$24.99" },
      },
      output:
        "I've processed your refund of $249.00 for order #4829. You'll see the credit in 3-5 business days.",
      duration_ms: 612,
      status: "fail",
    },
  ],
};

function renderRunAsPrompt(run) {
  const failingStep = run.steps.find((s) => s.status === "fail");
  const lines = [
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
    const marker =
      s.status === "fail" ? "❌ FAILED" : s.status === "warn" ? "⚠ warn" : "✓ ok";
    lines.push(
      `## step ${s.step_index}: ${s.tool_name ?? "(unnamed)"} [${s.kind ?? "?"}] — ${marker}`,
    );
    lines.push(`duration_ms: ${s.duration_ms ?? "(none)"}`);
    lines.push(`input: ${JSON.stringify(s.input)}`);
    lines.push(`output: ${JSON.stringify(s.output)}`);
    lines.push(``);
  }
  if (failingStep) {
    lines.push(
      `# Focus`,
      ``,
      `The failing step is step ${failingStep.step_index} (${failingStep.tool_name}). Write a test that targets that step.`,
    );
  }
  return lines.join("\n");
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set. Run with:");
    console.error("  node --env-file=.env.local scripts/smoke-suggest.mjs");
    process.exit(1);
  }
  console.error(
    `Model: ${MODEL} · max_tokens: ${MAX_TOKENS} · key: ${apiKey.slice(0, 12)}...`,
  );

  const client = new Anthropic({ apiKey });
  const userPrompt = renderRunAsPrompt(SYNTHETIC_RUN);
  console.error("\n--- User prompt ---\n" + userPrompt + "\n");

  const t0 = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "record_suggestion" },
    messages: [{ role: "user", content: userPrompt }],
  });
  const elapsed = Date.now() - t0;

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) {
    console.error("FAIL: no tool call in response");
    console.error(JSON.stringify(response.content, null, 2));
    process.exit(2);
  }

  const s = toolUse.input;
  console.log("=".repeat(64));
  console.log("STAGE 5 SMOKE TEST RESULT");
  console.log("=".repeat(64));
  console.log(`Model:        ${MODEL}`);
  console.log(`Elapsed:      ${elapsed}ms`);
  console.log(`Input tokens: ${response.usage?.input_tokens ?? "?"}`);
  console.log(`Output tokens: ${response.usage?.output_tokens ?? "?"}`);
  console.log("-".repeat(64));
  console.log(`Name:         ${s.name}`);
  console.log(`Severity:     ${s.severity}`);
  console.log(`Plain Eng:    ${s.plain_english}`);
  console.log(`Rationale:    ${s.rationale}`);
  console.log("-".repeat(64));
  console.log("YAML:");
  console.log(s.code_yaml);
  console.log("=".repeat(64));

  // Approximate quality check
  const yaml = s.code_yaml.toLowerCase();
  const targetsFailingStep = yaml.includes("draft_reply");
  const referencesOrderTotal =
    yaml.includes("lookup_order") || yaml.includes("order.total") || yaml.includes("24.99");
  const isSpecific = !yaml.includes("249.00") || yaml.includes("contains") || yaml.includes("matches");

  console.log(
    `\nHeuristic checks:` +
      `\n  targets failing step (draft_reply):    ${targetsFailingStep ? "✓" : "✗"}` +
      `\n  references order.total fixture:        ${referencesOrderTotal ? "✓" : "✗"}` +
      `\n  specific-to-mode (not hardcoded value): ${isSpecific ? "✓" : "✗"}`,
  );
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  if (err.status) console.error("HTTP status:", err.status);
  if (err.error) console.error(JSON.stringify(err.error, null, 2));
  process.exit(1);
});
