# SafeLoop GitHub Action

Block deploys when your AI agent regresses. Calls SafeLoop's `/v1/runs/check`
endpoint and fails the workflow if the latest run is below the score threshold.

## Quick start

In the customer's repo, store the SafeLoop API key as a repository secret:

> Repo → **Settings → Secrets and variables → Actions → New repository secret**
> Name: `SAFELOOP_API_KEY`
> Value: `sk_live_…` (from SafeLoop → Setup)

Then add a step to any workflow you want to gate on regression score:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  pull_request:
  push:
    branches: [main]

jobs:
  safeloop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Block on agent regression
        uses: ego-debug/SafeLoop/.github/actions/safeloop@main
        with:
          api-key: ${{ secrets.SAFELOOP_API_KEY }}
          min-score: 80
```

If the latest run on the project scored ≥ 80, the step prints a notice and the
workflow continues. If it scored < 80, the step fails the check, which blocks
the PR from merging (assuming branch protection is configured).

## Inputs

| Input | Default | Description |
|---|---|---|
| `api-key` | **required** | Your `sk_live_*` key. Store as `SAFELOOP_API_KEY` secret. |
| `min-score` | `80` | Minimum regression score (0–100). Below this fails the check. |
| `trigger` | (any) | Only consider runs with this trigger: `deploy` / `production` / `scheduled` / `manual`. |
| `endpoint` | `https://safeloop.dev` | Override for self-host / staging environments. |
| `fail-on-no-runs` | `false` | If the project has zero runs, this controls whether the check fails (`true`) or soft-passes (`false`, default). Soft-pass so first-time PRs aren't blocked before any traces have been sent. |

## Outputs

| Output | Description |
|---|---|
| `passed` | `'true'` if the latest run met the threshold, otherwise `'false'`. |
| `score` | Score of the latest run (or empty if no runs). |
| `run-id` | ID of the run that was evaluated. |

## Typical pattern — only gate after the agent has actually run

A more thorough setup runs the agent against PR changes, posts traces to
SafeLoop, **then** checks the score:

```yaml
jobs:
  safeloop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install safeloop
      - name: Run the agent against PR scenarios
        env:
          SAFELOOP_API_KEY: ${{ secrets.SAFELOOP_API_KEY }}
        run: python scripts/run_agent_eval.py    # posts traces via the SDK
      - name: Block on regression
        uses: ego-debug/SafeLoop/.github/actions/safeloop@main
        with:
          api-key: ${{ secrets.SAFELOOP_API_KEY }}
          min-score: 80
          trigger: deploy
```

`scripts/run_agent_eval.py` calls `safeloop.init(...)`, wraps the agent, and
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
