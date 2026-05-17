# SafeShip

Reliability for AI agents. Drop in a 4-line SDK, get traces of every run, block deploys when the agent regresses.

See [`CLAUDE.md`](./CLAUDE.md) for the full product brief.

## What's in here right now

**Stage 1 — Landing + waitlist (done)**
- `/` marketing site with email capture → Supabase `waitlist` table

**Stage 2 — Auth + DB + Onboarding (done)**
- Clerk sign-in / sign-up at `/sign-in` and `/sign-up`
- Middleware gates `/app/*` behind authentication
- Supabase schema for users, projects (with API key), runs, traces, tests
- Clerk webhook (`/api/webhooks/clerk`) provisions a Supabase user + default project + API key on sign-up
- Fallback provisioning on first server render of `/app/onboarding` for local dev where the webhook isn't reachable
- `/app/onboarding` — real Next.js + Tailwind port of the prototype, shows the user's API key, lets them send a fake test trace to flip to the success state

**Stage 3 + 4 — Ingestion + Dashboard + Trace Detail (done)**
- `POST /v1/traces` — public ingestion endpoint, `Authorization: Bearer sk_live_*`
- Shared insertion logic in `lib/ingestion.ts` powers both the public endpoint and the in-app test-trace stub
- `sdks/python/` — installable `safeship` package: `safeship.init()` + `safeship.wrap()` ship traces from a daemon thread; reliability guarantees verified in pytest; CI matrix on Py 3.9 / 3.11 / 3.12
- `/app/dashboard` — regression chart, recent runs, recent failures, wired to real data
- `/app/runs/[runId]` — step-by-step timeline, failing step expanded by default, raw trace JSON sidebar

**Stage 5 — Auto-suggest engine + Suggestions queue (done)**
- `lib/suggest.ts` — Claude Sonnet 4.6 via `@anthropic-ai/sdk`, system prompt cached, tool-use schema validation
- `/app/suggestions` — Tinder-for-tests review queue with Y/N keyboard shortcuts, focus card with plain English + YAML, recently-accepted sidebar
- `POST /api/suggestions/generate` — scan recent failures, generate suggestions in bulk
- `POST /api/runs/[id]/suggest` — one-shot suggestion from a specific run (wired to "✓ Suggest a regression test" on Trace Detail)
- `POST /api/suggestions/[id]/accept|skip` — review queue actions; accept promotes to `tests` table
- Graceful degradation when `ANTHROPIC_API_KEY` isn't set — UI shows a friendly banner instead of crashing

**Stage 6 — Tests List + CI gating (done)**
- `/app/tests` — filter chips (All / Active / Muted), per-row kebab menu (Mute / Unmute / Delete), search, sidebar with health donut + coverage + suite info, plus Phase 2/3 badges per row: "CI ready" / "Re-accept to enable" / "LLM cached (N)" / origin-run deep-link
- `POST /api/tests/[id]/mute|unmute|delete` — wired to the kebab menu
- `GET /v1/runs/check` — public CI endpoint; returns 200 if the latest run scored ≥ `min_score`, 422 if it dropped below
- `.github/actions/safeship/` — composite GitHub Action with **two modes**:
  - `test` (default if `safeship.yaml` is present) — installs the SDK, fetches the test manifest, replays each accepted regression test against the customer's new code, posts a per-test PR comment
  - `score-gate` — legacy threshold check via `/v1/runs/check`

**Phase 2 — Test runner + replay (done)**
- `sdks/python/safeship/_assertions.py` — YAML DSL evaluator (simpleeval + ~40 LOC of pre-rewriting for `contains` / `matches` / dotted access)
- `sdks/python/safeship/_testrunner.py` — replays a customer's wrapped agent against the captured failing input, evaluates the YAML assertion
- `sdks/python/safeship/cli.py` — `safeship test` CLI entry point (reads `safeship.yaml`, fetches manifest, runs all tests, writes a results JSON for the Action)
- `tests.replay_input` jsonb + `tests.origin_run_id` columns — denormalize the failing input + link to the original run on suggestion accept
- `GET /v1/tests/manifest` — bearer-authed manifest endpoint serving accepted tests to CI

