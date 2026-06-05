# SafeShip — Session Handoff (2026-06-05)

> **Hi, fresh Claude session.** Read this file first. The previous session ran out
> of context. Everything you need to resume is in here — code state, deploy state,
> the strategic brief we're executing against, where we are in its 7 phases, what's
> done, what's next, and the gotchas to know.

---

## READ THIS FIRST — how to operate

We are executing the **June 5, 2026 build brief** at
`G:\My Drive\Jovan HQ\safeship\safeship-build-brief-for-claude-code.md`.

**Hard rule from the brief:** work **one phase at a time**, in order. For each phase:
1. Do only that phase's work; do not touch later phases.
2. When the phase's "Done when" criteria are met, verify them (run it, test it, show the result).
3. **STOP. Report what you did, show the verification, and ask: "Approve Phase N? Should I start Phase N+1?"**
4. Do not start the next phase until Jovan replies with explicit approval.

Inside a phase, you may batch sub-tasks but stop between batches too if useful.

**The new positioning** (memorize this; all copy should land it):
> "Reliability for the AI agent you built with AI. It writes the regression test
> for you, you approve it in one tap, and it blocks the bad deploy in your CI.
> $29.99 flat, no seats."

The buyer is solo devs whose agent was built with **Cursor / Lovable / Claude Code / n8n / raw OpenAI/Anthropic SDK**. Stay narrow — do NOT widen back to "any solo dev with any agent."

---

## CODE STATE — branch + commits

