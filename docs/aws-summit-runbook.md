# AWS Summit NYC runbook (June 17, 2026)

Written June 12. Five days out. Read top to bottom; the items are ordered
by what kills the demo if it's not done.

## 0. THE BLOCKER: Supabase is unreachable (do this first, ~10 minutes)

The Supabase project this machine's `.env.local` points at
(`izfrclhedlcvdmiiflgb`) no longer resolves in DNS, and the connection
pooler says "tenant not found". That means the project is **paused or
deleted** — most likely paused by Supabase's free-tier inactivity policy.
Every signed-in screen, trace ingestion, and suggestion generation is dead
until this is fixed. Both fixes are owner-only:

1. Log into [supabase.com/dashboard](https://supabase.com/dashboard).
2. If the project shows as **paused**: click Restore. Takes a few minutes.
   Done — the existing `.env.local` keys keep working.
3. If the project ref in the dashboard is **different** from
   `izfrclhedlcvdmiiflgb`: this machine's `.env.local` is stale. Copy the
   current URL + anon key + service role key + DB URL from the dashboard
   into `.env.local` (or run `npx vercel login` then
   `npx vercel env pull .env.local` — the Vercel CLI token on this machine
   is expired, so login is required first).
4. If the project was **deleted**: create a new one, run
   `npm run db:push` to apply `supabase/schema.sql`, update `.env.local`
   AND the Vercel env, and redeploy.

Note: production (www.safeship.dev) renders its marketing pages from cache
either way, so the public site looking fine proves nothing. If the
project is paused, prod signups and ingestion are down too — check the
dashboard before assuming production is healthy.

Also: one probe attempt added `db-probe-2026-06-12@safeship.dev`-style
noise nowhere — the prod write probe was not sent. Nothing to clean up.

## 1. Verify the whole product (after the blocker, ~15 minutes)

Run these from the repo root, in order:

```powershell
# 1. Data plane end-to-end: provision -> ingest ok + failed trace ->
#    live Claude suggestion -> accept -> tests table. All real code paths.
$env:NODE_OPTIONS='--conditions=react-server'; npx tsx scripts/e2e-stranger.ts
# then remove its rows:
$env:NODE_OPTIONS='--conditions=react-server'; npx tsx scripts/e2e-stranger.ts --cleanup

# 2. Suggest-engine quality eval (12 cases, live Claude, ~$0.15):
npm run eval:suggest          # expect >= 80%; last run was 96.7%

# 3. Click test: sign up with a fresh email, walk onboarding, send the
#    test trace, see the SUCCESS state. (5 minutes, needs a human.)
```

## 2. Seed the demo account (~5 minutes)

Sign in to the app once with the account you'll demo from, then:

```powershell
$env:NODE_OPTIONS='--conditions=react-server'; npx tsx scripts/seed-demo.ts --email <your-signin-email>
```

This gives the dashboard a believable week: 28 runs, a score dip two days
ago, three production failures, five regression tests with sparkline
history, and one pending suggestion. Two failed runs are deliberately
left without suggestions so the "Generate suggestions" button does a live
Claude call on stage. Re-run with `--reset` to wipe and reseed.

## 3. The 6-minute demo script

The positioning line (say it early): **"SafeShip is the eval tool for
people who will never write an eval. Every production failure becomes a
regression test. The same bug never ships twice."**

1. **Dashboard** (30s). "This is my support-triage agent in production
   all week." Point at the score dip. "Tuesday it started lying to
   customers. Here's how I found out in minutes, not from angry users."
2. **Trace detail** (90s). Open the refund failure (most recent failed
   run). Walk the timeline: classify ok, lookup returns $24.99, reply
   says $249.00. "The agent invented a 10x refund. Classic hallucinated
   value. No exception, no stack trace — every traditional monitor calls
   this run a success."
3. **Suggested tests** (2m). Click Generate. Live Claude call produces a
   regression test from that exact trace: plain English on the left,
   runnable YAML on the right. "I didn't write this test. I just said
   yes." Hit Accept.
4. **Tests list** (60s). The new test is live alongside the others, with
   pass/fail history. "These all came from real failures. My eval suite
   writes itself from production."
5. **Close** (30s). "Four lines of SDK, $29.99 flat, and the deploy
   blocks if a regression comes back. The same bug never ships twice."

Wifi contingency: run `npm run dev` locally and demo against
localhost:3000 with the seeded data. If Claude is unreachable on stage,
there's already one pending suggestion seeded — narrate generation and
accept that one instead of clicking Generate.

## 4. Owner checklist, 5 days out (priority order)

| Day | Action | Why |
|-----|--------|-----|
| Today | Fix Supabase (section 0), run section 1 | Nothing works without it |
| Today | `git push origin main` (commit `bab5a86` is local-only) | Prompt fix that takes suggest quality 77.5% -> 96.7% must reach prod |
| Today | Confirm `ANTHROPIC_API_KEY` in Vercel env matches the working local key | Suggest engine in prod |
| +1 | PyPI publish `sdks/python`, npm publish `sdks/typescript` | "pip install safeship" in the demo must not 404; npm name was claimable as of June 10 — claim it before someone else does |
| +1 | End-to-end stranger test in PROD (fresh signup on safeship.dev) | The QR code on your badge leads here |
| +2 | Stripe live mode + real checkout once | Only if you want to say "you can buy it today" on stage; otherwise leave sandbox |
| +2 | Termly text on /privacy and /terms | Looks unfinished to anyone who scrolls the footer |
| +3 | Google OAuth prod fix (Clerk custom client_id) | Most summit signups will try Google first; email works as fallback |
| +4 | Dry-run the 6-minute script twice, once on hotspot | Rehearsal finds what this doc can't |

## 5. Honest answers for hallway questions

- "How is this different from Langfuse?" — Langfuse records what
  happened. SafeShip turns what happened into a test that blocks the
  deploy. Logging vs. prevention.
- "Braintrust does evals." — At $249/month for teams who write their own
  evals. SafeShip is $29.99 flat for the solo dev who never will.
- "Closest competitor?" — Confident AI claims failure-to-test at
  $19.99/user. They're framework-first and per-seat metered; we're
  framework-agnostic with no seats. The wedge is the suggestion queue:
  thumbs-up a test, done.
- "What models?" — The suggest engine runs on Claude Sonnet 4.6, scored
  96.7% on our offline eval set across hallucination, schema, silent-empty
  and tool-loop failures.
