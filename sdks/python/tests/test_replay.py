"""Phase 3b — LLM call recording + replay round-trip.

Covers:
  - Recording side: a wrapped agent that hits Anthropic produces a
    cached_llm_calls list on the emitted trace payload.
  - Replay side: feeding that list back into the test runner via
    set_replay_cache() short-circuits the network and returns the cached
    response with no provider hit.
  - Mode switch: cached_only returns synthetic 599 on miss; cached_or_live
    falls back to a live call; live ignores the cache entirely.
  - Hash matching: small noise (key order, whitespace) doesn't break a
    hit; a different prompt produces a miss.
  - Feature flag: SAFESHIP_REPLAY_LLM_CACHE controls whether the runner
    even installs the cache.
  - Backwards compat: a test with cached_llm_calls=None falls back to
    Phase-2 live-call behavior.
"""

from __future__ import annotations

import base64
import json
import time

import httpx
import pytest
import respx

import safeship
from safeship import _instrument
from safeship._testrunner import ManifestEntry, run_test


# ---------- shared fixtures ----------


@pytest.fixture
def safeship_endpoint():
    with respx.mock(base_url="https://stub.safeship.test", assert_all_called=False) as r:
        yield r


def _wait_until(predicate, timeout=2.0, interval=0.02):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(interval)
    return False


def _capture_safeship_posts(endpoint: respx.MockRouter) -> list[dict]:
    posted: list[dict] = []

    def _capture(request):
        posted.append(json.loads(request.content))
        return httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})

    endpoint.post("/v1/traces").mock(side_effect=_capture)
    return posted


# ---------- recording side ----------


def test_recording_buffers_anthropic_call_into_payload(safeship_endpoint):
    """A wrapped agent that calls Anthropic must produce a non-empty
    cached_llm_calls field on the shipped trace payload."""
    posted = _capture_safeship_posts(safeship_endpoint)
    safeship_endpoint.add(
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(
                200,
                json={
                    "content": [{"type": "text", "text": "ok"}],
                    "model": "claude-sonnet-4-6",
                    "usage": {"input_tokens": 1, "output_tokens": 1},
                },
            )
        )
    )

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    @safeship.wrap
    def agent(q: str) -> str:
        client = httpx.Client()
        r = client.post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 8,
                "messages": [{"role": "user", "content": q}],
            },
        )
        return r.json()["content"][0]["text"]

    assert agent("hi") == "ok"
    assert _wait_until(lambda: len(posted) >= 1)
    payload = posted[-1]
    calls = payload.get("cached_llm_calls")
    assert calls and isinstance(calls, list) and len(calls) == 1
    entry = calls[0]
    assert entry["host"] == "api.anthropic.com"
    assert entry["path"] == "/v1/messages"
    assert entry["response_status"] == 200
    # body fields are base64-encoded; just sanity-check decode + shape
    decoded = base64.b64decode(entry["request_body"])
    assert b'"max_tokens"' in decoded
    assert isinstance(entry["request_hash"], str) and len(entry["request_hash"]) == 64


def test_non_llm_host_not_in_cached_calls(safeship_endpoint):
    """Only allowlisted LLM hosts get cached; example.com does not."""
    posted = _capture_safeship_posts(safeship_endpoint)
    safeship_endpoint.add(
        respx.get("https://example.com/data").mock(
            return_value=httpx.Response(200, json={"x": 1})
        )
    )

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    @safeship.wrap
    def agent() -> int:
        return httpx.Client().get("https://example.com/data").json()["x"]

    assert agent() == 1
    assert _wait_until(lambda: len(posted) >= 1)
    payload = posted[-1]
    # No cached_llm_calls field (the agent only hit a non-LLM host)
    assert "cached_llm_calls" not in payload or not payload.get("cached_llm_calls")


# ---------- replay side ----------


