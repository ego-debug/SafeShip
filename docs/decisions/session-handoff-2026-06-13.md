# Session handoff: June 13, 2026

Read this first when resuming (e.g. on the laptop). Supersedes
`session-handoff-2026-06-12.md`. Everything described here is committed
and pushed to `main` at GitHub (`ego-debug/SafeShip`); HEAD is the
"Lockfile metadata" commit. Nothing is stranded locally except the
two intentional working-tree leftovers noted at the very bottom.

This doc is self-contained on purpose: the laptop's Claude session will
NOT have the desktop's `~/.claude` memory files, so every quirk you need
is written out below.

## What shipped this session (newest first)

All pushed to `main`:

1. **Lockfile metadata** — npm `peer:true` churn + TS SDK dev-dep lock.
2. **Landing page eval receipt** — a "96.7% on our offline eval set"
   badge in the suggest-loop section. Developers trust receipts.
3. **Owner dashboard revamp** — `/admin` is now a command center:
   MRR + hero stats, a 14-day traces-ingested chart (failures overlaid
   in red), a 14-day signups chart (users vs waitlist), the activation
   funnel with the worst drop-off auto-highlighted, a suggest-engine
   card (Claude calls today, accept rate), an integrations health panel
   (Supabase/Clerk/Anthropic/Stripe/Resend with live-vs-test notes), a
   cross-account activity feed, and richer user rows (last-active,
   colored subscription pills). Charts are server-rendered inline SVG,
   no client deps.
4. **Admin user management** — `/admin` lists every registered user with
   project/run counts and last-active; Delete cascades all their data
   (admin accounts are refused at the lib level); waitlist rows get a
   Remove button.
5. **Owner login + redirect fix** — standalone owner login at
   `/admin/login` (env credentials, independent of Clerk so it works
   even when app sign-in misbehaves); `/app/admin` now 307s to `/admin`
   before the Clerk gate so a signed-out owner isn't bounced to the
   customer sign-in form.
6. **Public `/demo` page** — no-signup tour of a real seeded project:
   week-at-a-glance chart, the refund-hallucination failure step by
   step, and the suggested test in plain English + YAML, with sign-up
   CTAs. Linked as "Live demo" in the nav. Point the summit QR code
   HERE, not the landing page.
7. **Activation funnel** in the admin snapshot (signed up → created
   project → sent trace → got suggestion → accepted test).
8. **Suggest-engine prompt fix** — pinned root-cause step, full-schema
   assertions, no hardcoded literals. Offline eval went 77.5% → **96.7%**.
   This is the core product quality bar; keep it ≥ 80%.
9. **E2E + seeding + verification scripts** (see below).
10. **AWS Summit runbook** at `docs/aws-summit-runbook.md` — demo
    script, hallway answers, owner checklist. Still current; read it.

## New scripts (all run with the react-server trick — see Quirks)

- `scripts/e2e-stranger.ts` — full data-plane journey against a running
  dev server: provision → ingest ok + failed trace via `/v1/traces` →
  live Claude suggestion → accept → tests table. `--cleanup` removes its
  rows. This is the "is the product functional" proof.
- `scripts/seed-demo.ts --email <you> [--reset]` (or `--user <clerkId>`)
  — seeds a believable demo week into a project.
- `scripts/verify-demo-data.ts --user <clerkId>` — checks the seeded
  account through the same loaders the screens use.
- `scripts/verify-admin.ts` / `scripts/verify-admin-delete.ts` — exercise
  the admin gate, snapshot, and user-delete cascade.

## Verification state (as of this session, against restored Supabase)

- Suggest-engine eval: **96.7%** (`npm run eval:suggest`, 12 cases live).
- E2E stranger test: all stages passed; rows cleaned up after.
- Demo data seeded into BOTH Clerk accounts; verify scripts pass 15/15.
- Admin dashboard: all 12 sections render with live data over HTTP.
- `tsc --noEmit` clean; TS SDK 14/14 vitest; Python SDK 75/75 (per prior).
- Webapp public routes 200, authed routes 307.

## Getting running on the laptop

```bash
git clone https://github.com/ego-debug/SafeShip   # or: git pull
cd SafeShip
npm install
# .env.local is NEVER committed. Copy the one being transferred from the
# desktop into the repo root. It must contain (names only here):
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL,
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY,
#   CLERK_WEBHOOK_SIGNING_SECRET, the four NEXT_PUBLIC_CLERK_*_URL vars,
#   ANTHROPIC_API_KEY,
#   ADMIN_USER_IDS, ADMIN_LOGIN_USER, ADMIN_LOGIN_PASS,
#   ADMIN_SESSION_SECRET, DEMO_PROJECT_ID
npm run dev          # http://localhost:3000
```

