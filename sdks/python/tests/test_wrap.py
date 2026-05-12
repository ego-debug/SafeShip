"""End-to-end behavior of ``safeship.init`` + ``safeship.wrap``.

We use ``respx`` to mock the HTTPX client so no real network ever happens.
"""

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
def mock_endpoint():
    with respx.mock(base_url="https://stub.safeship.test") as r:
        yield r


def test_wrap_returns_passthrough_for_sync(mock_endpoint):
    """Wrapping a sync callable preserves return value + signature."""
    route = mock_endpoint.post("/v1/traces").mock(
        return_value=httpx.Response(200, json={"ok": True, "run_id": "r1", "steps": 1})
    )
    safeship.init(api_key="sk_live_test", endpoint="https://stub.safeship.test/v1/traces")

    def agent(msg: str) -> str:
        return f"echo: {msg}"

    wrapped = safeship.wrap(agent)
    assert wrapped("hi") == "echo: hi"

    assert _wait_until(lambda: route.called), "expected a POST within 2s"
    body = route.calls.last.request.read().decode()
    assert "sk_live_test" not in body  # only in auth header, not body
    auth = route.calls.last.request.headers.get("authorization", "")
    assert auth == "Bearer sk_live_test"


def test_wrap_never_crashes_agent_when_transport_fails(mock_endpoint):
    """A 500 from ingest must not propagate to the customer's agent path."""
    mock_endpoint.post("/v1/traces").mock(return_value=httpx.Response(500))
    safeship.init(api_key="sk_live_test", endpoint="https://stub.safeship.test/v1/traces")

    def agent() -> str:
        return "ok"

    wrapped = safeship.wrap(agent)
    assert wrapped() == "ok"  # agent path completes regardless of ingest status


def test_wrap_captures_exception_and_reraises(mock_endpoint):
    """When the wrapped agent raises, the exception must propagate AND the
    run must be sent with status='fail'."""
    captured: list = []
    route = mock_endpoint.post("/v1/traces").mock(
        side_effect=lambda req: (
            captured.append(req.read()),
            httpx.Response(200, json={"ok": True}),
        )[1]
    )
    safeship.init(api_key="sk_live_test", endpoint="https://stub.safeship.test/v1/traces")

    def agent():
        raise ValueError("nope")

    wrapped = safeship.wrap(agent)
    with pytest.raises(ValueError, match="nope"):
        wrapped()

    assert _wait_until(lambda: route.called)
    body = captured[0].decode()
    assert '"status": "fail"' in body or '"status":"fail"' in body


def test_record_step_appends_to_run(mock_endpoint):
    """safeship.step(...) inside the wrapped path attaches to the parent run."""
    captured: list = []
    route = mock_endpoint.post("/v1/traces").mock(
        side_effect=lambda req: (
            captured.append(req.read()),
            httpx.Response(200, json={"ok": True}),
        )[1]
    )
    safeship.init(api_key="sk_live_test", endpoint="https://stub.safeship.test/v1/traces")

    def agent():
        safeship.step(tool_name="classify", kind="llm", input="msg", output="intent", duration_ms=42, status="ok")
        safeship.step(tool_name="reply", kind="llm", input="intent", output="hello", duration_ms=10, status="ok")
        return "done"

    wrapped = safeship.wrap(agent)
    assert wrapped() == "done"
    assert _wait_until(lambda: route.called)
    body = captured[0].decode()
    assert '"tool_name": "classify"' in body or '"tool_name":"classify"' in body
    assert '"tool_name": "reply"' in body or '"tool_name":"reply"' in body


@pytest.mark.asyncio
async def test_async_agent_supported(mock_endpoint):
    """Async callables wrap the same way; the wrapped fn is still awaitable."""
    route = mock_endpoint.post("/v1/traces").mock(
        return_value=httpx.Response(200, json={"ok": True})
    )
    safeship.init(api_key="sk_live_test", endpoint="https://stub.safeship.test/v1/traces")

    async def agent(x: int) -> int:
        await asyncio.sleep(0)
        return x * 2

    wrapped = safeship.wrap(agent)
    assert await wrapped(7) == 14
    assert _wait_until(lambda: route.called)


def test_init_without_api_key_disables_ingest(mock_endpoint):
    """No API key → wrap is a no-op shipper but the agent still works."""
    mock_endpoint.post("/v1/traces").mock(return_value=httpx.Response(200))
    safeship.init()  # no key, no env

    def agent():
        return "ok"

    wrapped = safeship.wrap(agent)
    assert wrapped() == "ok"
    # Give the transport a chance to (not) ship anything
    time.sleep(0.2)
    assert not mock_endpoint["/v1/traces"].called


def test_record_step_outside_wrap_is_noop():
    """Calling safeship.step() outside a wrapped agent must not crash."""
    safeship.init(api_key="sk_live_test")
    # No `wrap`, no run in flight — must be silent.
    safeship.step(tool_name="orphan", kind="tool", input=None, output=None, duration_ms=1, status="ok")


def test_wrap_with_non_callable_raises():
    safeship.init(api_key="sk_live_test")
    with pytest.raises(TypeError):
        safeship.wrap("not callable")  # type: ignore[arg-type]


def test_disabled_flag_skips_ingest(mock_endpoint):
    mock_endpoint.post("/v1/traces").mock(return_value=httpx.Response(200))
    safeship.init(api_key="sk_live_test", endpoint="https://stub.safeship.test/v1/traces", enabled=False)

    def agent():
        return "ok"

    assert safeship.wrap(agent)() == "ok"
    time.sleep(0.2)
    assert not mock_endpoint["/v1/traces"].called


def test_config_singleton_holds_overrides():
    safeship.init(api_key="sk_live_test", environment="staging", project_name="demo")
    cfg = get_config()
    assert cfg.api_key == "sk_live_test"
    assert cfg.environment == "staging"
    assert cfg.project_name == "demo"
