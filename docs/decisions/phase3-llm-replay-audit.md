# SafeShip v2 — Recorded LLM Replay Audit & Plan

**Date:** 2026-05-15
**Status:** Phase 3 audit — **proposed for review.** No implementation has started.
**Audience:** Jovan (project owner) and any future contributors who pick this up.
**Companion documents:** [`phase1-test-runner-audit.md`](phase1-test-runner-audit.md) (assertion DSL + replay infra) · [`phase2-completion.md`](phase2-completion.md) (test mode shipped 2026-05-13).

---

## Context

Phase 2 closed the test-runner gap. Today, accepted regression tests are replayed against the customer's new code in CI via the `safeship` GitHub Action. The Action installs the SDK, fetches the test manifest, invokes the customer's agent with the original failing input, and evaluates the YAML assertion against the new trace.

**The replay invokes real LLM calls.** From the Phase 2 docs:

> Each replayed test re-invokes your agent with real LLM calls; budget roughly **$0.05–$0.30 per accepted test per PR run**, depending on how chatty your agent is.

This works, and it is the v1-correct trade. But Phase 2 explicitly named recorded LLM replay as a v2 deferment:

> **Recorded LLM response replay (v2).** Today the customer's agent makes real LLM calls in CI — cost is `$0.05–$0.30 per accepted test per PR run` per docs. v2 would cache the LLM responses from the original failing trace and replay them, making test mode free at the LLM-call layer. Real customers will ask for this when their tests get expensive enough to notice.

This document audits how we close that gap.

---

## Why now (the customer pain)

A solo dev with ten accepted tests, opening five PRs a week, runs the Action ~50 times a week. At a midpoint of $0.15 per test per PR, that is **$30–$60/month in the customer's own LLM bill, on top of SafeShip's $29.99/mo**, just to run their regression suite. The numbers grow linearly with both test count and PR cadence.

Two adjacent risks:

1. **Customers learn to skip tests.** When CI cost becomes uncomfortable, the natural response is to mute or delete tests, which silently rots the regression suite — exactly the failure mode SafeShip exists to prevent.
2. **Anthropic / OpenAI rate limits.** A repo with thirty tests opens a PR; the Action fans out thirty agent runs in CI; provider rate-limits start kicking in; tests start failing for non-regression reasons. We've already built the system that produces the most realistic load against the customer's own provider account, and that load is borne by them.

Recorded replay turns a regression-test suite from a recurring cost into a one-time capture cost (the original failing trace already paid for the LLM calls).

---

## What's already there (reusable as-is)

| Component | File | Role in v2 |
|---|---|---|
| SDK trace shape | `sdks/python/safeship/_wrap.py` and the `traces` table | Each step already records `input`, `output`, `tool_name`, `kind`, `duration_ms`, `status`. The `output` of an `llm`-kind step is the LLM response payload — the cache content is *already there*. We just don't currently persist it in a replay-addressable way. |
| Test runner | `sdks/python/safeship/_testrunner.py` | Already orchestrates the per-test flow (swap transport for local capture → wrap agent → invoke with replay input → evaluate). We add a recording-or-replay LLM transport here, parallel to the trace-capture transport. |
| `tests.replay_input` jsonb | Phase 2 schema | Holds the entry-point input. v2 adds a sibling column for cached LLM calls. |
| Manifest endpoint | `app/v1/tests/manifest/route.ts` | Already serves replay fixtures to the CLI. v2 adds the LLM-call fixture to the same payload. Single endpoint, no new route. |
| Acceptance write path | `lib/suggestions.ts` `acceptSuggestion()` | Already pulls `traces` for the failing run and copies the entry input. v2 also extracts the LLM-step outputs and writes them to the new column. |
| `safeship test` CLI | `sdks/python/safeship/cli.py` | Same entry point, no UX change. The replay is internal. |
| GitHub Action | `.github/actions/safeship/action.yml` | No change. The composite Action invokes the CLI; the new behavior lives inside the SDK. |

## What's missing entirely

