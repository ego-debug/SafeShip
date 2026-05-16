"""Auto-instrumentation behavior — verifies LLM HTTP calls are recorded as
steps without any customer code change, and non-LLM HTTP is untouched."""

from __future__ import annotations

import asyncio
import time

import httpx
import pytest
import respx

import safeship
from safeship._config import get_config


def _wait_until(predicate, timeout=2.0, interval=0.02):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


@pytest.fixture
def safeship_endpoint():
    with respx.mock(base_url="https://stub.safeship.test", assert_all_called=False) as r:
        yield r


def test_anthropic_call_recorded_as_step(safeship_endpoint):
    """A real-world-shaped Anthropic call inside a wrapped agent surfaces
    on the trace as a step with model, messages, and assistant text — no
    safeship.step() call needed."""
    safeship_endpoint.post("/v1/traces").mock(
        return_value=httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})
    )
    captured = {}
    safeship_endpoint.add(
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(
                200,
                json={
                    "id": "msg_01",
                    "type": "message",
                    "role": "assistant",
                    "content": [{"type": "text", "text": "the answer is 42"}],
                    "model": "claude-sonnet-4-6",
                    "stop_reason": "end_turn",
                    "usage": {"input_tokens": 12, "output_tokens": 5},
                },
            )
        )
    )

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    @safeship.wrap
    def agent(question: str) -> str:
        # Customer's existing code — completely unchanged from what they'd
        # write without SafeShip.
        client = httpx.Client()
        resp = client.post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": question}],
            },
        )
        body = resp.json()
        captured["resp"] = body
        return body["content"][0]["text"]

    out = agent("what is 6 times 7")
    assert out == "the answer is 42"
    # Sanity: customer code could still read the response body even though
    # our transport read it for instrumentation purposes.
    assert captured["resp"]["usage"]["output_tokens"] == 5

    # Wait for the trace to be enqueued and posted.
    posted: list[dict] = []

    def _capture_post(request):
        import json as _json
        posted.append(_json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})

    # Re-register the safeship route with a capturing side-effect — respx
    # will use the latest registration.
    safeship_endpoint.post("/v1/traces").mock(side_effect=_capture_post)

    # Make a second call so the route captures the trace
    agent("again")

    assert _wait_until(lambda: len(posted) >= 1), "expected at least one trace POST"

    payload = posted[-1]
    steps = payload["steps"]
    # Should have at least one LLM step from the auto-instrumented Anthropic call
    llm_steps = [s for s in steps if s.get("kind") == "llm"]
    assert llm_steps, f"expected an LLM step, got {steps}"
    step = llm_steps[0]
    assert step["tool_name"] == "claude-sonnet-4-6"
    assert step["status"] == "ok"
    assert isinstance(step["input"], dict)
    assert step["input"]["provider"] == "anthropic"
    assert step["input"]["model"] == "claude-sonnet-4-6"
    assert isinstance(step["output"], dict)
    assert step["output"]["text"] == "the answer is 42"
    assert step["duration_ms"] is not None and step["duration_ms"] >= 0


def test_openai_call_recorded_as_step(safeship_endpoint):
    """OpenAI chat.completions parser shape works."""
    safeship_endpoint.post("/v1/traces").mock(
        return_value=httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})
    )
    safeship_endpoint.add(
        respx.post("https://api.openai.com/v1/chat/completions").mock(
            return_value=httpx.Response(
                200,
                json={
                    "id": "chatcmpl_01",
                    "object": "chat.completion",
                    "model": "gpt-4o",
                    "choices": [
                        {
                            "index": 0,
                            "message": {"role": "assistant", "content": "hi back"},
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5},
                },
            )
        )
    )

    posted: list[dict] = []

    def _capture(request):
        import json as _json
        posted.append(_json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})

    safeship_endpoint.post("/v1/traces").mock(side_effect=_capture)

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    @safeship.wrap
    def agent(msg: str) -> str:
        client = httpx.Client()
        resp = client.post(
            "https://api.openai.com/v1/chat/completions",
            json={
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": msg}],
            },
        )
        return resp.json()["choices"][0]["message"]["content"]

    assert agent("hi there") == "hi back"

    assert _wait_until(lambda: len(posted) >= 1), "expected a trace POST"
    payload = posted[-1]
    llm_steps = [s for s in payload["steps"] if s.get("kind") == "llm"]
    assert llm_steps, f"expected an LLM step, got {payload['steps']}"
    step = llm_steps[0]
    assert step["tool_name"] == "gpt-4o"
    assert step["input"]["provider"] == "openai"
    assert step["output"]["text"] == "hi back"


def test_non_llm_request_passes_through_untouched(safeship_endpoint):
    """A wrapped agent that makes httpx calls to a non-LLM host must not
    produce LLM steps, and the request itself must succeed normally."""
    safeship_endpoint.post("/v1/traces").mock(
        return_value=httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})
    )
    safeship_endpoint.add(
        respx.get("https://example.com/api/things").mock(
            return_value=httpx.Response(200, json={"things": [1, 2, 3]})
        )
    )

    posted: list[dict] = []

    def _capture(request):
        import json as _json
        posted.append(_json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})

    safeship_endpoint.post("/v1/traces").mock(side_effect=_capture)

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    @safeship.wrap
    def agent() -> int:
        with httpx.Client() as c:
            r = c.get("https://example.com/api/things")
        return sum(r.json()["things"])

    assert agent() == 6

    assert _wait_until(lambda: len(posted) >= 1)
    payload = posted[-1]
    # The synthesized "agent" step is fine (it's `kind="llm"` by default
    # in _wrap.py when there are no explicit steps), but there must be no
    # provider-typed steps with tool_name from anthropic/openai parsers.
    for step in payload["steps"]:
        assert (step.get("input") or {}).get("provider") not in {"anthropic", "openai"}