**Phase 3 — Auto-instrumentation + free CI replay (done)**
- `sdks/python/safeship/_instrument.py` + `_providers/{anthropic,openai}.py` — `safeship.init()` monkey-patches `httpx.Client.__init__` to install a wrapping transport. Outbound calls to `api.anthropic.com` and `api.openai.com` auto-record as steps (model, messages, response, tokens, duration) with **zero customer code change**. Opt-out via `SAFESHIP_AUTO_INSTRUMENT=false`.
- Recording side captures raw request/response bytes per run into `runs.cached_llm_calls`. On suggestion accept, the cache is copied onto `tests.cached_llm_calls`.
- Replay side: same transport short-circuits matching calls in CI by returning the cached response. Behind the `SAFESHIP_REPLAY_LLM_CACHE=true` feature flag for a two-week observation period. Three modes via `safeship.yaml` `replay_mode`: `cached_only`, `cached_or_live` (default), `live`. Match key is `(call_index, sha256(canonical_json_body))`.
- 9 pytest cases cover record→replay round-trip, all three modes, hash canonicalization, feature flag off, backwards compat.

**Failure alerts (done)**
- Email via Resend + Slack via incoming webhook, both throttled per project (10-min burst window, 10 alerts/day cap)
- `lib/alerts.ts` fires fire-and-forget from `lib/ingestion.ts` after any run with `status="fail"`
- Customer toggles email on/off + pastes a Slack webhook URL from `/app/onboarding`
- `notification_log` table is the throttling source of truth
- `/api/projects/[id]/alerts` PATCH endpoint with ownership check; Slack URLs must start with `https://hooks.slack.com/`

**Marketing pages (done)**
- `/` — landing with Hero (framework-agnostic + MCP), HowItWorks, Pricing comparison (category-based, no named competitors), Footer
- `/pricing` — standalone comparison page: effective monthly cost at 3 workload tiers across 4 pricing-model categories, plus methodology section
- `/migrate/helicone` — Helicone refugee landing page with side-by-side before/after code diff, 12-row comparison table, FAQ, trademark notice
- `/security` — architecture-honest sub-processors table, data-storage matrix, incident response policy (72h customer notification, public postmortem within 30d), honest compliance roadmap
- `/status` — real Supabase round-trip ping + Anthropic Statuspage reachability check + Vercel-cron-driven ingest latency p95 from a synthetic `/api/cron/ingest-ping` endpoint; "Run check now" button for on-demand validation
- `/docs` — full setup guide with sections for branch protection, free CI replay, framework compatibility (Anthropic / OpenAI / MCP / raw HTTP examples)

**UX polish (done)**
- Real-time dashboard: client island polls `/api/projects/[id]/recent` every 2s while tab is visible; new runs flash an accent fade-in animation
- Trace detail readability: token counts inline, provider badges, copy buttons per Input/Output block, expand-fully toggle for long content, copy-as-cURL for LLM steps
- Suggestion queue: 5-second buffered undo on every Y/N (toast with progress bar), Up-next preview (next 3 suggestions with severity), keyboard hint clarification
- Empty states: every signed-in screen has a designed empty state with explanation + CTA
- Failure-alert email body rendered as HTML with the SafeShip accent color

**Reference**
- `public/designs/*.html` — original HTML prototypes for the six screens (served at `/designs/*.html`)
- `.claude/agents/` — `code-reviewer`, `design-checker`, `sdk-builder` subagents
- `docs/decisions/` — phase 1 / phase 2 / phase 3 audit + completion docs, competitive research, reality audit
- `scripts/smoke-suggest.mjs` — standalone Node script that hits Claude with the production system prompt + a synthetic failing run; useful for validating engine quality without going through the UI

## Stack

Next.js 14 (App Router) · TypeScript strict · Tailwind · Clerk · Supabase · Stripe · Claude Sonnet 4.6 · Resend · Vercel.

## First-time setup

### 1. Install + env

```bash
npm install
cp .env.local.example .env.local
```

### 2. Supabase

1. Create a project at https://supabase.com (free tier is fine).
2. **Project Settings → API**: copy the **URL**, **publishable / anon** key, and **secret / service_role** key into `.env.local`.
3. **Project Settings → Database → Connection string (Session pooler)**: copy the IPv4 string into `SUPABASE_DB_URL` in `.env.local`, replacing `[YOUR-PASSWORD]` with your real DB password.
4. Apply the schema:
   ```bash
   npm run db:push
   ```
   Idempotent — safe to re-run after any change to `supabase/schema.sql`.

### 3. Clerk

1. Create an app at https://clerk.com → "Add application" → name it SafeShip. Enable email + your preferred social providers.
2. **API Keys**: copy **publishable** and **secret** keys into `.env.local`.
3. **(Optional, production-only) Webhooks → Add endpoint**:
   - URL: `https://YOUR-DOMAIN/api/webhooks/clerk`
   - Subscribe to events: `user.created`, `user.deleted`
   - Copy the **signing secret** into `CLERK_WEBHOOK_SIGNING_SECRET` in `.env.local`