| Gap | Where it lives (proposed) | Why |
|---|---|---|
| **Cached LLM call storage on the test record** | `tests.cached_llm_calls` jsonb column (additive migration) | Holds the per-step LLM responses that the test's replay should return when the customer's agent calls out to a provider. |
| **Recording-side LLM interceptor** | `sdks/python/safeship/_llm_recorder.py` (new) | Installed when the SDK is active and a request matches a known LLM host. Records the request fingerprint + response into a per-trace buffer. Buffer ships alongside the trace via the existing transport. |
| **Replay-side LLM interceptor** | `sdks/python/safeship/_llm_replayer.py` (new) | Installed by the test runner before invoking the customer's agent. Intercepts outbound HTTP to known LLM hosts and returns cached responses. Falls back to a configurable mode (live, fail, skip) on cache miss. |
| **Cache-key strategy** | inside `_llm_recorder.py` / `_llm_replayer.py` | We need a deterministic identifier for "this is the same LLM call as the recorded one." See "Architectural decisions" below — this is the hard part. |
| **httpx transport mount helper** | inside the recorder / replayer | The implementation surface for actual interception. Most modern LLM SDKs (Anthropic, OpenAI v1+) use httpx under the hood; mounting a custom transport is the cleanest entry point. Other transports (requests, urllib, aiohttp, gRPC) are out of scope for v2. |
| **Ingest extension** | `app/v1/traces/route.ts` and `lib/ingestion.ts` | Accept and persist a new optional `cached_llm_calls` field on the incoming trace payload. Belongs on the *trace* during recording, then promoted to the *test* on suggestion accept. |
| **Manifest extension** | `app/v1/tests/manifest/route.ts` | Add `cached_llm_calls` to the per-test JSON. Backward compat: omit the field when null. |
| **Replay mode selection** | `safeship.yaml` config + CLI flag | Customer chooses `replay_mode: cached_only \| cached_or_live \| live` per repo. Default (recommended): `cached_or_live` — cache hit returns recorded; cache miss makes a real call and warns. |
| **Docs section** | `app/docs/page.tsx` | New section "Free CI replay (cached LLM calls)" explaining the mechanism, the determinism caveats, and the per-mode trade-offs. |

---

## Architectural decisions to make

These are the calls that have to be made before any code is written. Recommendations are mine; flag any you want changed before implementation starts.

### 1. What do we cache? **LLM HTTP calls only, not all step outputs.**

The customer's agent does many things — DB lookups, internal tool calls, file I/O, MCP calls, LLM calls. Only the LLM calls are expensive enough to justify caching. Caching every `safeship.step()` would balloon the test record (some agents log megabytes of intermediate state) and would couple replay correctness to internal step shape, which we don't control.

Scope v2 to: HTTP requests outbound to a configurable list of LLM provider hosts (`api.anthropic.com`, `api.openai.com`, plus an env-var-configurable extension list). Tool calls, MCP, and other steps continue to execute live.

**Alternative considered:** cache all step outputs. Rejected — too broad, too fragile, and most non-LLM steps are cheap.

### 2. Where does the cache live? **Per-test, in `tests.cached_llm_calls` jsonb.**

Co-located with the assertion and the input fixture. The manifest endpoint serves all three together. Single source of truth for "what should this test do during replay."

**Alternative considered:** a separate `test_llm_fixtures` table. Rejected — premature normalization. The fixture is meaningless without the test, the manifest endpoint already serves the test, and a single jsonb column matches the existing `replay_input` pattern.

### 3. How do we intercept? **Mount a custom httpx transport.**

Both the Anthropic Python SDK and OpenAI Python SDK v1+ use httpx internally. Mounting a custom `httpx.HTTPTransport` (or the async equivalent) lets us intercept every outbound request without monkey-patching customer code, without requiring a `safeship.openai.wrap(client)` opt-in, and without depending on per-provider SDK internals that can break across versions.

Concretely: at test-runner startup we install a transport on the customer's clients. Two installation strategies, in order of preference:

1. **Install at process boot.** Patch `httpx.Client.__init__` (and async equivalents) to wrap the user-supplied transport with our recorder/replayer. Drawback: monkey-patches httpx; risk of surprising third-party libs that use httpx for non-LLM purposes. Mitigation: the recorder/replayer is a no-op for any host not on the LLM allowlist.
2. **Provide opt-in helpers.** Ship `safeship.install_llm_recording()` that the customer calls. Drawback: invasive, defeats the "no code change" principle. Use only as a fallback for users whose stack defeats the auto-install.

Recommend (1) with (2) as a documented escape hatch.

**Alternative considered:** require customers to wrap each LLM client with a SafeShip-provided wrapper (`safeship.anthropic.wrap(client)`). Rejected — too invasive, multiplies SDK surface, becomes a maintenance treadmill as new providers ship.

**Alternative considered:** use an off-the-shelf cassette library (`vcrpy`, `responses`). Rejected — those tools assume single-process pytest workflows and don't compose with SDKs that build their own httpx transport stack.

### 4. How do we identify "the same LLM call"? **Sequence + content fingerprint.**

The fundamental tension: the agent might call the LLM multiple times in a single run, with the same or similar prompts, and the response must be matched correctly even when the agent's NEW code rewords the system prompt slightly.

Recommended: cache key is the tuple `(call_index, sha256(canonicalized_request_body))`.

- **`call_index`** is the ordinal of the call within the trace (0, 1, 2, …). Forces deterministic ordering: the Nth LLM call in the new run gets the response that was the Nth LLM call in the original run, *if* the request bodies still match.
- **`sha256(canonicalized_request_body)`** is the safety check. Canonicalize by stripping non-deterministic noise (request IDs, timestamps in headers) and sorting JSON keys. If the hash matches, we trust the order; if it doesn't, we fall back per the configured replay mode.

