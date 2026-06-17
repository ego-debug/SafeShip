# Strategy handoff — AWS Summit day (2026-06-17)

Resume point for a fresh Claude Code session on another laptop. This is a
CONVERSATION + DECISION log, not a ticket list. Read it before acting. The
code is all on `main` at GitHub (`ego-debug/SafeShip`); pull and you're current.

---

## 0. One-line status

Product is built and works locally; production deploy is stalled (Vercel);
no code work is pending. We are mid–**strategy discussion** triggered by
competitors seen at the AWS Summit. Nothing was being built when this was
written. Next action is a DECISION, not a commit.

## 1. What's actually built and working (verified June 14–17)

- Trace SDK (Python + TypeScript): `init` → `wrap` → ships a trace per run;
  auto-captures Anthropic/OpenAI calls; never crashes the agent. Python
  75/75 tests, TS 14/14, both build clean. Neither published to PyPI/npm yet.
- Ingestion API `/v1/traces`, dashboard, trace detail, suggestions queue,
  tests list, billing (Stripe sandbox).
- Auto-suggest engine: takes a failed trace, Claude writes a regression
  test, one-tap accept, replays in CI (cassettes = $0 LLM cost). Offline
  eval **96.7%** (live, June 17 on this machine).
- `/demo` (public, no signup) and `/admin` (owner login) — added by the
  prior main-PC session. Both work locally with real seeded Supabase data.
- `npx next build` passes clean; both /admin and /demo compile.

## 2. Operational state (the gotchas)

- **Production safeship.dev is STALE.** /demo and /admin/login are 404 in
  prod. Root cause: Vercel auto-deploy from GitHub stopped firing — live
  site frozen on an old commit. The build itself is fixed (commit 50d9760
  scoped the app tsconfig so `next build` no longer fails on the SDK test
  files). To go live: in Vercel, reconnect the GitHub integration + add env
  vars (ADMIN_USER_IDS, ADMIN_LOGIN_USER, ADMIN_LOGIN_PASS,
  ADMIN_SESSION_SECRET, DEMO_PROJECT_ID, confirm ANTHROPIC_API_KEY), then
  redeploy `main`. Owner-only (needs Vercel login). Not required to demo —
  the demo runs on localhost.
- **Supabase sleeps when idle** — if /demo or /admin is blank, wake it from
  the Supabase dashboard.
- `.env.local` is present on the working machines and already contains a
  live Anthropic key + the admin creds. Never committed.
- See `SUMMIT-MORNING-2026-06-17.md` for the booth/run steps.

## 3. The summit trigger (why strategy is in question)

At the AWS Summit (June 17) Jovan saw two things that rattled the plan:

1. **LaunchDarkly AgentControl** (launched May 19, 2026) at their booth:
   guarded progressive rollouts for AI agents, regression monitoring,
   auto-pause/rollback without redeploy — basically SafeShip's core
   sentence, plus a full platform (runtime guardrails, LLM-judge
   benchmarking, trace observability, model routing). Sold the LaunchDarkly
   way: per-seat, enterprise, sales-led.
2. **The AWS keynote also name-dropped "release management"** for agents.

Both produced the same panic reflex: "match their feature list / go
general-purpose." Jovan wrote a full strategy brief (lives in his Google
Drive: `safeship-claude-code-handoff.md`, dated 2026-06-17) talking himself
out of that reflex. Summary of HIS decision below.

## 4. Jovan's decision (from his brief)

Stay in the lane the incumbents structurally can't serve: **one solo dev,
flat $29.99/mo, no seats, 10-minute self-serve setup.** Verified pricing:
LaunchDarkly Pro ~$10/seat/mo; AgentControl effectively lives in Enterprise
(median ~$72k/yr, $19.5k–$165k range, +$10–50k onboarding). There is no
flat, self-serve, single-dev door into their product and never will be —
that's SafeShip's wedge.

Two governing rules: **(1) same buyer, same job** — a feature is in scope
only if a solo dev shipping one agent would personally use it to avoid
shipping a bad version; **(2) flat price, no seats, ever.**

