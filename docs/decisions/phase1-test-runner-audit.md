# SafeShip v1 — Test-Runner Gap Audit & Plan

**Date:** 2026-05-13
**Status:** Phase 1 audit — **approved in principle, with five clarifications applied below.** Phase 2 starts after this round of revisions is reviewed.

> **Revision note (2026-05-13):** original audit recommended a hand-rolled AST walker for the assertion evaluator and `mode: test` as the new default. After review, both were revised: **use `simpleeval`** for the evaluator, and **`mode: auto`** as the default to preserve backward compatibility with existing score-gate workflows. Timing also recalibrated for solo-founder pace. All revisions inline below.

## Context

The promise on the landing page and in customer-facing docs is:

> Drop in a 4-line SDK — SafeShip captures the trace, writes the assertion, and **blocks any future deploy that would reproduce it.**

This audit examines whether the shipping code delivers that "blocks any future deploy that would reproduce it" half.

**Audit verdict:** Steps 1–4 of the customer mental model (SDK trace capture → auto-generated YAML assertion → developer accepts → joins regression suite) are built and working. **Steps 5–6 are partial** — the GitHub Action checks the *most recent production run's regression score against a threshold*, not "replay each accepted YAML test against the new code in this PR."

The implication: today, the Action catches *average degradation in production after it ships*. The promised behavior is to catch *specific regressions before they ship* by executing the new code against historical failure fixtures. This document plans closing that gap.

---

## What's already there (reusable as-is)

| Component | File(s) | Role in new flow |
|---|---|---|
| SDK agent wrapper | `sdks/python/safeship/_wrap.py` | We reuse `wrap()` inside the test runner to invoke the customer's agent and capture a trace. The same wrapping machinery that ships traces to /v1/traces in prod will, in test mode, hand the trace to our assertion evaluator instead of the network. |
| SDK transport | `sdks/python/safeship/_transport.py` | Already daemon-threaded, retry-with-backoff, swallows errors. Untouched. Optional: in test mode, we may *also* ship the replay trace to /v1/traces so the dashboard shows "this test ran" — TBD. |
| SDK config + init | `_config.py`, `__init__.py` | We add a new entry point (`safeship test`) but reuse the existing `init()` / `wrap()` for invocation. |
| Suggestion engine | `lib/suggest.ts` | Generates the YAML. No changes — the DSL we ship is whatever this engine produces, per the "we're consumers, not designers" rule. |
| `suggested_tests` / `tests` schema | `supabase/schema.sql` | Already stores `name`, `plain_english`, `code_yaml`, `status`, `run_id`, `trace_id`. One additive change needed (see below). |
| Trace storage | `runs` + `traces` tables | The original failing run's input is already in `traces.input` for the entry step. That IS the replay fixture — we just don't surface it via API yet. |
| Score-gate endpoint | `app/v1/runs/check/route.ts` | Stays exactly as-is. Becomes the "legacy / ambient monitoring" mode. |
| GitHub Action shell | `.github/actions/safeship/action.yml` | Keep the composite-action skeleton. Add a `mode` input. Default flips to `test`; `score-gate` becomes the alternative. |
| Authentication pattern | `Bearer sk_live_*` on `/v1/*` | Reused for the manifest endpoint and any new CI-facing endpoints. |

## What's missing entirely