This handles the realistic refactor cases:
- Same prompt, different code path → match on hash → replay.
- Reworded prompt, same call sequence → hash mismatch → fall back per mode.
- New LLM call inserted → call_index drift → hash mismatch on every subsequent call → fall back per mode.

**Alternative considered:** content-only matching (no `call_index`). Rejected — duplicate requests in the same run can't be disambiguated.

**Alternative considered:** call-graph fingerprinting (which step in the trace, what tool name). Rejected — couples replay to internal step structure that the customer's refactor will legitimately change.

### 5. What happens on cache miss? **Configurable, default `cached_or_live`.**

Three modes, customer-selectable per repo via `safeship.yaml`:

- **`cached_only`** — cache miss = test fails with an explicit "fixture mismatch" message. Strictest; surfaces drift early.
- **`cached_or_live`** *(default)* — cache miss = make the live call, warn in PR comment. Pragmatic; preserves test signal at small ongoing cost.
- **`live`** — cache is ignored entirely. v1 behavior, kept as escape hatch.

Default to `cached_or_live` because the realistic adoption path is "ship v2, customers get cheaper CI without changing anything, edge cases gracefully fall back to current behavior." `cached_only` is for customers who've actively decided their tests should be free or fail.

### 6. What about streaming responses? **Record the assembled response; replay non-streaming.**

LLM SDK streaming returns response chunks as they arrive. Faithful streaming replay would require recording the stream timeline and re-emitting it. That's out of scope for v2 — we record the final assembled response and replay it as a single non-streaming response. Customer code that *requires* streaming behavior to function correctly will need to be flagged in docs as "test mode behaves as non-streaming."

