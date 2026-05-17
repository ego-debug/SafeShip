# SafeShip GitHub Action

Block deploys when your AI agent regresses. Calls SafeShip's `/v1/runs/check`
endpoint and fails the workflow if the latest run is below the score threshold.

## Quick start

In the customer's repo, store the SafeShip API key as a repository secret:

> Repo → **Settings → Secrets and variables → Actions → New repository secret**
> Name: `SAFESHIP_API_KEY`
> Value: `sk_live_…` (from SafeShip → Setup)

Then add a step to any workflow you want to gate on regression score:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  pull_request:
  push:
    branches: [main]

jobs:
  safeship:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Block on agent regression
        uses: ego-debug/SafeShip/.github/actions/safeship@main
        with:
          api-key: ${{ secrets.SAFESHIP_API_KEY }}
          min-score: 80
```

If the latest run on the project scored ≥ 80, the step prints a notice and the
workflow continues. If it scored < 80, the step fails the check, which blocks
the PR from merging (assuming branch protection is configured).

## Inputs

| Input | Default | Description |
|---|---|---|
| `api-key` | **required** | Your `sk_live_*` key. Store as `SAFESHIP_API_KEY` secret. |
| `min-score` | `80` | Minimum regression score (0–100). Below this fails the check. |
| `trigger` | (any) | Only consider runs with this trigger: `deploy` / `production` / `scheduled` / `manual`. |
| `endpoint` | `https://safeship.dev` | Override for self-host / staging environments. |
| `fail-on-no-runs` | `false` | If the project has zero runs, this controls whether the check fails (`true`) or soft-passes (`false`, default). Soft-pass so first-time PRs aren't blocked before any traces have been sent. |

## Outputs

| Output | Description |
|---|---|
| `passed` | `'true'` if the latest run met the threshold, otherwise `'false'`. |
| `score` | Score of the latest run (or empty if no runs). |
| `run-id` | ID of the run that was evaluated. |

## Typical pattern — only gate after the agent has actually run

A more thorough setup runs the agent against PR changes, posts traces to
SafeShip, **then** checks the score:

```yaml
jobs:
  safeship:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install safeship
      - name: Run the agent against PR scenarios
        env:
          SAFESHIP_API_KEY: ${{ secrets.SAFESHIP_API_KEY }}
        run: python scripts/run_agent_eval.py    # posts traces via the SDK
      - name: Block on regression
        uses: ego-debug/SafeShip/.github/actions/safeship@main
        with:
          api-key: ${{ secrets.SAFESHIP_API_KEY }}
          min-score: 80
          trigger: deploy
```

`scripts/run_agent_eval.py` calls `safeship.init(...)`, wraps the agent, and
runs a fixed scenario suite (so the score is comparable across PRs). The check
step then verifies the resulting score before letting the PR merge.

## Behavior reference

| Latest run | HTTP | Action result |
|---|---|---|
| Score ≥ `min-score` | 200 | ✓ Passes |
| Score < `min-score` | 422 | ✗ Fails with `::error::` |
| No runs in project | 404 | Soft-pass (default) or fails if `fail-on-no-runs=true` |
| Bad / missing key | 401 | ✗ Fails with auth error |
| Anything else | 5xx / 000 | ✗ Fails |

## Make the red check actually block the merge

A failing SafeShip check on a PR is informational by default — GitHub
shows the red ✕ but the merge button still works. To actually block
merges, enable branch protection on your default branch and require the
SafeShip check.

Quickest path (classic branch protection rule):

1. **Repo Settings → Branches → Branch protection rules → Add rule**
2. Branch name pattern: `main` (or your default)
3. Tick **Require status checks to pass before merging**
4. Search for and add your SafeShip check (named after the job in your
   workflow — e.g. `regression`, not "SafeShip"). The check has to have
   run at least once before it shows in the dropdown.
5. Optional: tick **Require branches to be up to date before merging**
   so the check re-runs against the latest base.
6. **Create**.

For newer repos, GitHub **Rulesets** (Settings → Rules → Rulesets) are
the recommended replacement — same merge-blocking outcome, more
flexibility. Same idea: target the default branch, require status
checks, add the SafeShip job by name.

## PR comments (test mode)

When the action runs in test mode on a `pull_request` event, it posts a
single comment to the PR with a per-test results table. Subsequent runs on
the same PR update that comment in place (via a stable HTML marker) rather
than stacking. The PR check status itself is the gate — the comment is
inline explanation only.

The comment posts even when the SDK couldn't produce a results report
(missing API key, install failure, transient manifest fetch error). In
those cases the comment body explains the most likely cause so you don't
have to dig through workflow logs.

If posting fails (rate limit, missing `pull-requests: write` permission,
transient gh API blip), the step retries once after a 2-second wait, then
gives up silently — never failing the overall check. Add this to your
workflow `permissions` block to let the comment post:

```yaml
permissions:
  contents: read
  pull-requests: write
```
