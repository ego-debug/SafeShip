# Session handoff: June 12, 2026

Read this first when resuming on a new machine or new Claude session.
Supersedes `session-handoff-2026-06-05.md`. Everything below is on
`main` at GitHub (`ego-debug/SafeShip`); nothing is stranded locally.

## Where things stand

All 7 phases of the June 5 strategic brief are shipped, plus a large
follow-on hardening pass. In rough order:

1. **Phases 1-7 complete** (positioning copy, privacy/terms scaffolds,
   cassette verification, suggestion-queue surfaces, suggest-engine
   eval set, per-tool quickstarts, OSS hygiene + `examples/cassette-replay`).
2. **Full-app audit pass**: stale-closure bug in dashboard polling,
   atomic claim on suggestion accept/skip (no duplicate tests from
   double-clicks), Slack webhook timeout, billing error humanization,
   dashboard query parallelization, dead-UI removal (Coverage column,
   disabled trace-detail button).
3. **Copy pass**: every em dash removed site-wide (verified at the
   rendered-HTML level), AI-tell phrasing scrubbed, suggest-engine
   prompt updated so generated suggestions stay dash-free.
4. **Design pass** (research-backed): glow-dot decorations removed,
   CTA neon shadows flattened, hero badge removed, background grid is
   now a top-of-page treatment instead of fixed wallpaper, comparison
   rows reframed (free option priced in evenings, per-seat floor $20).
5. **Churn-trap fixes**: onboarding no longer tells users to
   `pip install safeship` (not on PyPI yet); fake TS/node snippets
   replaced with a working curl tab; n8n quickstart payload fixed
   (run metadata must nest under `run:` or failures record as "ok");
   apex-domain ingest URLs switched to `www` everywhere.
6. **TypeScript SDK shipped** (`sdks/typescript`): init/wrap/step,
   fetch-interceptor auto-capture of Anthropic/OpenAI, AsyncLocalStorage
   run isolation, flush() for serverless, 14 vitest cases + live
   integration script. Zero runtime deps, Node 18+.
7. **Both SDK delivery timeouts bumped 2s -> 10s** after measuring a
   7.2s cold Supabase key lookup (traces were being silently dropped).
8. **Competitive refresh (June 10)**: wedge narrowed but alive.
   Closest threat: Confident AI ($19.99/user, claims failure->test,
   but framework-first per-seat metered). n8n shipped native evals.
   Promptfoo/OpenAI pivoted to security. Position = "the eval tool
   for people who will never write an eval", NOT price.

## Verification state

- Python SDK: 75/75 pytest, ruff clean, CI green (3.9/3.11/3.12)
- TypeScript SDK: 14/14 vitest, tsc clean, builds ESM+CJS+dts,
  integration script passes against a live dev server
- Webapp: tsc clean, all 14 public routes 200, authed routes 307,
  suggest-engine eval dry-run 100% (12 cases)
- Vercel deploys from main automatically

## Blockers / owner actions (only Jovan can do these)

1. **ANTHROPIC_API_KEY is dead** (401). Highest priority: blocks the
   suggest engine (the core product), the live eval baseline
   (`npm run eval:suggest`), and any demo. Generate at
   console.anthropic.com, put in `.env.local` + Vercel env.
2. **PyPI publish** of `sdks/python` (name "safeship" confirmed free).
3. **npm publish** of `sdks/typescript` (name "safeship" had a v0.0.0
   published+unpublished 2026-05-21; currently claimable; if that
   wasn't you, claim soon).
4. **Stripe still in sandbox** (deliberately deferred).
5. **Termly text** still placeholder on /privacy and /terms.
6. **Google OAuth prod fix** (Clerk custom client_id); email signup works.
7. `SAFESHIP_REPLAY_LLM_CACHE` default flip decision after observation.

## How to run on a fresh machine

```bash
git clone https://github.com/ego-debug/SafeShip && cd SafeShip
npm install
# copy .env.local from the old machine (NEVER committed) - Supabase,
# Clerk, Stripe, Anthropic keys live there
npm run dev
# SDKs:
cd sdks/python    && pip install -e ".[dev]" && pytest
cd sdks/typescript && npm install && npm test && npm run build
```

Note: on the old machine the repo lived inside OneDrive, which breaks
`next build` locally (ENOENT on .next/cache). On a non-OneDrive path
local prod builds should work normally.

## Suggested next moves (in priority order)

1. Fix Anthropic key -> run `npm run eval:suggest` -> iterate prompt to
   >=80% if needed. This proves the product.
2. End-to-end stranger test: fresh email signup -> onboarding -> test
   trace -> suggest -> accept -> /app/tests.
3. Publish both SDKs (closes the last "publish pending" notes in docs).
4. Real dashboard screenshot/demo clip for the landing page.
5. Stripe live + Termly + OAuth, then distribution (launch post etc.).