Proposed feature adds (deepen the "ship safely" workflow, don't broaden the
buyer), in his priority order:
- P0: harden the existing regression/eval gate.
- P1: kill switch + instant rollback (production, no redeploy).
- P1: prompt/model version history with diff + revert.
- P2: pre-deploy eval against the dev's test set (offline pass/fail).
- P2: basic production alerts (email/Slack/Discord threshold).
- P3 (stretch): simple % progressive rollout with auto-pause.

Explicit non-goals: general-purpose feature flagging, seats/teams/RBAC,
full observability suite, multi-framework config, edge propagation,
configurable LLM-judge frameworks.

## 5. Claude's assessment of that decision (the pushback worth keeping)

Top-level: the strategic instinct is RIGHT — you can't out-platform a
funded incumbent; differentiate on buyer + price model + simplicity. But
three honest cautions, unresolved, to pick up on resume:

1. **Positioning collision.** Everything built + the entire live site
   positions SafeShip as an EVAL/REGRESSION tool (vs Confident AI,
   Braintrust — the June 10 competitive read). The brief reframes it as
   DEPLOY-GATING (vs LaunchDarkly). Different categories, different
   competitors. They reconcile under one umbrella — *"the safe-ship
   workflow for a solo agent dev: catch it → turn it into a test → gate the
   deploy → kill/rollback if live,"* where auto-suggested tests are how the
   gate's test set gets built. But the headline must be chosen
   deliberately; the site currently tells the eval story. DECISION NEEDED.

2. **The kill switch is the biggest build, not the cheapest.** The brief
   calls it "lowest build cost." Reality: today's SDK is OBSERVE-ONLY
   (fire-and-forget tracing + CI replay). It does not sit in the customer's
   runtime path. A production "turn the agent off / revert without
   redeploy" makes SafeShip a RUNTIME CONTROL PLANE the agent checks before
   running — a new architectural surface, in tension with the
   "single lightweight hook" rule. Buildable, but it's the heaviest item.
   By contrast, **version history + revert is genuinely cheap** (sits on
   data already stored) — that's the P1 to build first.

3. **Demand > features (Jovan's own section 9).** The real risk isn't
   features, it's whether solo devs will pay $30/mo before buying a
   platform. AWS + LaunchDarkly both spotlighting this category VALIDATES
   the problem exists/grows — good news — but neither answers the
   solo-dev-will-pay question. After a competitor scare the reflex is to
   build; the higher-leverage move is the ~10 user conversations he flagged.
   Build P0/P1 to keep it real, but don't let building substitute for
   validation.

Minor: the brief's framing line names LaunchDarkly/AgentControl. Fine
internally; keep funded-competitor names OFF the public site (our standing
rule is category descriptors).

## 6. Claude's recommended sequence (if/when building resumes)

1. P0 — harden the existing gate (it's the headline; make it solid).
2. P1 — version history + diff + revert (cheap, buildable on current data,
   makes the gate trustworthy).
3. HOLD the kill switch until the runtime-architecture call is made
   deliberately (it's a control plane, not a hook).
4. Run the ~10 solo-agent-dev conversations in parallel — that decides more
   than any feature.

Work one item at a time, finish + verify, then stop and confirm before the
next (standing workflow rule).

## 7. Open decisions to resume on

- [ ] Headline category: eval tool vs deploy-gating vs the "safe-ship
      workflow" umbrella. (Drives all site copy.)
- [ ] Build the kill switch at all? If yes, accept the runtime control
      plane and design it. If no, lean on version-revert + CI gate.
- [ ] Get prod live (Vercel reconnect + env vars) — needed before any
      public launch or QR demo.
- [ ] Publish SDKs (PyPI + npm) — the docs' "pip install safeship" /
      "npm install safeship" aren't real until then.
- [ ] Validate demand (~10 conversations).

## 8. How to resume on the other laptop

```
git clone https://github.com/ego-debug/SafeShip   # or git pull
cd SafeShip && npm install
# copy .env.local over privately (NOT in git): Supabase, Clerk, Stripe,
# Anthropic, ADMIN_*, DEMO_PROJECT_ID
npm run dev    # localhost:3000  (/demo, /admin/login, /)
```
Then tell the fresh session: "read docs/decisions/STRATEGY-HANDOFF-2026-06-17-summit.md
and resume." Pick an open decision from section 7 to continue.
