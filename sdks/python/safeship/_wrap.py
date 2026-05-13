"""Instrument an agent callable so every call ships a trace to SafeShip."""

from __future__ import annotations

import functools
import inspect
import time
from collections.abc import Awaitable
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Callable, Optional, TypeVar, cast

from ._config import get_config
from ._transport import Transport

F = TypeVar("F", bound=Callable[..., Any])


# Active step list for the in-flight run. Lets nested ``record_step()`` calls
# attach into the parent run automatically — this is what an SDK-level
# ``@safeship.step`` decorator would target later.
_active_steps: ContextVar[list[dict[str, Any]] | None] = ContextVar(
    "safeship_active_steps", default=None
)


def record_step(
    *,
    tool_name: str | None = None,
    kind: str | None = None,
    input: Any = None,
    output: Any = None,
    duration_ms: int | None = None,
    status: str = "ok",
) -> None:
    """Manually append a step to the in-flight run. No-op when called outside
    of a wrapped agent invocation."""
    steps = _active_steps.get()
    if steps is None:
        return
    steps.append(
        {
            "tool_name": tool_name,
            "kind": kind,
            "input": _safe(input),
            "output": _safe(output),
            "duration_ms": duration_ms,
            "status": status,
        }
    )


def wrap(agent: F, *, name: str | None = None) -> F:
    """Wrap ``agent`` so every invocation ships a trace.

    Works for both sync and async callables. The wrapped callable mirrors
    the signature of the original; tracing failures never propagate.
    """
    if not callable(agent):
        raise TypeError("safeship.wrap expects a callable")

    is_coro = inspect.iscoroutinefunction(agent)
    label = name or getattr(agent, "__name__", None) or "agent"

    if is_coro:

        @functools.wraps(agent)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            steps: list[dict[str, Any]] = []
            token = _active_steps.set(steps)
            started_at = datetime.now(timezone.utc)
            t0 = time.perf_counter()
            try:
                result = await cast(Callable[..., Awaitable[Any]], agent)(*args, **kwargs)
                _emit_run(label, steps, started_at, t0, args, kwargs, result, error=None)
                return result
            except Exception as exc:
                _emit_run(label, steps, started_at, t0, args, kwargs, None, error=exc)
                raise
            finally:
                _active_steps.reset(token)

        return cast(F, async_wrapper)

    @functools.wraps(agent)
    def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
        steps: list[dict[str, Any]] = []
        token = _active_steps.set(steps)
        started_at = datetime.now(timezone.utc)
        t0 = time.perf_counter()
        try:
            result = agent(*args, **kwargs)
            _emit_run(label, steps, started_at, t0, args, kwargs, result, error=None)
            return result
        except Exception as exc:
            _emit_run(label, steps, started_at, t0, args, kwargs, None, error=exc)
            raise
        finally:
            _active_steps.reset(token)

    return cast(F, sync_wrapper)


def _emit_run(
    label: str,
    steps: list[dict[str, Any]],
    started_at: datetime,
    t0: float,
    args: tuple,
    kwargs: dict,
    result: Any,
    error: BaseException | None,
) -> None:
    config = get_config()
    transport = cast(Optional[Transport], config._transport)
    if transport is None or not config.enabled:
        return

    duration_ms = int((time.perf_counter() - t0) * 1000)

    # If the agent didn't record any explicit steps, synthesize a single
    # "agent" step so the run has something to display in the dashboard.
    if not steps:
        steps = [
            {
                "tool_name": label,
                "kind": "llm",
                "input": _safe({"args": args, "kwargs": kwargs}),
                "output": _safe(result) if error is None else None,
                "duration_ms": duration_ms,
                "status": "fail" if error is not None else "ok",
            }
        ]

    payload = {
        "run": {
            "trigger": "production",
            "score": None,
            "status": "fail" if error is not None else "ok",
            "started_at": started_at.isoformat(),
            "duration_ms": duration_ms,
            "model": None,
        },
        "steps": steps,
    }

    try:
        transport.enqueue(payload)
    except Exception:
        # Never let an instrumentation error propagate into the agent path.
        pass


_MAX_REPR = 8 * 1024  # cap captured payloads so we don't ship megabytes


def _safe(value: Any) -> Any:
    """Best-effort JSON-friendly snapshot of an arbitrary value."""
    try:
        # Strings / numbers / bools / None pass through
        if isinstance(value, (str, int, float, bool)) or value is None:
            if isinstance(value, str) and len(value) > _MAX_REPR:
                return value[:_MAX_REPR] + "…"
            return value
        if isinstance(value, (list, tuple)):
            return [_safe(v) for v in list(value)[:200]]
        if isinstance(value, dict):
            return {str(k): _safe(v) for k, v in list(value.items())[:200]}
        # Fall back to repr — never raise from instrumentation
        s = repr(value)
        if len(s) > _MAX_REPR:
            s = s[:_MAX_REPR] + "…"
        return s
    except Exception:
        return "<unrepresentable>"
