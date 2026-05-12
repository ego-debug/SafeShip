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
- `/app/tests` — real port of the prototype: filter chips (All / Active / Muted), per-row kebab menu (Mute / Unmute / Delete), search, sidebar with health donut + coverage + suite info
- `POST /api/tests/[id]/mute|unmute|delete` — wired to the kebab menu
- `GET /v1/runs/check` — public CI endpoint; returns 200 if the latest run scored ≥ `min_score`, 422 if it dropped below. See [the action README](./.github/actions/safeship/README.md) for usage.
- `.github/actions/safeship/` — composite GitHub Action customers add to their PR workflow to block deploys on regression

**Reference**
- `public/designs/*.html` — original HTML prototypes for the six screens (served at `/designs/*.html`)
- `.claude/agents/` — `code-reviewer`, `design-checker`, `sdk-builder` subagents

## Stack

Next.js 14 (App Router) · TypeScript strict · Tailwind · Clerk · Supabase · Claude Sonnet 4.6 · Vercel.

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

Defer everything else (teams, Slack, custom dashboards, TS SDK, in-app test executor, per-project rate limits, BYOK fallback) until 10 paying customers exist, per CLAUDE.md.
