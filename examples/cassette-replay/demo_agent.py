"""Cassette-demo agent. Exists only to prove Phase 3 works end-to-end.

The agent makes one real-shaped Anthropic POST. When run under
`safeship test` with the cassette manifest in this directory, the
auto-instrument transport short-circuits the call and returns the
cached response — meaning the agent never actually reaches Anthropic.
That's the whole point of Phase 3.

To prove there's no live call, we deliberately don't read an API key
from the environment; if Anthropic was being hit for real, the request
would 401. If the test passes, the cassette did its job.
"""

from __future__ import annotations

import httpx

import safeship


def agent(prompt: str) -> str:
    client = httpx.Client(timeout=5.0)
    resp = client.post(
        "https://api.anthropic.com/v1/messages",
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": 8,
            "messages": [{"role": "user", "content": prompt}],
        },
        headers={
            # Intentionally NOT a real key. If the cassette doesn't
            # short-circuit, Anthropic rejects this with 401 and the
            # test fails — which would prove the cassette didn't work.
            "x-api-key": "cassette-demo-no-real-key",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    body = resp.json()
    # Anthropic responses have content as a list of blocks; pick the
    # first text block.
    blocks = body.get("content", [])
    for b in blocks:
        if isinstance(b, dict) and b.get("type") == "text":
            return b.get("text", "")
    return ""


# Initialize SafeShip at module load so the auto-instrument transport
# is patched onto httpx BEFORE the test runner invokes the agent. The
# test runner (cli.py + _testrunner.py) wraps the bare `agent`
# function itself — we don't pre-wrap here.
safeship.init(api_key="sk_live_demo_unused")