| Gap | Where it lives | Why |
|---|---|---|
| **Replay fixture storage** | `tests` table column + suggestion-write path | `tests.code_yaml` has the assertion but not the input that produced the original failure. Need a `replay_input` JSONB column (denormalized for fast CI fetch — alternative would be a JOIN on `traces` at fetch time, but denormalization keeps the manifest endpoint a single-table read and survives later trace deletion). |
| **Test manifest API** | `app/v1/tests/manifest/route.ts` (new) | CI needs `GET /v1/tests/manifest` returning all active tests for the authenticating project + their replay fixtures. Same Bearer auth as `/v1/traces`. |
| **Assertion DSL evaluator** | `sdks/python/safeship/_assertions.py` (new) | Parse YAML `when:` / `assert:` clauses, evaluate against a captured trace. **Must NOT use `eval()`.** |
| **Test runner module** | `sdks/python/safeship/_testrunner.py` (new) | Fetch manifest → for each test, invoke the customer's agent with the replay input (using `wrap()` to capture a trace) → evaluate the YAML assertion against the new trace → record pass/fail. |
| **`safeship test` CLI** | `sdks/python/safeship/cli.py` (new) + entry in `pyproject.toml` | Customer invokes via `safeship test` in CI. Loads project config, calls test runner, prints results, returns exit code. |
| **Project config file** | `safeship.yaml` at customer's repo root (convention) | Declares the agent entry point so the runner knows what to call. |
| **Action mode switch** | Edit `.github/actions/safeship/action.yml` | New `mode: auto \| test \| score-gate` input. **Default `auto`** — runs test mode if `safeship.yaml` is present at repo root, else falls back to score-gate. Explicit `test` or `score-gate` always wins. Preserves backward compatibility with existing customers who only have the score-gate workflow today. |
| **PR comment renderer** | Inside the Action bash | Post / update a single PR comment with a results table, using a stable HTML-comment marker so re-runs replace rather than spam. |
| **Docs rewrite** | `app/docs/page.tsx` | Section 5 ("Block bad deploys") currently describes the score-gate. Needs to describe test-mode as the default, with score-gate as the alternative. |

## The natural shape

```
┌─────────────────────────────────────────────────────────────────┐
│  GitHub Action (mode: test, default)                             │
│  - sets up Python                                                │
│  - pip install safeship                                          │
│  - reads SAFESHIP_API_KEY from secrets                           │
│  - runs:  safeship test                                          │
│  - on non-zero exit, fails the PR check                          │
│  - posts/updates PR comment with results table                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  safeship CLI  (entry point in pyproject.toml)                  │
│  - reads safeship.yaml → finds agent entry point                 │
│  - GET /v1/tests/manifest (Bearer sk_live_*)                     │
│  - for each test: invoke agent(replay_input) wrapped → eval      │
│  - exit 0 if all pass, 1 if any fail                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Test runner (Python module)                                     │
│  - dynamically imports the customer's agent function             │
│  - wraps it with safeship.wrap (but in "local capture" mode)     │
│  - invokes with replay_input from manifest                       │
│  - feeds the captured trace into the assertion evaluator         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Assertion DSL evaluator                                         │
│  - parses YAML strings into ast                                  │
│  - whitelists safe operators only                                │
│  - resolves `output.foo.bar` / `input.x` against trace dict      │
│  - returns {passed: bool, reason: str}                           │
└─────────────────────────────────────────────────────────────────┘
```

The seams are clean: each layer has one job and a stable contract with the one above and below it. The web app side gets one new endpoint and one new column; the SDK gets three new modules; the Action gets a mode branch.

## Architectural decisions, with recommendations

### Q: How does the customer point the Action at their agent code?

Three options:

1. **Convention** (e.g., look for `safeship_agent.py:run`). Magical. Breaks for non-trivial repo layouts.
2. **Workflow YAML input** (`with: agent: src.foo:run`). Forces declaration in every workflow file.
3. **Config file at repo root** (`safeship.yaml` → `agent: src.foo:run`). Declared once, lives next to the code, easy to discover.

**Recommend (3).** Module path + function (gunicorn / pytest / fastapi convention). One file, lives in the customer's repo, source-controlled.

```yaml
# safeship.yaml
agent: src.my_agent:run
env_file: .env.ci    # optional; loads env vars before invoking the agent
```

The Action surface stays minimal: just `api-key` + `mode`.

### Q: How does the runtime evaluate the YAML assert expressions safely?

`eval()` is unsafe. Options:

1. `simpleeval` library (~700 LOC, battle-tested, restricted by default).
2. Hand-rolled `ast.parse` + walk with operator whitelist (~150 LOC, no new dependency).
3. Serialize the assertion into structured JSON on the server side at suggestion time and just have the runner evaluate the JSON tree.

**Decision: (1) — `simpleeval`.** The two non-Python DSL forms (`A contains B`, `A matches /regex/`) get a ~30-LOC pre-rewrite step before being handed to simpleeval:

- `A contains B` → `B in A` (simpleeval handles `in` natively)
- `A matches /regex/` → `re.search(r"regex", A) is not None` (register `re.search` as a safe callable)