For local development, signing up still works without the webhook configured — the onboarding page falls back to provisioning the project on first server render.

### 4. Anthropic (powers Stage 5 auto-suggest)

1. Create an account at https://console.anthropic.com and add a payment method.
2. **Settings → Limits**: set a monthly spend cap (e.g. $10) as a safety net.
3. **Settings → API Keys**: create a key, paste into `ANTHROPIC_API_KEY` in `.env.local`.

Without this, the app still runs — the Suggestions queue and "Suggest a regression test" button will show a friendly "engine not configured" banner.

**Per-project rate limits** protect the spend cap from abuse. Two independent sets — one on the Claude-touching endpoints (cost protection) and one on `/v1/traces` ingestion (DB protection):

| Endpoint group | Daily / project | Burst / project | Override env vars |
|---|---|---|---|
| Claude suggestion endpoints | 50 / 24h | 5 / 5min | `SAFESHIP_SUGGEST_DAILY_LIMIT`, `SAFESHIP_SUGGEST_BURST_LIMIT`, `SAFESHIP_SUGGEST_BURST_WINDOW_SECONDS` |
| `POST /v1/traces` ingestion | 50,000 / 24h | 200 / 60s | `SAFESHIP_TRACES_DAILY_LIMIT`, `SAFESHIP_TRACES_BURST_LIMIT`, `SAFESHIP_TRACES_BURST_WINDOW_SECONDS` |

At Sonnet 4.6 prices the Claude daily cap = ~$0.75/day worst case per customer. The traces cap allows ~200 traces/hour sustained (way more than any reasonable agent), but a leaked API key can't bloat the DB by millions of rows overnight. Both endpoint groups return `429 Too Many Requests` with a `Retry-After` header when either limit is hit; the UI surfaces a "try again in N min" message. See `.env.local.example` for the env-var override values.

### 5. Run it

```bash
npm run dev                    # http://localhost:3000 (or whatever port is free)
```

Open `http://localhost:<port>/` → click **Start free** → create an account → land on `/app/onboarding` with your real API key.

> If `3000` is busy, run `npm run dev -- -p 4321` (or any free port).

## CI / GitHub Action

The `safeship` composite action queries `/v1/runs/check` and fails the workflow if the latest run scored below a threshold. Drop it into any PR workflow:

```yaml
# .github/workflows/deploy.yml in the customer's repo
jobs:
  safeship:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ego-debug/SafeShip/.github/actions/safeship@main
        with:
          api-key: ${{ secrets.SAFESHIP_API_KEY }}
          min-score: 80
```

Full reference: [`./.github/actions/safeship/README.md`](./.github/actions/safeship/README.md).

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo on https://vercel.com — Next.js is auto-detected.
3. Add all variables from `.env.local` in **Project Settings → Environment Variables** (including `ANTHROPIC_API_KEY` and `SUPABASE_DB_URL`).
4. Update the Clerk webhook endpoint URL to `https://<your-vercel-domain>/api/webhooks/clerk`.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run db:push` | Apply `supabase/schema.sql` to the Postgres in `SUPABASE_DB_URL` (idempotent) |

## Build stages

Per the plan in CLAUDE.md:

1. ✅ **Stage 1** — Landing + waitlist
2. ✅ **Stage 2** — Clerk auth + DB + Onboarding + API key generation
3. ✅ **Stage 3** — Python SDK (`sdks/python/`) + `/v1/traces` ingestion
4. ✅ **Stage 4** — Dashboard + Trace Detail wired to real data
5. ✅ **Stage 5** — Auto-suggest engine + Suggested Tests review queue
6. ✅ **Stage 6** — Tests List + CI gating GitHub Action
7. ✅ **Phase 2** — Test runner + replay (YAML assertion DSL, manifest API, two-mode GitHub Action)
8. ✅ **Phase 3** — Auto-instrumentation of Anthropic/OpenAI + free CI replay (recorded LLM responses)
9. ✅ **Failure alerts** — email (Resend) + Slack incoming webhook, throttled
10. ✅ **Marketing pages** — `/pricing`, `/security`, `/status`, `/migrate/helicone`
11. ✅ **UX polish** — real-time dashboard, trace-detail readability, undo on suggestion accept/skip

Items still deferred per CLAUDE.md until 10 paying customers exist: TypeScript SDK, multi-seat teams, custom dashboards, BYOK fallback, in-product test executor, EU data residency.