def test_disabled_via_init_kwarg_does_not_patch(safeship_endpoint):
    """auto_instrument=False at init() time must not install the patch.
    Customer's httpx.Client should be untouched."""
    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
        auto_instrument=False,
    )

    # Verify the patch is not present by checking that a fresh client
    # uses a vanilla transport.
    from safeship._instrument import _RecordingTransport

    client = httpx.Client()
    assert not isinstance(client._transport, _RecordingTransport)


def test_disabled_via_env_var(monkeypatch, safeship_endpoint):
    """SAFESHIP_AUTO_INSTRUMENT=false must opt out cleanly."""
    monkeypatch.setenv("SAFESHIP_AUTO_INSTRUMENT", "false")
    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )
    from safeship._instrument import _RecordingTransport

    client = httpx.Client()
    assert not isinstance(client._transport, _RecordingTransport)


def test_instrumentation_does_not_crash_when_provider_errors(safeship_endpoint):
    """If the parser explodes for some reason, the customer's HTTP call
    must still succeed and the SDK must not crash."""
    safeship_endpoint.post("/v1/traces").mock(
        return_value=httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})
    )
    safeship_endpoint.add(
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(200, text="not even valid json")
        )
    )

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    @safeship.wrap
    def agent() -> str:
        client = httpx.Client()
        r = client.post(
            "https://api.anthropic.com/v1/messages",
            json={"model": "claude-sonnet-4-6", "max_tokens": 8, "messages": []},
        )
        return r.text

    # The agent's call still returns successfully even though the parser
    # can't extract structured output.
    assert agent() == "not even valid json"


def test_install_is_idempotent(safeship_endpoint):
    """Calling init() twice (e.g. a misbehaving customer) must not
    double-wrap transports."""
    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )
    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )
    from safeship._instrument import _RecordingTransport

    client = httpx.Client()
    # The client's transport is wrapped exactly once.
    assert isinstance(client._transport, _RecordingTransport)
    inner = client._transport._wrapped
    assert not isinstance(inner, _RecordingTransport)


@pytest.mark.asyncio
async def test_async_anthropic_call_recorded(safeship_endpoint):
    """AsyncClient must be auto-instrumented too."""
    safeship_endpoint.post("/v1/traces").mock(
        return_value=httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})
    )
    safeship_endpoint.add(
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(
                200,
                json={
                    "content": [{"type": "text", "text": "async ok"}],
                    "model": "claude-sonnet-4-6",
                    "usage": {"input_tokens": 1, "output_tokens": 2},
                },
            )
        )
    )

    posted: list[dict] = []

    def _capture(request):
        import json as _json
        posted.append(_json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})

    safeship_endpoint.post("/v1/traces").mock(side_effect=_capture)

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    async def agent(msg: str) -> str:
        async with httpx.AsyncClient() as c:
            r = await c.post(
                "https://api.anthropic.com/v1/messages",
                json={
                    "model": "claude-sonnet-4-6",
                    "max_tokens": 8,
                    "messages": [{"role": "user", "content": msg}],
                },
            )
        return r.json()["content"][0]["text"]

    wrapped = safeship.wrap(agent)
    assert await wrapped("hi") == "async ok"

    assert _wait_until(lambda: len(posted) >= 1)
    payload = posted[-1]
    llm_steps = [s for s in payload["steps"] if s.get("kind") == "llm"]
    assert llm_steps
    assert llm_steps[0]["tool_name"] == "claude-sonnet-4-6"
    assert llm_steps[0]["output"]["text"] == "async ok"


def test_anthropic_failure_recorded_as_failed_step(safeship_endpoint):
    """4xx/5xx responses are recorded as a step with status='fail' so the
    suggest engine knows which call broke."""
    safeship_endpoint.post("/v1/traces").mock(
        return_value=httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})
    )
    safeship_endpoint.add(
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(
                429,
                json={"type": "error", "error": {"type": "rate_limit_error", "message": "slow down"}},
            )
        )
    )

    posted: list[dict] = []

    def _capture(request):
        import json as _json
        posted.append(_json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})

    safeship_endpoint.post("/v1/traces").mock(side_effect=_capture)

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    @safeship.wrap
    def agent() -> int:
        client = httpx.Client()
        r = client.post(
            "https://api.anthropic.com/v1/messages",
            json={"model": "claude-sonnet-4-6", "max_tokens": 8, "messages": []},
        )
        return r.status_code

    assert agent() == 429

    assert _wait_until(lambda: len(posted) >= 1)
    payload = posted[-1]
    llm_steps = [s for s in payload["steps"] if s.get("kind") == "llm"]
    assert llm_steps
    assert llm_steps[0]["status"] == "fail"