Dot access on dicts handled by wrapping the trace context in an AttrDict-style proxy (~10 LOC). Total custom code: ~40 LOC of pre-processing around a battle-tested evaluator, vs ~150 LOC of hand-rolled AST walking.

We're consumers of the DSL Claude already generates per the brief, not designers of a new one. If the suggestion engine ever emits a form simpleeval can't reach even with pre-rewriting, option (3) (structured-JSON serialization at suggestion time) is the v2 escape hatch.

### Q: How do we surface per-test results?

Three channels, prioritized:

1. **Action log** (always): GitHub `::group::` per test, ❌/✅ summary at top
2. **GitHub PR check** (free): exit code becomes red/green check ✓
3. **PR comment** (when `pull-requests: write` token available): single stable comment, replaced on re-run via a `<!-- safeship:results -->` marker

**Decision: all three, with the PR comment step wrapped in `continue-on-error: true`.** The `safeship test` exit code is the authoritative pass/fail; the comment is enhancement. On forks (or repos without `pull-requests: write`), the `gh` call returns 403 — we catch that and emit `::warning::SafeShip: PR comment skipped — grant 'pull-requests: write' in your workflow permissions to see test results inline on the PR.` The check itself still passes or fails based purely on the runner's exit code.

### Q: Where does the fixture data come from when replaying?

Three options:

1. **Original trace's top-level input** (what the agent was called with the first time). Cleanest, no new customer work.
2. **Customer-defined fixtures** (they write `safeship test cases` somewhere). More work for the customer.
3. **Re-recorded fixtures from production** (mid-stream LLM responses captured & replayed). Powerful but complex — explicit v1 non-goal.

**Recommend (1).** When the suggestion is generated, also persist the original top-level input. CI replays with that. Same input → agent re-runs in CI (with real LLM calls) → new output is what we evaluate the assertion against.

**Caveat to document honestly:** if the agent has non-determinism (random LLM sampling, time-dependent tools), the test may pass or fail differently on each PR even with the same code. We accept this for v1 because (a) the determinism floor is the agent's, not ours, and (b) recorded-response replay is the v2 we already said we're not building yet.

## Effort estimate (solo founder pace, working days)

Estimates use a 1.5–2× multiplier from baseline "fluent dev pace" to reflect that the codebase was AI-generated and the founder is closer to a fluent reviewer than a fluent author. Optimistic = best case; realistic = expected duration with edge-case spillover.

| Component | Optimistic | Realistic | Notes |
|---|---|---|---|
| `_assertions.py` (simpleeval + pre-rewriter + AttrDict) | 0.5 d | 1.0 d | simpleeval handles whitelisting; we own only the rewrites + dot-access wrapper |
| `_testrunner.py` — fetch + invoke + evaluate | 1.0 d | 1.5 d | Reuses `wrap()` for trace capture |
| `cli.py` + `safeship.yaml` loader | 1.0 d | 1.5 d | Entry point + arg parsing + module-path resolution |
| Schema: `tests.replay_input JSONB` + suggestion write path | 0.5 d | 1.0 d | Migration + write-on-accept + sensible behavior for older rows w/o replay_input |
| `app/v1/tests/manifest/route.ts` | 0.5 d | 1.0 d | Same auth pattern as `/v1/traces` |
| Action: auto/test/score-gate switch + Python setup | 1.0 d | 1.5 d | `safeship.yaml` detection bash logic + sdk install |
| PR comment renderer + continue-on-error guard | 0.5 d | 1.0 d | Bash + `gh` CLI, stable marker |
| Docs rewrite (Section 5 + "How replay works" + "Determinism-friendly agents") | 0.5 d | 1.0 d | Includes cost expectations ($0.05–0.30/test/PR run) |
| End-to-end demo build + bugfixes | 2.5 d | 4.5 d | Customer repo layouts, import path edge cases, real PR flow |
| **Total** | **8.0 d** | **14.0 d** |  |
| **+ unknowns buffer (30%)** | — | **~18 d** | Don't-promise-before this date |

Risk concentration: the end-to-end demo (4.5 d realistic) — that's where customer-repo-layout assumptions, environment setup, and real-CI behavior break in ways the audit can't predict. Everything else is well-bounded.

