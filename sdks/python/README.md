# safeloop · Python SDK

> Catch your AI agent failing before your users do.

```bash
pip install safeloop
```

```python
import safeloop

safeloop.init(api_key="sk_live_...")  # or set SAFELOOP_API_KEY
agent = safeloop.wrap(my_agent)
```

That's it. Every call to `agent(...)` ships a trace to your SafeLoop dashboard.

## What gets captured

By default, each call to a wrapped agent produces one **run** containing one synthetic step (the agent itself). To get a step-by-step trace, drop `safeloop.step(...)` calls inside your agent:

```python
def my_agent(message: str) -> str:
    intent = classify(message)
    safeloop.step(tool_name="classify", kind="llm",
                  input=message, output=intent, duration_ms=140, status="ok")

    order = lookup_order(intent)
    safeloop.step(tool_name="lookup_order", kind="tool",
                  input=intent, output=order, duration_ms=320, status="ok")

    return draft_reply(order)

agent = safeloop.wrap(my_agent)
agent("where's my refund?")
```

If `my_agent` raises, the wrapper records the failure and re-raises — your error handling stays in your hands.

## Async agents

```python
import asyncio
import safeloop

safeloop.init(api_key="sk_live_...")

async def my_agent(prompt):
    ...

agent = safeloop.wrap(my_agent)
asyncio.run(agent("hello"))
```

`safeloop.wrap` detects coroutine functions automatically; the wrapped callable stays awaitable.

## Reliability guarantees

These are enforced by the SDK and verified by the test suite:

- **Never crashes your agent.** Every internal error is caught and dropped (set `debug=True` in `init` to log them).
- **Never blocks on the network.** Traces are queued and shipped from a daemon thread; the wrapped call returns as soon as your agent returns.
- **Never makes extra LLM calls.** No retries or shadow prompts inside `wrap()` — your token spend is unchanged.
- **Survives transient ingest failures.** 5xx and 429 responses are retried with exponential backoff. Permanent 4xx errors are dropped.

## Configuration

| Param | Env var | Default | What |
|---|---|---|---|
| `api_key` | `SAFELOOP_API_KEY` | — | Project key, looks like `sk_live_*` |
| `endpoint` | `SAFELOOP_ENDPOINT` | `https://safeloop.dev/v1/traces` | Ingest URL — override for self-host / local dev |
| `project_name` | — | — | Display label on the dashboard |
| `environment` | — | `prod` | `prod` / `staging` / `dev` |
| `timeout_seconds` | — | `2.0` | Per-request HTTP timeout |
| `debug` | — | `False` | Log dropped traces to stderr |
| `enabled` | — | `True` | Set `False` in tests to disable shipping |

## Local development

```bash
git clone https://github.com/ego-debug/SafeLoop
cd SafeLoop/sdks/python
pip install -e ".[dev]"
pytest
```

Tests use `respx` to mock the HTTPX client — no real network. CI runs against Python 3.9, 3.11, and 3.12 on every push.

## Versioning

Pre-1.0: minor bumps for any breaking change. Post-1.0: standard semver.

## License

MIT
