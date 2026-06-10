# safeship · Python SDK

[![CI](https://github.com/ego-debug/SafeShip/actions/workflows/sdk-python.yml/badge.svg)](https://github.com/ego-debug/SafeShip/actions/workflows/sdk-python.yml)
[![Python](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12%20%7C%203.13-blue)](https://github.com/ego-debug/SafeShip)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

> Every production failure becomes a regression test. The same bug never ships twice.

The Python SDK for [SafeShip](https://safeship.dev) — reliability for AI agents.
Drop in four lines, get a trace of every run, accept one-tap regression tests
when something breaks, and block PRs that would reintroduce a known failure.

```python
import safeship

safeship.init(api_key="sk_live_...")  # or set SAFESHIP_API_KEY
agent = safeship.wrap(my_agent)
```

That's it. Every call to `agent(...)` ships a trace to your SafeShip
dashboard.

## Install

PyPI publish lands shortly. Until then, install directly from GitHub:

```bash
pip install "git+https://github.com/ego-debug/SafeShip.git#subdirectory=sdks/python"
```

After PyPI:

```bash
pip install safeship
```

## What gets captured

### Automatically

When `safeship.init()` runs, the SDK installs an `httpx` transport
interceptor. Every call your agent makes to a supported LLM provider is
recorded as a step with model, request, response, tokens, and duration —
**no per-call instrumentation needed**.

Auto-instrumented providers:
- Anthropic (`api.anthropic.com`) — official `anthropic` Python SDK,
  custom `httpx`, anything that hits the same host.
- OpenAI (`api.openai.com`) — official `openai` SDK and equivalents.

Everything else (your database, internal tools, third-party APIs) passes
through untouched. The interceptor runs in your process, on your
infrastructure — your requests never go through SafeShip.

Opt out via `safeship.init(auto_instrument=False)` or the env var
`SAFESHIP_AUTO_INSTRUMENT=false`.

### Manually (for non-HTTP tools)

For tool calls that aren't HTTP requests to a known provider host —
function calling, MCP, in-process RPC — drop a `safeship.step(...)` call
right after the work happens so it surfaces on the trace timeline:

```python
def my_agent(message: str) -> str:
    intent = classify(message)
    safeship.step(tool_name="classify", kind="llm",
                  input=message, output=intent, duration_ms=140, status="ok")

    order = lookup_order(intent)
    safeship.step(tool_name="lookup_order", kind="tool",
                  input=intent, output=order, duration_ms=320, status="ok")

    return draft_reply(order)

agent = safeship.wrap(my_agent)
agent("where's my refund?")
```

If `my_agent` raises, the wrapper records the failure and re-raises —
your error handling stays in your hands.

## Async agents

`safeship.wrap` detects coroutine functions automatically; the wrapped
callable stays awaitable.

```python
import asyncio
import safeship

safeship.init(api_key="sk_live_...")

async def my_agent(prompt):
    ...

agent = safeship.wrap(my_agent)
asyncio.run(agent("hello"))
```

## CLI — replaying regression tests in CI

The SDK ships a `safeship` command that replays accepted regression tests
against your current code. Drop a `safeship.yaml` at your repo root:

```yaml
agent: src.my_agent:run
replay_mode: cached_or_live  # default. cached_only / live also supported.
```

Then run:

```bash
safeship test
```

The CLI fetches the latest accepted-tests manifest via
`SAFESHIP_API_KEY`, replays each one against your code, and exits non-zero
if any failed. Wire it into the GitHub Action in
[`.github/actions/safeship`](https://github.com/ego-debug/SafeShip/tree/main/.github/actions/safeship)
and red checks block the PR.

For a local-only run with a manifest file:

```bash
safeship test --manifest local-tests.json
```

A [runnable demo](../../examples/cassette-replay) lives in this repo —
no SafeShip account, no LLM key, no network.

## Free CI replay (cached LLM responses)

When SafeShip records a trace, it also captures the canonical request
bodies and responses of every LLM call as a **cassette**. In CI, those
cassettes replay verbatim — same auto-instrument transport, but instead
of hitting the provider, the matching cached response is returned.
Effect: regression tests in CI cost $0 in LLM bills.

Opt in with the env var:

```bash
SAFESHIP_REPLAY_LLM_CACHE=true safeship test
```

Replay modes via `safeship.yaml`:
- `cached_or_live` (default) — cache miss falls through to a live call.
- `cached_only` — strict; a cache miss is a hard failure. Use when you
  want CI to be guaranteed free even if it means refactor PRs need
  fresh re-accepts.
- `live` — ignore the cache entirely.

Match key is `sha256(canonical_json(request_body))`. Keys are sorted and
whitespace is stripped before hashing, so harmless serializer
differences don't break a hit. See
[examples/cassette-replay/README.md](../../examples/cassette-replay/README.md)
for a complete record-and-replay walkthrough.

## Reliability guarantees

Enforced by the SDK and verified by the test suite:

- **Never crashes your agent.** Every internal error is caught and
  dropped (set `debug=True` in `init` to log them).
- **Never blocks on the network.** Traces are queued and shipped from a
  daemon thread; the wrapped call returns the moment your agent returns.
- **Never makes extra LLM calls.** No retries or shadow prompts inside
  `wrap()` — your token spend is unchanged.
- **Survives transient ingest failures.** 5xx and 429 responses are
  retried with exponential backoff. Permanent 4xx errors are dropped.

## Configuration

| Param | Env var | Default | What |
|---|---|---|---|
| `api_key` | `SAFESHIP_API_KEY` | — | Project key, looks like `sk_live_*` |
| `endpoint` | `SAFESHIP_ENDPOINT` | `https://www.safeship.dev/v1/traces` | Ingest URL — override for self-host / local dev |
| `project_name` | — | — | Display label on the dashboard |
| `environment` | — | `prod` | `prod` / `staging` / `dev` |
| `timeout_seconds` | — | `10.0` | Per-delivery timeout (never blocks the agent) |
| `debug` | — | `False` | Log dropped traces to stderr |
| `enabled` | — | `True` | Set `False` in tests to disable shipping |
| `auto_instrument` | `SAFESHIP_AUTO_INSTRUMENT` | `True` | Auto-record LLM HTTP calls |

## Local development

```bash
git clone https://github.com/ego-debug/SafeShip
cd SafeShip/sdks/python
pip install -e ".[dev]"
pytest
ruff check safeship tests
```

Tests use `respx` to mock the HTTPX client — no real network. CI runs
against Python 3.9, 3.11, and 3.12 on every push.

Contributions welcome — see
[CONTRIBUTING.md](https://github.com/ego-debug/SafeShip/blob/main/CONTRIBUTING.md)
for the dev loop and style notes.

## Versioning

Pre-1.0: minor bumps for any breaking change. Post-1.0: standard semver.

## License

MIT — see [LICENSE](./LICENSE).
