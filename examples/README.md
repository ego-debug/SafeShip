# SafeShip examples

Runnable demos you can clone and exercise locally — **no SafeShip account, no
LLM provider key, no network**. Useful for:

- Seeing the SDK work end-to-end in 30 seconds.
- Understanding how cassette replay short-circuits live LLM calls in CI.
- Validating that nothing leaks from your environment when you contribute.

| Demo | Time | What it proves |
| --- | --- | --- |
| [`cassette-replay/`](./cassette-replay) | 60 s | An agent makes one Anthropic call. SafeShip's transport replays a cached response — Anthropic is never touched, no API key needed. The YAML assertion runs against the cached output and passes. |

More demos land here as we ship them. PRs welcome — see
[`../CONTRIBUTING.md`](../CONTRIBUTING.md).
