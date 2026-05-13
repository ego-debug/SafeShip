"""Replay agent runs from accepted SafeShip tests, evaluate assertions.

Flow per test:
  1. Swap the SDK's network transport for a local capture buffer.
  2. Wrap the customer's agent with `safeship.wrap` so steps still get
     recorded — they just land in the capture buffer instead of going
     over the network.
  3. Invoke the agent with the manifest's replay_input.
  4. Pull the captured steps out of the buffer.
  5. Hand them + the YAML test definition to `evaluate_test`.
  6. Record pass / fail / skipped / error.

The runner never makes network calls (the manifest fetch is the CLI's job;
the runner is a pure local function for testability). It never executes
customer code on SafeShip servers — only inside the test process (the
customer's CI by default, the customer's laptop during local debugging).
"""

from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Callable

from ._assertions import TestResult, evaluate_test
from ._config import get_config
from ._wrap import wrap as safeship_wrap

__all__ = ["ManifestEntry", "TestRunResult", "run_test", "run_all"]


# ---------- types ----------


@dataclass
class ManifestEntry:
    """One row out of /v1/tests/manifest.

    `replay_input` is the args/kwargs the agent was originally invoked with
    when the failing run was recorded. The canonical shape is
    `{"args": [...], "kwargs": {...}}` (matches what `_wrap._emit_run`
    synthesizes when no explicit safeship.step() calls were made), but any
    JSON value is tolerated and falls back to single-positional-arg
    invocation.
    """

    id: str
    name: str
    test_yaml: str
    replay_input: Any = None
    original_trace_id: str | None = None
    created_at: str | None = None


@dataclass
class TestRunResult:
    # Tell pytest this isn't a test class — the `Test` prefix matches its
    # default collection pattern.
    __test__ = False

    name: str
    status: str  # "passed" | "failed" | "skipped" | "error"
    reason: str
    matched_step: str | None = None
    original_trace_id: str | None = None
    agent_error: str | None = None
    captured_steps: list[Mapping[str, Any]] = field(default_factory=list)


# ---------- runner ----------


def run_test(entry: ManifestEntry, agent: Callable[..., Any]) -> TestRunResult:
    """Execute one manifest entry against `agent`. Returns the outcome."""
    agent_error: str | None = None
    captured: list[Mapping[str, Any]] = []

    wrapped = safeship_wrap(agent, name=getattr(agent, "__name__", "agent"))

    with _capture_run() as buffer:
        try:
            _invoke(wrapped, entry.replay_input)
        except Exception as e:  # noqa: BLE001 — we surface this verbatim to the user
            agent_error = f"{type(e).__name__}: {e}"

    if buffer.runs:
        captured = list(buffer.runs[-1].get("steps", []))

    # If the agent raised AND we got no steps, the trace is unusable —
    # surface that as an error rather than running the evaluator against
    # an empty step list.
    if agent_error and not captured:
        return TestRunResult(
            name=entry.name,
            status="error",
            reason=f"agent raised before producing any trace: {agent_error}",
            original_trace_id=entry.original_trace_id,
            agent_error=agent_error,
        )

    result: TestResult = evaluate_test(entry.test_yaml, captured)
    return TestRunResult(
        name=entry.name,
        status=result.status,
        reason=result.reason,
        matched_step=result.matched_step,
        original_trace_id=entry.original_trace_id,
        agent_error=agent_error,
        captured_steps=captured,
    )


def run_all(
    entries: Sequence[ManifestEntry], agent: Callable[..., Any]
) -> list[TestRunResult]:
    """Run every manifest entry against `agent`, in order. Returns a list
    of results. Never raises — each entry's outcome is captured in its
    TestRunResult."""
    return [run_test(e, agent) for e in entries]


# ---------- internals ----------


class _LocalCapture:
    """Drop-in stand-in for `_transport.Transport` that stashes the emitted
    run+steps locally instead of POSTing them anywhere. Only `enqueue` is
    used by `_wrap._emit_run` — other Transport methods are not exercised."""

    def __init__(self) -> None:
        self.runs: list[Mapping[str, Any]] = []

    def enqueue(self, payload: Mapping[str, Any]) -> None:
        self.runs.append(payload)


@contextmanager
def _capture_run() -> Iterator[_LocalCapture]:
    """Swap the SDK transport with a local capture, then restore. Forces
    `enabled=True` so the swap takes effect even if the host process called
    `safeship.init(enabled=False)`."""
    cfg = get_config()
    orig_transport = cfg._transport
    orig_enabled = cfg.enabled
    orig_api_key = cfg.api_key
    capture = _LocalCapture()
    cfg._transport = capture
    cfg.enabled = True
    # A non-empty api_key short-circuits the Transport-internal "missing
    # api key, dropping trace" guard. _LocalCapture doesn't care about it,
    # but `_emit_run` checks `config.enabled` and reads the transport;
    # leaving api_key=None is harmless here but set a stub for clarity.
    if not cfg.api_key:
        cfg.api_key = "sk_live_testrunner_stub"
    try:
        yield capture
    finally:
        cfg._transport = orig_transport
        cfg.enabled = orig_enabled
        cfg.api_key = orig_api_key


def _invoke(agent: Callable[..., Any], replay_input: Any) -> Any:
    """Call `agent` with whatever shape `replay_input` is in.

    - dict with "args" / "kwargs" keys → unpack as positional + keyword
    - anything else (including a bare string, list, or dict) → pass as a
      single positional argument

    Customers whose original agent took multiple args via the SDK's
    synthesized {args, kwargs} capture will get the unpack path. Customers
    whose agent took a single argument get the fall-through path."""
    if (
        isinstance(replay_input, dict)
        and ("args" in replay_input or "kwargs" in replay_input)
    ):
        args = replay_input.get("args") or []
        kwargs = replay_input.get("kwargs") or {}
        if not isinstance(args, (list, tuple)):
            args = [args]
        if not isinstance(kwargs, dict):
            kwargs = {}
        return agent(*args, **kwargs)
    return agent(replay_input)