## Constraints preserved (from the brief)

- SDK reliability guarantees stay non-negotiable: never crashes the customer's agent, never blocks on network, never makes extra LLM calls on the customer's API key.
- **Customer code never executes on SafeShip's servers.** Test execution happens in the customer's CI environment, with the customer's credentials and budget.
- The Anthropic key on SafeShip's backend is only used for generating regression-test suggestions from traces. Test execution requires no server-side LLM calls.
- The existing score-gate code path stays functional. New customers default to test mode; score-gate remains available as `mode: score-gate` in the Action.
- Pricing stays $29.99/mo flat. No usage tiers.

## Non-goals for v1 (explicit)

- **Recorded LLM response replay.** The v2 feature that caches mid-stream LLM responses so replay doesn't re-burn the customer's API budget. We document the cost expectation in the docs ("expect $0.05–$0.30 per accepted test per PR run") and move on.
- **Multi-language SDK.** Python only. TypeScript follows when there are paying Python customers asking.
- **Custom scorer DSL beyond what Claude currently generates.** We consume the DSL the suggestion engine already produces; we don't design a new one.

## Settled open questions

1. **Python setup ownership: customer's workflow, not the SafeShip Action.** The customer is responsible for `setup-python` and installing their agent's dependencies (`pip install -e .` or equivalent). The SafeShip Action installs only the SafeShip SDK on top. Documented as a prerequisite in the Action README.

2. **Manifest scope: include `original_trace_id` and `created_at` per test.** The PR comment can deep-link back to the original failure ("This test was generated from run #r_8f3a91 — view trace →"). Marginal payload cost is negligible; UX win is meaningful.

## Phase 2 implementation order (if approved)

Leaf → root, with verification at each step:

1. **`_assertions.py`** — DSL parser + evaluator. Verify with unit tests covering both example assertions from `lib/suggest.ts` plus edge cases (missing fields, malformed regex, unsupported operators).
2. **`_testrunner.py`** — pulls manifest, invokes agent, evaluates. Verify with a hand-rolled test fixture (mocked manifest endpoint, mocked agent module) end-to-end inside a single Python process.
3. **`cli.py` + `safeship.yaml` loader** — wire entry point in `pyproject.toml`. Verify by running `safeship test` locally against a toy agent + a toy manifest server.
4. **Schema migration + suggestion-write path** — adds `replay_input` JSONB to `tests`, populates it when a suggestion is accepted, backfills existing tests where possible. Verify by inspecting Supabase after accepting a new suggestion.
5. **`/v1/tests/manifest` endpoint** — auth, returns active tests + replay fixtures. Verify with `curl` from a project's API key.
6. **GitHub Action: test mode** — bash branch on `mode`, `setup-python`, `pip install safeship`, run CLI, surface results. Verify by adding to a test repo and forcing a PR.
7. **PR comment renderer** — `gh pr comment` with stable marker. Verify on the same test PR.
8. **Docs rewrite + cost expectations.** Verify by reading.
9. **End-to-end demo.** The full 7-step customer story from the brief.

## Documentation deltas (deferred until Phase 2 ships)

When the test-runner is working end-to-end:

- `app/docs/page.tsx` Section 5: replace the score-gate description with the test-runner. Add subsection on `safeship.yaml` schema. Add cost-expectation note ($0.05–$0.30 per test per PR run depending on how chatty the customer's agent is). Add a "What if I just want simple ambient monitoring?" subsection pointing to `mode: score-gate`.
- New section: **"How replay works."** Be honest. The customer should understand that non-deterministic agents may have flaky tests, and that's the agent's property, not ours.
- New subsection: **"Making your agent deterministic-friendly."** Concrete guidance:
  - set `temperature=0` on LLM calls (or whatever the equivalent is for the model)
  - pin `seed` parameter where the provider supports it
  - mock time-dependent inputs (`datetime.now()`, randomness sources, anything that varies between runs)
  - re-generate the suggestion / re-record the replay fixture if you've materially rewritten the prompt — old fixtures may no longer reproduce the failure even on broken code

---

**Ready for review.** Phase 2 proceeds only after explicit approval.
