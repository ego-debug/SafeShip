# SafeLoop

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
- `/app/dashboard` and `/app/tests` — stub pages that link to the HTML prototypes until Stages 4 / 6 ship

**Reference**
- `public/designs/*.html` — original HTML prototypes for the six screens (served at `/designs/*.html`)
- `.claude/agents/` — `code-reviewer`, `design-checker`, `sdk-builder` subagents

## Stack

Next.js 14 (App Router) · TypeScript strict · Tailwind · Clerk · Supabase · Vercel.

## First-time setup

### 1. Install + env

```bash
npm install
cp .env.local.example .env.local
```

### 2. Supabase

1. Create a project at https://supabase.com (free tier is fine).
2. **Project Settings → API**: copy the **URL**, **anon public key**, and **service_role** key into `.env.local`.
3. **SQL Editor**: paste and run [`supabase/schema.sql`](./supabase/schema.sql). Idempotent — safe to re-run.

### 3. Clerk

1. Create an app at https://clerk.com → "Add application" → name it SafeLoop. Enable email + your preferred social providers.
2. **API Keys**: copy **publishable** and **secret** keys into `.env.local`.
3. **Webhooks → Add endpoint**:
   - URL: `https://YOUR-DOMAIN/api/webhooks/clerk` (use the Clerk "Sync host" tunnel for local development, or ngrok)
   - Subscribe to events: `user.created`, `user.deleted`
   - Copy the **signing secret** into `CLERK_WEBHOOK_SIGNING_SECRET` in `.env.local`

The webhook is the production path. For local development, signing up still works without the webhook configured — the onboarding page falls back to provisioning the project on first render.

### 4. Run it

```bash
npm run dev                    # http://localhost:3000 (or whatever port is free)
```

Open `http://localhost:<port>/` → click **Start free** → create an account → land on `/app/onboarding` with your real API key.

> If `3000` is busy, run `npm run dev -- -p 4321` (or any free port).

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo on https://vercel.com — Next.js is auto-detected.
3. Add all variables from `.env.local` in **Project Settings → Environment Variables**.
4. Update the Clerk webhook endpoint URL to `https://<your-vercel-domain>/api/webhooks/clerk`.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |

## What's next

Per the build stages in CLAUDE.md:

1. ✅ **Stage 1** — Landing + waitlist
2. ✅ **Stage 2** — Clerk auth + DB + Onboarding + API key generation
3. ⏳ **Stage 3** — Python SDK + trace ingestion API
4. ⏳ **Stage 4** — Dashboard + Trace Detail wired to real data
5. ⏳ **Stage 5** — Auto-suggest engine + Suggested Tests
6. ⏳ **Stage 6** — Tests List + GitHub Action that blocks PRs on score drop

Defer everything else (teams, Slack, custom dashboards, TS SDK) per CLAUDE.md.