def _make_cached_entry(prompt: str, response_text: str, index: int = 0) -> dict:
    """Helper: build what a recorded cache entry would look like."""
    request_body = json.dumps(
        {
            "model": "claude-sonnet-4-6",
            "max_tokens": 8,
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode("utf-8")
    response_body = json.dumps(
        {
            "content": [{"type": "text", "text": response_text}],
            "model": "claude-sonnet-4-6",
            "usage": {"input_tokens": 1, "output_tokens": 1},
        }
    ).encode("utf-8")
    return {
        "index": index,
        "host": "api.anthropic.com",
        "method": "POST",
        "path": "/v1/messages",
        "request_body": base64.b64encode(request_body).decode("ascii"),
        "request_hash": _instrument._canonical_request_hash(request_body),
        "response_status": 200,
        "response_body": base64.b64encode(response_body).decode("ascii"),
        "response_headers": {"content-type": "application/json"},
        "duration_ms": 5,
    }


def test_replay_cache_hit_returns_cached_response_no_network(
    monkeypatch, safeship_endpoint
):
    """With replay flag on + matching cache, the wrapped agent's Anthropic
    call returns cached bytes and never touches respx — meaning no real
    provider hit, no LLM bill."""
    monkeypatch.setenv("SAFESHIP_REPLAY_LLM_CACHE", "true")
    # Intentionally do NOT register a respx route for api.anthropic.com.
    # If replay is broken and the call goes live, respx will raise.

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    cache = [_make_cached_entry(prompt="hi", response_text="cached_ok")]
    entry = ManifestEntry(
        id="t1",
        name="test_replay",
        test_yaml="test: test_replay\nwhen: step == 'claude-sonnet-4-6'\nassert: output.text contains 'cached_ok'",
        replay_input="hi",
        cached_llm_calls=cache,
    )

    def my_agent(q: str) -> str:
        client = httpx.Client()
        r = client.post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 8,
                "messages": [{"role": "user", "content": q}],
            },
        )
        return r.json()["content"][0]["text"]

    result = run_test(entry, my_agent)
    assert result.status == "passed", result.reason


def test_cached_only_miss_returns_599_so_assertion_fails(
    monkeypatch, safeship_endpoint
):
    """cached_only mode: a hash miss returns a synthetic 599 fixture-error
    response so the test fails explicitly rather than silently going live."""
    monkeypatch.setenv("SAFESHIP_REPLAY_LLM_CACHE", "true")

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    # Cache contains "hello" but the agent will send "goodbye".
    cache = [_make_cached_entry(prompt="hello", response_text="x")]
    entry = ManifestEntry(
        id="t2",
        name="test_miss_strict",
        test_yaml="test: test_miss_strict\nwhen: step == 'claude-sonnet-4-6'\nassert: output.text contains 'x'",
        replay_input="goodbye",
        cached_llm_calls=cache,
    )

    captured_status = {}

    def my_agent(q: str) -> str:
        client = httpx.Client()
        r = client.post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 8,
                "messages": [{"role": "user", "content": q}],
            },
        )
        captured_status["code"] = r.status_code
        return r.text

    result = run_test(entry, my_agent, replay_mode="cached_only")
    # The 599 response gets returned and the assertion fails (no 'x' in the
    # error JSON body).
    assert result.status == "failed"
    assert captured_status.get("code") == 599


def test_cached_or_live_miss_falls_through_to_real_call(
    monkeypatch, safeship_endpoint
):
    """cached_or_live mode: a hash miss makes a real provider call. We
    register a live respx route to verify the fall-through happened."""
    monkeypatch.setenv("SAFESHIP_REPLAY_LLM_CACHE", "true")
    live_route = safeship_endpoint.add(
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(
                200,
                json={
                    "content": [{"type": "text", "text": "live_ok"}],
                    "model": "claude-sonnet-4-6",
                },
            )
        )
    )

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    cache = [_make_cached_entry(prompt="something_else", response_text="cached_text")]
    entry = ManifestEntry(
        id="t3",
        name="test_fallback",
        test_yaml="test: test_fallback\nwhen: step == 'claude-sonnet-4-6'\nassert: output.text contains 'live_ok'",
        replay_input="hi",
        cached_llm_calls=cache,
    )

    def my_agent(q: str) -> str:
        client = httpx.Client()
        r = client.post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 8,
                "messages": [{"role": "user", "content": q}],
            },
        )
        return r.json()["content"][0]["text"]

    result = run_test(entry, my_agent, replay_mode="cached_or_live")
    assert result.status == "passed", result.reason
    assert live_route.called


def test_live_mode_ignores_cache_entirely(monkeypatch, safeship_endpoint):
    """live mode: the cache is present but ignored. Every call goes to
    the real provider (mocked via respx here)."""
    monkeypatch.setenv("SAFESHIP_REPLAY_LLM_CACHE", "true")
    live_route = safeship_endpoint.add(
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(
                200,
                json={"content": [{"type": "text", "text": "live"}], "model": "x"},
            )
        )
    )

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    # Even with a matching cache, live mode should bypass it.
    cache = [_make_cached_entry(prompt="hi", response_text="cached")]
    entry = ManifestEntry(
        id="t4",
        name="test_live",
        test_yaml="test: test_live\nwhen: step == 'claude-sonnet-4-6'\nassert: output.text contains 'live'",
        replay_input="hi",
        cached_llm_calls=cache,
    )

    def my_agent(q: str) -> str:
        client = httpx.Client()
        r = client.post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 8,
                "messages": [{"role": "user", "content": q}],
            },
        )
        return r.json()["content"][0]["text"]

    result = run_test(entry, my_agent, replay_mode="live")
    assert result.status == "passed", result.reason
    assert live_route.called


