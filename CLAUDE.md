# SafeLoop — Project Brief

This file is auto-loaded into every Claude Code session. Keep it short, accurate, and current.

## What we're building

SafeLoop is a reliability tool for solo developers shipping AI agents. It drops into the customer's code via a 4-line SDK, traces every agent run, auto-suggests regression tests from real production failures, and blocks deploys when behavior regresses.

**Tagline:** "Every production failure becomes a regression test. The same bug never ships twice."

## Customer

One specific persona:

- Solo developer or 1–2 person team
- Has shipped an AI agent (Claude Code, Cursor, Lovable, custom) in production
- Agent does a real job: support triage, content generation, sales outreach, scheduling
- Worried it will break in front of users
- Budget: $20–30/month (personal card, not enterprise procurement)
- Lives in VS Code, prefers dark mode, comfortable with terminals and JSON

**Not our customer:** enterprise ML teams (they buy Braintrust at $249/mo), pure hobbyists (free tier of Helicone is enough), LangChain power users only (we are framework-agnostic).

## Problem

AI agents fail unpredictably in production — hallucinated tool calls, confidently-wrong outputs, silent failures that burn tokens without producing results. Developers find out hours later from angry users.

Existing tools split in two:
- **Logging** (Helicone, Langfuse) — records what happened, doesn't prevent it
- **Evals** (Braintrust, LangSmith) — prevents failures but costs $40–250/mo, requires teams of 5+, and makes you write all tests by hand

SafeLoop is the eval tool, $29/month, where the tests build themselves.

## Wedge

The only product that:
1. Auto-suggests regression tests from real production traces — user thumbs-up to accept
2. $29/month flat, no seats, no usage tiers
3. 4-line SDK install, first trace in 5 minutes

## Pricing

- Free tier during MVP / waitlist
- **Pro: $29/month flat**, unlimited traces, unlimited projects, no seats
- 14-day free trial at launch, no credit card required

## Tech stack

- **Web app:** Next.js 14 (App Router), TypeScript strict, Tailwind CSS
- **Auth:** Clerk (preferred — fastest), fallback to Supabase Auth
- **Database:** Supabase (Postgres) — free tier covers MVP
- **API:** Next.js API routes; no separate backend service yet
- **Hosting:** Vercel
- **SDKs:** Python (PyPI) first, TypeScript (npm) second
- **Email:** Resend
- **Domain:** safeloop.dev

## Architecture

Three components:

1. **SDK** (Python + TypeScript). `pip install safeloop` → `safeloop.init(api_key=...)` → `safeloop.wrap(my_agent)`. Sends trace data to our API.
2. **Web app** (Next.js on Vercel). Marketing site + signed-in product.
3. **Trace ingestion + auto-suggest pipeline** (Next.js API routes + Claude calls). Receives traces, stores them, periodically generates regression test suggestions.

## The six screens (designs in `/designs/`)

1. **Landing** — hero + how it works + pricing + footer
2. **Onboarding** — 3-step stepper, code snippet, "send us a test trace" button, WAITING and SUCCESS states
3. **Dashboard** — regression score chart + recent runs + recent failures
4. **Trace Detail** — step timeline with expanded failing step, "What went wrong" callout, OUTPUT DIFF
5. **Suggested Tests** — Tinder-for-tests queue, plain English + YAML/Python/TS code, accept/skip buttons
6. **Tests List** — regression suite table with sparklines, coverage %, health donut

## Database schema (high level)

```sql
users           (id, email, created_at, subscription_status)
projects        (id, user_id, name, environment, api_key, created_at)
runs            (id, project_id, trigger, score, status, started_at, duration_ms, model)
traces          (id, run_id, step_index, tool_name, input, output, duration_ms, status)
suggested_tests (id, project_id, trace_id, name, plain_english, code_yaml, status, created_at)
tests           (id, project_id, name, plain_english, code_yaml, status, created_at)
test_runs       (id, test_id, run_id, passed, duration_ms, created_at)
```

## Build stages

**Stage 1 (now):** Landing page deployed to Vercel. Email capture → Supabase `waitlist` table.
**Stage 2:** Clerk auth + DB schema + Onboarding screen + API key generation.
**Stage 3:** Python SDK ships, sends traces to API. Backend ingests them.
**Stage 4:** Dashboard + Trace Detail screens, real data.
**Stage 5:** Auto-suggest engine + Suggested Tests screen. (Hardest. Plan one full week.)
**Stage 6:** Tests List + CI integration (GitHub Action blocking PRs on score drop).

## Do NOT build yet

- Team accounts, multi-seat
- Slack/Discord integrations (email alerts only at first)
- Custom dashboards, advanced filtering
- TypeScript SDK (Python first)
- White-label, on-prem, SSO
- Mobile apps
- Settings beyond billing + API keys

Defer aggressively until 10 paying customers exist.

## Conventions

- Next.js App Router only, no Pages Router
- Server Components by default; Client Components only when interactivity required
- Tailwind only — no separate CSS files
- Server actions for mutations; API routes for SDK ingestion only
- All env vars in `.env.local`, never committed
- TypeScript strict mode on
- Structured logging — no bare `console.log` in committed code
- Empty states are required for every screen with dynamic data

## Voice and tone

- Plain-spoken, confident, no hype
- Say "regression" not "model drift," "block your deploy" not "guard your agent"
- Avoid "AI/ML" — say "agent"
- Reference tone: Linear, Resend, Vercel

## Hard part

The auto-suggest engine (Stage 5). Take a production trace, ask Claude "what regression test would catch this if it happened again," produce a structured YAML test. Requires careful prompt engineering, an offline eval set to score suggestion quality, and a renderer that produces plain English + executable code side by side.

Plan an entire week on this. The product hinges on it.
