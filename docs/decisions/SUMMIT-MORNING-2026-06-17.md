# SUMMIT MORNING — read this first (June 17, 2026)

Fresh Claude Code session: start here. This is the AWS Summit NYC demo day.
Everything is committed to `main` on GitHub. The laptop you're reading this
on has the full repo + a working `.env.local`.

## TL;DR — you can demo from this laptop on localhost. That already works.

Do NOT depend on production (safeship.dev) — see "Prod is stale" below.
The booth demo runs on `localhost:3000`. It was fully verified June 14.

## Get the demo up (run on this laptop)

```
cd <SafeShip folder>     # the repo root containing package.json
git pull                 # should be up to date already
npm install
npm run dev              # http://localhost:3000
```
Open these and confirm they render with data:
- http://localhost:3000/demo        → score chart + the refund-hallucination failure + suggested test (QR/booth story)
- http://localhost:3000/admin/login → log in with ADMIN_LOGIN_USER / ADMIN_LOGIN_PASS from .env.local
- http://localhost:3000/             → landing

## THE ONE THING THAT WILL BREAK IT: Supabase sleeps when idle

The demo reads from Supabase, which auto-pauses on inactivity. If `/demo`
loads blank or "unavailable", Supabase is paused. Fix: open the Supabase
dashboard and restore the project (~5 min), or just hit `/demo` and wait.
Do this FIRST thing in the morning and keep a tab open to keep it awake.

## Verified working as of June 14 (on this laptop)

- `npm run eval:suggest` → 96.7% (suggest engine, live Claude calls). PASS.
- Supabase live, Anthropic key live (came in via .env.local).
- `npx next build` → clean (exit 0); /admin and /demo compile.
- localhost /demo shows real seeded data (19 runs); /admin gates correctly.

## Prod is stale (safeship.dev) — OPTIONAL to fix, NOT needed to demo

safeship.dev/demo and /admin/login return 404 in prod. Root cause:
**Vercel auto-deploy from GitHub stopped firing** — the live site is frozen
on an old commit (857b197) from before the admin/demo work. The build
itself is fine now (the June 14 tsconfig fix, commit 50d9760, makes
`next build` pass; it had been failing on `Cannot find module 'vitest'`
because the root tsconfig type-checked the SDK test files).

To light up the QR/prod demo (only if there's calm time, e.g. on the train):
1. Vercel dashboard → project "safeloop" → Settings → Git: reconnect /
   reauthorize the GitHub `ego-debug/SafeShip` connection, Production
   Branch = `main`. (Lapsed GitHub auth is the likely cause.)
2. Trigger a deploy of the current `main` tip (50d9760). It will succeed now.
3. Settings → Environment Variables (Production), add from .env.local:
   ADMIN_USER_IDS, ADMIN_LOGIN_USER, ADMIN_LOGIN_PASS, ADMIN_SESSION_SECRET,
   DEMO_PROJECT_ID, and confirm ANTHROPIC_API_KEY. Without DEMO_PROJECT_ID,
   prod /demo deploys but renders empty.
4. Re-check: curl https://www.safeship.dev/demo  → expect 200 with data.

## Demo script + booth answers

Full 6-minute script and hallway Q&A: `docs/aws-summit-runbook.md`.
Point attendees / your screen at `/demo` first — it's the whole story in
one page (a real agent failed, SafeShip caught it, here's the test it wrote).

## Battery note

Laptop battery is weak — keep it plugged at the booth. If prepping on the
train, the localhost demo needs no internet EXCEPT Supabase + Anthropic
(both are cloud), so you need a connection for live data.
