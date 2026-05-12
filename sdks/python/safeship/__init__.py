"""SafeShip Python SDK.

Quickstart::

    import safeship

    safeship.init(api_key="sk_live_...")
    agent = safeship.wrap(my_agent)

That's it. Every call to ``agent(...)`` ships a trace to SafeShip's
``/v1/traces`` endpoint. Tracing failures NEVER crash your agent.

Want richer traces? Add explicit steps::

    def my_agent(msg):
        intent = classify(msg)
        safeship.step(tool_name="classify", kind="llm",
                      input=msg, output=intent, duration_ms=140, status="ok")
        ...

See https://safeship.dev for the dashboard.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from ._config import get_config, resolve_api_key, resolve_endpoint, set_config
from ._transport import Transport
from ._wrap import record_step as step
from ._wrap import wrap

__version__ = "0.1.0"
__all__ = ["init", "wrap", "step", "shutdown", "__version__"]


def init(
    api_key: Optional[str] = None,
    *,
    endpoint: Optional[str] = None,
    project_name: Optional[str] = None,
    environment: Optional[str] = None,
    timeout_seconds: Optional[float] = None,
    debug: Optional[bool] = None,
    enabled: Optional[bool] = None,
) -> None:
    """Configure the SafeShip SDK. Call once near process startup.

    Args:
        api_key: Your project's ``sk_live_*`` key. Falls back to the
            ``SAFESHIP_API_KEY`` env var if omitted.
        endpoint: Override the ingest URL (testing only).
        project_name: Human-readable label sent with each run.
        environment: e.g. ``"prod"``, ``"staging"``, ``"dev"``.
        timeout_seconds: Per-request HTTP timeout. Default 2s.
        debug: If True, log dropped traces / transport errors to stderr.
        enabled: Set False to disable trace shipping entirely (e.g. in tests).
    """
    resolved_key = resolve_api_key(api_key)
    resolved_endpoint = resolve_endpoint(endpoint)

    set_config(
        api_key=resolved_key,
        endpoint=resolved_endpoint,
        project_name=project_name,
        environment=environment,
        timeout_seconds=timeout_seconds,
        debug=debug,
        enabled=enabled,
    )

    cfg = get_config()
    if cfg._transport is None:
        cfg._transport = Transport(cfg)


def shutdown(timeout: float = 2.0) -> None:
    """Block briefly while the transport drains. Optional — ``init()``
    already registers an ``atexit`` flush."""
    cfg = get_config()
    transport: Any = cfg._transport
    if transport is not None:
        try:
            transport.flush(timeout=timeout)
        except Exception:
            pass


# Annotate ``wrap`` for completeness — re-exported with the same signature
wrap: Callable[..., Any] = wrap  # noqa: F811