**Branch:** `claude/unruffled-northcutt-e17e81` (NOT main yet)
**Worktree path:** `C:\Users\toxic\OneDrive\Desktop\SafeLoop\.claude\worktrees\unruffled-northcutt-e17e81`
**Main repo path:** `C:\Users\toxic\OneDrive\Desktop\SafeLoop` (older code; don't edit here)

**Commits on the branch (oldest → newest):**
- `27bfaf5` Wedge sprint (May 16 morning) — Phase 3 cassette infrastructure, marketing pages, alerts, auto-instrumentation
- `31f7c5e` Phase A finish + Phase B UX polish (May 16 evening) — PR-comment fix, /app/tests Phase 2/3 badges, real-time dashboard, Cmd-K palette, ErrorBanner, trace-detail polish, suggestion-queue undo
- `873bff3` A11y sweep (May 17) — focus rings, disclosure semantics, Cmd-K focus trap
- **Uncommitted on disk right now** (work from this session, June 5):
  - Phase 1 copy pivot: `components/Hero.tsx`, `components/HowItWorks.tsx`, `components/Pricing.tsx`, `app/pricing/page.tsx`
  - Phase 2 scaffolds: `app/privacy/page.tsx`, `app/terms/page.tsx`, `components/Footer.tsx`
  - Phase 3 verification artifacts: `scripts/cassette-demo/{demo_agent.py,safeship.yaml,build_manifest.py,manifest.json}`
  - Phase 4 Batch 1: `components/suggestions/SuggestionsView.tsx` (FocusCard side-by-side restructure)

**First thing to do in your new session:** `git status --short` to confirm. If uncommitted changes look right, commit them with a single message covering Phases 1–4 Batch 1, then push.

Suggested commit message:
```
Phases 1-4: buyer-led copy pivot, Privacy/Terms scaffolds, cassette demo, side-by-side FocusCard

Phase 1 — positioning copy pivot (no backend)
- Hero re-leads on the buyer ("Your agent shouldn't fail in front of users")
  naming Cursor/Lovable/Claude Code/n8n explicitly. Subhead reframes around
  the three unmatched-together legs (managed, one-tap, $29.99 flat).
- HowItWorks step 02/03 use the buyer's actual pain language (silent
  failures, hallucinated tool calls, wrong API hits).
- Pricing.tsx comparison restructured from 4 vague rows into 3 poles:
  enterprise seat platforms / free OSS CLIs / SafeShip managed-middle.
- /pricing page gets a "managed-middle pricing" framing paragraph.

Phase 2 — pre-revenue must-dos (code-side only)
- New /privacy and /terms pages with plain-English summary tables +
  clearly-marked Termly placeholder sections.
- Footer privacy/terms links wired to the real routes (previously #).
- Stripe live-mode flip deferred per user; on launch-checklist.

Phase 3 — recorded LLM cassettes verified end-to-end
- scripts/cassette-demo/ with demo_agent.py + safeship.yaml + auto-built
  manifest.json (build_manifest.py computes correct canonical hash + writes
  UTF-8 no-BOM directly to avoid PowerShell BOM corruption).
- Three-run proof: cassette ON + no Anthropic key passes twice identically;
  cassette OFF (--replay-mode live) fails because the live call leaks
  through. Demonstrates Phase 3 "Done when" criteria.

Phase 4 Batch 1 — FocusCard side-by-side
- Suggestion card body restructured grid-cols-[1fr_1.2fr] on md+: left
  shows "What this test enforces" + plain-English callout, right shows
  "The test SafeShip will add to your suite" + YAML. Headers above each
  side make the screen self-explanatory for first-time visitors.
- Severity rendered as a color-coded chip (red/amber/grey) instead of
  plain text — screenshot-quality for marketing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## DEPLOY STATE — NOT YET LIVE

safeship.dev currently serves commit `81b3c8e` (pre-Phase-2 completion from days ago). **None of the 4 commits above are on `main`.** To deploy:
- Option A: open PR via https://github.com/ego-debug/SafeShip/pull/new/claude/unruffled-northcutt-e17e81 → merge → Vercel auto-deploys
- Option B: `git checkout main && git pull && git merge claude/unruffled-northcutt-e17e81 && git push origin main`

Jovan has been holding off on the merge until launch checklist is closer.

---

## THIRD-PARTY SERVICES

- **Resend** — domain `safeship.dev` ✓ verified June 5. DKIM + SPF (MX + TXT) all green.
- **Vercel env vars set in Production:**
  - `RESEND_API_KEY` ✓ (new account, separate from Jovan's other Resend)
  - `ANTHROPIC_API_KEY` ✓ (new key; old key NOT yet revoked at Anthropic — reminder pending)
- **Vercel env vars still needed:**
  - `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` — **live mode** values. Currently still test mode (`sk_test_...`). Per Jovan: "remind me at the end to change."
  - `CRON_SECRET` — needed for `/api/cron/ingest-ping` to actually fire in prod
  - `SAFESHIP_REPLAY_LLM_CACHE=true` — flips Phase 3 cassettes on (currently off — opt-in for two-week observation window)
  - Optionally `SAFESHIP_SUGGEST_MODEL=claude-opus-4-7` — to use Opus for engine quality testing (~$0.05/call vs Sonnet ~$0.01)

---

## WHERE WE ARE IN THE 7-PHASE BRIEF

| Phase | Status | Notes |
|---|---|---|
| **1. Positioning copy pivot** | ✅ DONE (this session) | Hero, HowItWorks, Pricing.tsx, /pricing page all reflect new positioning. Approved by Jovan. |
| **2. Pre-revenue must-dos** | 🟡 PARTIALLY DONE | a) PR comment fix ✅ (prior). b) /app/tests deep-link ✅ (prior). c) **Stripe live mode flip ❌ deferred per Jovan.** d) Privacy + Terms scaffolds ✅ (this session, Termly text still pending). Approved by Jovan. |
| **3. Recorded LLM cassettes** | ✅ DONE + VERIFIED | Built earlier (commit 27bfaf5), verified end-to-end in scripts/cassette-demo/ this session. Approved by Jovan. |
| **4. One-tap review queue as hero** | 🟡 IN PROGRESS — Batch 1 done this session | Batch 1 (FocusCard side-by-side) ✅. **Batch 2 (onboarding surface) + Batch 3 (marketing surface) pending.** |
| **5. Tune suggest engine + offline eval set** | ❌ NOT STARTED | Brief lists 4 target failure types: hallucination-by-omission, wrong/hallucinated tool calls, broken integrations, output-shape drift. System prompt in lib/suggest.ts covers some but not all. Needs offline eval set + measured accept-rate. |
| **6. Quickstarts for Cursor/Lovable/Claude Code/n8n** | ❌ NOT STARTED | docs/page.tsx has generic Anthropic/OpenAI/MCP examples; nothing buyer-specific. |
| **7. OSS SDK + demo asset** | ❌ NOT STARTED | SDK lives in sdks/python/ monorepo; not a standalone public repo. safeship-demo repo exists, not linked from site. |

---

## NEXT IMMEDIATE ACTION (when Jovan says go in the new session)

**Phase 4 Batch 2: onboarding surface.** Concretely:

> After "Send us a test trace" → success state on `/app/onboarding`, explicitly
> point the user at the suggestions queue with a preview or CTA card so the
> failure → suggestion → accept flow is one click away. The brief's "Done when"
> for Phase 4: "a brand-new user can go failure → suggested test → approved test
> in under a minute without docs."

Files to touch (probably only one):
- `app/app/onboarding/OnboardingView.tsx` — when `status === "success"`, add a new prominent CTA section: "Your first suggestion is being generated — review it →" linking to `/app/suggestions`. Could include a small preview/screenshot of what the queue looks like.

After Batch 2: **STOP, ask for approval, then Batch 3 (marketing site preview).**

---

## KNOWN GOTCHAS — read these before you touch anything

### 1. Editable SDK install points to the main repo, not the worktree
`pip show safeship` reveals the editable install at `C:\Users\toxic\OneDrive\Desktop\SafeLoop\sdks\python` (the main repo). That repo is PRE-Phase-3 — no `_instrument.py`. So running `safeship.cli` from a fresh shell imports the wrong SDK.

**Workaround for any CLI demo:** set `PYTHONPATH` to the worktree's SDK before invoking:
```powershell
$env:PYTHONPATH = "C:\Users\toxic\OneDrive\Desktop\SafeLoop\.claude\worktrees\unruffled-northcutt-e17e81\sdks\python"
```

**Permanent fix:** merge the branch to main → existing editable install picks up Phase 3+. **Until merge, anyone running scripts/cassette-demo/ needs the PYTHONPATH override.**

### 2. Next.js `.env.local` doesn't load some keys
Locally, `@next/env` loads Clerk + Supabase keys but skips `ANTHROPIC_API_KEY` / `RESEND_API_KEY` / `STRIPE_*`. Some parser quirk around line 27-29 in the file (SUPABASE_DB_URL or surrounding blank lines). Production (Vercel env vars) is unaffected. Don't waste time debugging — work around with PowerShell `$env:KEY = "..."` for local testing.

### 3. OneDrive corrupts `.next/cache`
Every few iterations the dev server returns 500 with "Could not find module ... in the React Client Manifest." Always-fix: `rm -rf .next && npm run dev`. Permanent fix would be moving the repo out of OneDrive or setting `distDir` outside the sync root — not done yet.

### 4. PowerShell `Out-File -Encoding utf8` adds a BOM
The CLI's manifest loader (`load_manifest_from_file`) uses strict `utf-8` (BOM-intolerant). Any time you generate JSON/YAML via PowerShell redirection, you'll get a BOM that breaks the loader. Workaround: have the Python script write the file directly with `open(..., "w", encoding="utf-8")`.

### 5. Git Bash on Windows mangles `curl -w '%{http_code}\n'`
The `%{...}` syntax gets escaped weirdly by Git Bash. Use `curl -sS -I "URL" | head -1` instead.

### 6. Dev server keeps dying
Jovan stepped away multiple times today and the dev server died. To restart: `npm run dev` in the worktree dir. Port is usually 3000 but auto-bumps if busy (today it's been 3000, 3002, 3003, 3004, 3005).

---

## LAUNCH CHECKLIST (still required before active marketing push)

After all 7 phases finish, Jovan wants to re-evaluate everything. But the launch-readiness blockers are:

1. ❌ **Merge worktree branch → main** → Vercel auto-deploys
2. ❌ **Stripe live mode** — flip in Stripe dashboard, set live keys in Vercel
3. ❌ **Termly Privacy + Terms** — generate text at termly.io, paste into the placeholder sections of `app/privacy/page.tsx` + `app/terms/page.tsx`
4. ❌ **Smoke-test prod end-to-end** — sign up, paste card, send test trace, confirm dashboard updates
5. ❌ **Validate Stage 5 quality on prod** — real failing trace → accept a suggestion → see if YAML is good
6. ❌ **Fix Google OAuth on prod Clerk** per `~/.claude/projects/.../memory/google_oauth_pending_fix.md` (~15 min)
7. ❌ **Open one PR on `ego-debug/safeship-demo`** to verify the PR-comment fix works on a freshly-opened PR
8. ❌ **Revoke old Anthropic key** at console.anthropic.com (rotation is incomplete without it)
9. ❌ **Decide on `SAFESHIP_REPLAY_LLM_CACHE`** — leave off (Phase 2 behavior, customers pay LLM cost) OR flip on (the wedge — "free CI replay")

Jovan has explicitly said: "for now i will leave on stripe sandbox remind me at the end to change." So at end of Phase 7, remind them about item #2.

---

## STRATEGIC CONTEXT — why this brief, what the wedge is

The original "only one who turns failures into tests" wedge is gone as of June 2026:
- Braintrust now does one-click trace-to-test (team-priced)
- EvalView (free OSS) does the full loop INCLUDING cassettes
- Promptfoo is now **OpenAI-owned** and free for CI gating

The new defensible slot is **packaging**: managed-middle (vs. self-host OSS) + one-tap UX (vs. CLI/PR workflow) + flat $29.99 (vs. per-seat/per-trace) for a **narrow buyer** (solo devs whose agent was built with AI tools — Cursor / Lovable / Claude Code / n8n).

This is why Phase 1's positioning rewrite re-leads on the buyer, not the mechanism. The hero says "Your agent shouldn't fail in front of users" not "the same bug never ships twice" — because the wedge isn't the bug-never-ships claim, it's the managed-one-tap-flat packaging for the narrow buyer.

---

## MEMORY FILES TO READ (if needed)

`~/.claude/projects/C--Users-toxic-OneDrive-Desktop-SafeLoop/memory/`:
- `june_5_strategic_brief.md` — fuller version of the strategy + competitive context
- `pending_circle_back_may16.md` — what was outstanding before this June 5 session
- `one_at_a_time_workflow.md` — Jovan's preference for the per-phase stop-and-wait rule (matches the brief's hard rule)
- `competitor_naming_caution.md` — don't name actively-funded competitors in marketing copy
- `onedrive_breaks_next_cache.md` — the gotcha above
- `nextjs_layout_gating_pitfall.md` — auth gating per-page, not in shared layout
- `google_oauth_pending_fix.md` — what to fix when Google sign-in breaks
- `stage5_pending_test.md` — what Stage 5 validation looks like (mostly superseded)

---

## TL;DR for the new session's first message

When Jovan starts the new chat, here's the ideal opening:

> "I'm picking up SafeShip work. Read
> `docs/decisions/session-handoff-2026-06-05.md` first. Then commit the
> uncommitted June 5 work as one commit per the suggested message in that
> doc, push it, and report what's ready. Then ask before starting Phase 4
> Batch 2."

If Jovan just says "go" without the above, default to:
1. Read this handoff doc fully
2. `git status` to confirm uncommitted Phase 1–4 Batch 1 work is on disk
3. Commit + push (single commit per the suggested message above)
4. STOP, report, ask if Batch 2 (onboarding surface) should start
