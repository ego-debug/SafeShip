# Suggest-engine offline eval

What this is: a small, ground-truth eval set we run against the
production prompt in `lib/suggest.ts` to measure suggestion quality
**before** prompt changes ship to customers.

## Why

The suggest engine is the wedge — it's what no other tool does. We
need a deterministic way to check that prompt edits or model swaps
don't regress it. Customer feedback (accept-rate at `/app/suggestions`)
arrives weeks later and is noisy. This loop runs in 60 seconds and
costs ~$0.15 per pass.

## What it covers

Four failure types that account for the bulk of agent breakage in the
wild (see `failure-types.md` for the canonical definitions):

1. `hallucinated_value` — LLM step output contradicts a fact from an
   earlier tool step.
2. `silent_empty_result` — tool returned empty/null but the agent
   proceeded as if it had data.
3. `schema_violation` — output is missing a required field or has a
   wrong type.
4. `tool_loop` — the same tool was called repeatedly without
   converging, or the step budget blew out.

Three cases per type = **12 cases total**.

## How to run

```bash
ANTHROPIC_API_KEY=sk-... npm run eval:suggest
```

The runner loads every case in `cases/`, calls `suggestFromRun()`,
scores the output against the case's `gold` block, and prints a
per-case + aggregate report.

## Scoring

Each case is scored across five dimensions (each 0–1):

- **schema_valid** — Zod schema accepted the tool output.
- **target_step** — the YAML `when:` clause pins the right tool.
- **assertion_kind** — the assertion expression matches the gold
  category (equality / contains / not_empty / regex / count / schema).
- **fields_referenced** — every gold-required field path appears in
  the assertion expression.
- **severity_ok** — proposed severity meets or exceeds the gold floor.

Per-case score = mean of the five. Aggregate = mean across cases.
Target: **≥ 0.80 aggregate** before shipping a prompt change.

## Adding a case

Drop a new file in `cases/<failure_type>/`. Schema is in `score.ts`
(the `EvalCase` type). The fastest way to grow the set is to copy a
real anonymised production trace into a new file and hand-write the
`gold` block.