Owner login: visit `/admin/login`, use the ADMIN_LOGIN_USER /
ADMIN_LOGIN_PASS values from `.env.local`. Session lasts 7 days.

## Environment quirks (the laptop will not know these otherwise)

- **Supabase free tier auto-pauses on inactivity.** When paused, the
  project subdomain vanishes from DNS and the pooler says "tenant not
  found" — looks deleted but isn't. Fix: restore from the Supabase
  dashboard (~5 min). The marketing site stays up either way and hides
  the outage, so check the dashboard before trusting "prod looks fine."
  It paused once on June 13 and was restored. Plan around it for the
  summit (owner intends to manually keep it awake that day).
- **Two Clerk accounts share one database** for the owner's Gmail:
  `user_3DcKEL63yNo5gJps9iBDhMKeOhD` and
  `user_3De55FcZuSkNsEejCrLrmI7Tabb`. Each owns one project; the demo
  data was seeded into both. `DEMO_PROJECT_ID` points at the first
  account's project.
- **react-server script trick**: run app `lib/*` code outside Next with
  `NODE_OPTIONS=--conditions=react-server` (PowerShell:
  `$env:NODE_OPTIONS='--conditions=react-server'; npx tsx <script>`).
  Makes the `server-only` guard a no-op. All the scripts above need it.
- **Pushing to `main` may be classifier-gated** in some setups; commit
  locally and push when prompted. PowerShell mangles multi-line commit
  messages with embedded quotes — use a temp file + `git commit -F`, or
  repeated `-m` flags.
- **PowerShell 5.1 `Invoke-WebRequest` silently drops a `Cookie:` header**
  passed via `-Headers`, so cookie-auth requests look rejected. Use
  `curl.exe -b "name=value"` for cookie tests.
- **Browser automation was broken on the desktop** (preview renderer
  stuck at about:blank; Chrome-extension MCP failed tab-group creation).
  The laptop may differ — try it, but the fallback is the verify-*
  scripts that exercise screen loaders server-side.
- The Tests screen's `hasExecutionHistory` is a deliberate stub (false);
  the screen shows an honest "runner ships in a follow-up" banner. Don't
  "fix" it or seed `test_runs`.

## Owner-only actions still pending (priority order)

1. **Add the new env vars in Vercel** (Settings → Environment Variables),
   or `/admin` and `/demo` will be broken in prod even though code
   shipped: `ADMIN_USER_IDS`, `ADMIN_LOGIN_USER`, `ADMIN_LOGIN_PASS`,
   `ADMIN_SESSION_SECRET`, `DEMO_PROJECT_ID`, and confirm
   `ANTHROPIC_API_KEY` is present. Copy values from `.env.local`.
2. **PyPI publish** `sdks/python` and **npm publish** `sdks/typescript`
   (npm name was claimable as of June 10). The docs' "pip install
   safeship" is not real until this is done; don't demo the CI block
   live until the Python SDK is published.
3. **Rename "SafeLoop" → "SafeShip" in Clerk** (dashboard.clerk.com →
   app branding). The sign-in box still says SafeLoop; summit signups
   will see it.
4. **Stripe** still sandbox (MRR card shows $0 until live). Termly text
   still placeholder on /privacy and /terms. Google OAuth prod fix
   (Clerk custom client_id); email signup works.
5. Keep Supabase awake the morning of the summit (June 17).

## Suggested next moves

1. On the laptop: `npm install`, drop in `.env.local`, `npm run dev`,
   log into `/admin`, click through `/demo` and the four customer
   screens with fresh eyes — they've only been machine-verified.
2. Re-run `npm run eval:suggest` to reconfirm ≥ 80% on the new machine.
3. Knock out the Vercel env vars + SDK publishes (both block the live
   demo story).
4. Rehearse the 6-minute script in the runbook twice.

## Working-tree leftovers (intentional, NOT committed)

- `.claude/agents/{code-reviewer,design-checker,sdk-builder}.md` show as
  deleted. They were already deleted before the June 13 session began;
  intent unknown, so the deletion was not committed. To restore:
  `git checkout .claude/agents`. To accept the removal: commit it.
- `.claude/settings.local.json` is untracked local permission config;
  by convention it stays out of git.