def test_feature_flag_disabled_falls_back_to_live(monkeypatch, safeship_endpoint):
    """Without SAFESHIP_REPLAY_LLM_CACHE the runner ignores cached_llm_calls
    and behaves exactly like Phase 2 (live calls always)."""
    monkeypatch.delenv("SAFESHIP_REPLAY_LLM_CACHE", raising=False)
    live_route = safeship_endpoint.add(
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(
                200,
                json={"content": [{"type": "text", "text": "live"}], "model": "x"},
            )
        )
    )

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    cache = [_make_cached_entry(prompt="hi", response_text="cached")]
    entry = ManifestEntry(
        id="t5",
        name="test_flag_off",
        test_yaml="test: test_flag_off\nwhen: step == 'claude-sonnet-4-6'\nassert: output.text contains 'live'",
        replay_input="hi",
        cached_llm_calls=cache,
    )

    def my_agent(q: str) -> str:
        return httpx.Client().post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 8,
                "messages": [{"role": "user", "content": q}],
            },
        ).json()["content"][0]["text"]

    result = run_test(entry, my_agent, replay_mode="cached_only")
    assert result.status == "passed", result.reason
    assert live_route.called, "feature flag off should let the live call through"


def test_backwards_compat_test_without_cached_calls_runs_live(
    monkeypatch, safeship_endpoint
):
    """A pre-Phase-3 test (no cached_llm_calls) must still run via live
    calls — Phase 2 behavior, unchanged."""
    monkeypatch.setenv("SAFESHIP_REPLAY_LLM_CACHE", "true")
    live_route = safeship_endpoint.add(
        respx.post("https://api.anthropic.com/v1/messages").mock(
            return_value=httpx.Response(
                200,
                json={"content": [{"type": "text", "text": "live"}], "model": "x"},
            )
        )
    )

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    entry = ManifestEntry(
        id="t6",
        name="test_legacy",
        test_yaml="test: test_legacy\nwhen: step == 'claude-sonnet-4-6'\nassert: output.text contains 'live'",
        replay_input="hi",
        cached_llm_calls=None,
    )

    def my_agent(q: str) -> str:
        return httpx.Client().post(
            "https://api.anthropic.com/v1/messages",
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 8,
                "messages": [{"role": "user", "content": q}],
            },
        ).json()["content"][0]["text"]

    result = run_test(entry, my_agent)
    assert result.status == "passed", result.reason
    assert live_route.called


def test_hash_canonicalization_handles_key_order(monkeypatch, safeship_endpoint):
    """JSON canonicalization (sorted keys) means reordering request keys
    still hits the cache. Customer's new code might serialize the same
    request body with different key order."""
    monkeypatch.setenv("SAFESHIP_REPLAY_LLM_CACHE", "true")

    safeship.init(
        api_key="sk_live_test",
        endpoint="https://stub.safeship.test/v1/traces",
    )

    # Cache was recorded with one key order
    request_body = json.dumps(
        {
            "model": "claude-sonnet-4-6",
            "max_tokens": 8,
            "messages": [{"role": "user", "content": "hi"}],
        }
    ).encode("utf-8")
    response_body = json.dumps(
        {"content": [{"type": "text", "text": "matched"}], "model": "claude-sonnet-4-6"}
    ).encode("utf-8")
    cache = [
        {
            "index": 0,
            "host": "api.anthropic.com",
            "method": "POST",
            "path": "/v1/messages",
            "request_body": base64.b64encode(request_body).decode("ascii"),
            "request_hash": _instrument._canonical_request_hash(request_body),
            "response_status": 200,
            "response_body": base64.b64encode(response_body).decode("ascii"),
            "response_headers": {"content-type": "application/json"},
            "duration_ms": 5,
        }
    ]

    entry = ManifestEntry(
        id="t7",
        name="test_keys",
        test_yaml="test: test_keys\nwhen: step == 'claude-sonnet-4-6'\nassert: output.text contains 'matched'",
        replay_input="hi",
        cached_llm_calls=cache,
    )

    def my_agent(q: str) -> str:
        # Send the same logical body with a different key order
        return httpx.Client().post(
            "https://api.anthropic.com/v1/messages",
            json={
                "messages": [{"content": q, "role": "user"}],
                "max_tokens": 8,
                "model": "claude-sonnet-4-6",
            },
        ).json()["content"][0]["text"]

    result = run_test(entry, my_agent, replay_mode="cached_only")
    assert result.status == "passed", result.reason