This matches how `vcrpy`-style recorders handle streaming and is acceptable for the regression-test use case (we care about the agent's decision based on the response, not on the chunk timing).

### 7. What about MCP tool calls? **Out of scope for v2 — MCP calls execute live.**

MCP calls are function-level, not HTTP-level (in the typical client). They continue to run live during replay. If the MCP tool itself is non-deterministic in a way that breaks regression tests, the same `SAFESHIP_RUN_MODE=test` env hint Phase 2 already ships lets the customer mock at the MCP layer.

This is honest about the scope: v2 cuts the *LLM* bill, which is the dominant cost. Tool execution cost is much smaller and handled separately.

### 8. Backwards compat for existing accepted tests? **Live-call fallback with no behavior change.**

Tests accepted before v2 don't have a `cached_llm_calls` value. Their replay continues to work exactly as it does today (live calls, real LLM bill). No migration script required, no test-rotting risk.

The customer surfaces this through the dashboard: a small badge on `/app/tests` saying "LLM calls cached" or "live (re-accept to enable caching)" lets the customer choose to re-accept against a more recent failing trace if they want the cache.

---

## The natural shape

```
RECORDING (production agent run)
┌──────────────────────────────────────────────────────────────────┐
│  customer code: agent("user message")                             │
│    └── safeship.wrap installs httpx transport interceptor         │
│         └── Anthropic SDK call → intercepted, recorded, passed    │
│              through to the real provider                         │
│    └── trace shipped with cached_llm_calls = [{idx, hash, body}] │
└──────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                    /v1/traces (extended)
                             │
                             ▼
                    runs / traces tables
                             │
                             ▼
                  user accepts suggestion
                             │
                             ▼
              tests.cached_llm_calls populated
                             │
                             ▼
                    /v1/tests/manifest

REPLAY (CI on a new PR)
┌──────────────────────────────────────────────────────────────────┐
│  safeship test                                                    │
│    └── fetches manifest with cached_llm_calls                     │
│    └── installs replayer transport                                │
│    └── invokes customer's agent with replay_input                 │
│         └── Anthropic SDK call → intercepted                      │
│              ├─ cache hit → return recorded response              │
│              └─ cache miss → fall back per replay_mode            │
│    └── evaluates YAML assertion against new trace                 │
│    └── exit 0/1                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Open risks and unknowns

| Risk | Estimate | Mitigation |
|---|---|---|
| **httpx monkey-patch surprises** — third-party libs that use httpx but aren't LLM clients could see unexpected interceptor behavior. | Medium. The interceptor is a no-op for any host not on the LLM allowlist, so the impact is bounded to a small allocation cost per request. | Allowlist of known LLM hosts; explicit "passthrough" path for everything else; debug logging when in test mode. Add an env var to disable auto-install for power users. |
| **Provider SDK changes its transport stack.** | Medium. Anthropic and OpenAI both currently use httpx, but that could change. | Pin support: docs explicitly say "tested with anthropic >= X.Y, openai >= X.Y." Detect transport mismatch at install time and emit a clear warning. |
| **Streaming-only customer code.** | Low. Most customers use the simple non-streaming path. | Document the limitation; provide a deterministic replay of the assembled response so the agent's decision logic still runs. |
| **Token counts diverge.** Replayed responses won't have correct billing-side token counts in the customer's real provider account (because no real call was made). | Low. The customer's regression test only cares about agent behavior, not provider billing. | Document that token counts are zero in test mode; `safeship.step()` records the cached response as-is. |
| **Cache size.** A failed trace with a 50-message conversation can be ~100KB of jsonb. Multiplied across thousands of accepted tests. | Low for v2 scale. | Cap `cached_llm_calls` size at 1MB per test in the ingest path; truncate with a warning if the trace exceeds. Re-evaluate at 100+ paying customers. |
| **Async / concurrent agent runs.** httpx transport interceptors must be thread-safe and async-safe. | Medium. | Use thread-local or contextvars for the per-run buffer. Existing SDK already uses daemon threads; this is the same concurrency model. |
| **First v2 customer's bug.** The first customer with cached replay will inevitably hit a case we didn't anticipate. | High but bounded. | Ship behind an env-var feature flag (`SAFESHIP_REPLAY_LLM_CACHE=true`) for the first two weeks; once stabilized, flip the default. Default-off → default-on transition is one commit. |

---

## Effort estimate

Honest assessment for a single-session, focused implementation pace (matching Phase 2's actual delivery):

| Component | Estimate | Notes |
|---|---|---|
| Schema migration + ingest extension | 0.5d | Additive jsonb column; cap-size enforcement; backwards-compat null handling. |
| `_llm_recorder.py` + httpx transport mount | 1d | Including allowlist, request canonicalization, hash computation, buffering. |
| `_llm_replayer.py` with three modes | 1d | Cache lookup, fallback logic, warning/error surfaces. |
| Recording side wired into `_wrap.py` | 0.5d | Install on `init()`; teardown on `flush()`. Tests for thread safety and async. |
| Replay side wired into `_testrunner.py` | 0.5d | Install before agent invocation; uninstall after. Per-test fixture loading. |
| Manifest endpoint + suggestion accept extension | 0.5d | Carry the new field through the existing pipeline. |
| `safeship.yaml` `replay_mode` field + CLI flag override | 0.25d | Config schema + validation. |
| Tests | 1d | Recorder/replayer unit tests, end-to-end test against a mocked LLM provider, regression tests for the existing test runner (zero behavior change for tests without cached calls). |
| Docs + dashboard badge | 0.5d | Explain cached vs live modes, the determinism caveats, how to re-accept old tests. |
| Live demo against a real customer-shaped agent | 0.5d | Anthropic SDK end-to-end, verifying free CI replay. |
| **Total** | **~6 days** | Single session would be tight; two split sessions is realistic. |

For comparison: Phase 2 estimated 14–18 days, delivered in ~6–8 hours. v2 is a smaller surface but harder design (Phase 2 was mostly "wire components together"; v2 has real architectural decisions in §1–§8 above). I'd budget closer to 2–3 sessions of focused work.

---

## What we explicitly defer past v2

- **Faithful streaming replay** (chunk-timed playback). v2 collapses to non-streaming.
- **MCP / tool-call caching.** v2 caches HTTP-level LLM calls only.
- **Cross-provider fixture portability.** A test recorded against Anthropic only replays against Anthropic.
- **TypeScript SDK support.** Python only for v2.
- **In-product re-record button.** v2 ships with the "re-accept to upgrade" path documented; a one-click re-record from `/app/tests` is a v3 nicety.
- **Cache invalidation on trace deletion.** Tests retain their cached fixture even if the original run is deleted (matches Phase 2's `replay_input` denormalization).

---

## Recommendation

Build v2 in two phases inside this plan:

**Phase 3a — Recording + storage (low risk, high learning).** Ship the recorder, the schema, the manifest extension, and the dashboard badge. Existing tests continue to use live replay. New tests carry the cache. We learn whether the canonicalization + hash-key approach actually matches in practice across realistic agent refactors before we wire up replay.

**Phase 3b — Replay + mode selection (after one week of recording data).** Once we can read real cached data off accepted tests and inspect the hashes, ship the replayer with `cached_or_live` default. Two-week feature-flag period (`SAFESHIP_REPLAY_LLM_CACHE`) before default-on.

If Phase 3a reveals that the cache-key strategy is wrong (too many false-miss matches even on identical refactors), we revise §4 before any customer is on Phase 3b. Splitting recording from replay is the cheapest way to find that out.

Both phases together close the LLM-cost gap that Phase 2 explicitly named. After that, all five "gaps" from the May 2026 competitive research are addressed in product or content.
