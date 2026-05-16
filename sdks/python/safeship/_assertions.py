"""Evaluate SafeShip YAML test assertions against a captured trace.

A test definition looks like::

    test: draft_reply.refund_matches_order
    when: step == "draft_reply"
    assert: output contains lookup_order.output.total

The DSL grammar Claude emits today (see lib/suggest.ts):

  - dot access:  output.foo, input.order.total
  - equality:    ==, !=
  - regex:       output matches /pattern/
  - contains:    output contains "substring"
  - boolean:     and, or, not

Most of that is already a subset of Python expression syntax. The two
forms that aren't (`matches`, `contains`) get pre-rewritten into Python,
then the whole thing is handed to `simpleeval` (battle-tested restricted
evaluator). We never call `eval()` or `exec()`.

The trace context wraps step input/output dicts in an AttrDict-style
proxy so `output.foo.bar` works on JSON-decoded dicts. Missing fields
return None rather than raising — assertions targeting fields the agent
didn't produce should evaluate to "is None / falsy", not crash.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

import yaml
from simpleeval import EvalWithCompoundTypes, InvalidExpression

__all__ = ["TestResult", "evaluate_test"]


# ---------- public API ----------


@dataclass
class TestResult:
    test: str
    status: str  # "passed" | "failed" | "skipped" | "error"
    reason: str
    matched_step: str | None = None  # tool_name of the step we matched


def evaluate_test(
    test_yaml: str,
    trace_steps: Sequence[Mapping[str, Any]],
) -> TestResult:
    """Run one YAML test definition against a captured trace.

    `trace_steps` is the list of step dicts as captured by the SDK (each has
    `tool_name`, `input`, `output`, `status`, …). Returns a TestResult with
    status one of: passed, failed, skipped, error.

    "skipped" means no step in the trace matched the `when` clause — we treat
    that as a non-blocking outcome (the agent's flow may have legitimately
    routed differently for this input).
    """
    try:
        spec = yaml.safe_load(test_yaml) or {}
    except yaml.YAMLError as e:
        return TestResult("?", "error", f"invalid YAML: {e}")

    if not isinstance(spec, dict):
        return TestResult("?", "error", "test YAML must be a mapping")

    name = str(spec.get("test") or "?")
    when_expr = spec.get("when")
    assert_expr = spec.get("assert")
    if not when_expr or not assert_expr:
        return TestResult(name, "error", "test YAML must define both `when` and `assert`")

    # Locate the first step where `when` evaluates true.
    matched_step: Mapping[str, Any] | None = None
    for step in trace_steps:
        ctx = _build_context(trace_steps, step)
        try:
            ok = _eval_expr(str(when_expr), ctx)
        except _EvalError as e:
            return TestResult(name, "error", f"when clause: {e}")
        if ok:
            matched_step = step
            break

    if matched_step is None:
        return TestResult(name, "skipped", f"no step matched `when: {when_expr}`")

    # Evaluate the assertion against the matched step's context.
    ctx = _build_context(trace_steps, matched_step)
    matched_name = matched_step.get("tool_name")
    try:
        passed = _eval_expr(str(assert_expr), ctx)
    except _EvalError as e:
        return TestResult(name, "error", f"assert clause: {e}", matched_step=matched_name)

    if passed:
        return TestResult(name, "passed", "assertion held", matched_step=matched_name)
    return TestResult(
        name,
        "failed",
        f"assertion `{assert_expr}` was false against step `{matched_name}`",
        matched_step=matched_name,
    )


# ---------- internals ----------


class _EvalError(Exception):
    pass


class _Missing:
    """Sentinel returned for missing dotted fields. Survives chained access
    (`output.a.b.c` where `b` doesn't exist stays Missing all the way down,
    instead of becoming None and then crashing on `.c`). Compares equal to
    None so assertions written as `output.x == None` still pass when x is
    absent, which is the natural shape for the YAML the suggestion engine
    emits."""

    _instance: _Missing | None = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __getattr__(self, name: str) -> _Missing:
        return self

    def __getitem__(self, key: Any) -> _Missing:
        return self

    def __contains__(self, item: Any) -> bool:
        # Without this, Python's `x in _MISSING` falls back to iterating via
        # __getitem__(0), __getitem__(1), …. Since our __getitem__ always
        # returns _MISSING (never raises IndexError), that iteration spins
        # forever. Declare ourselves explicitly empty.
        return False

    def __iter__(self):
        # Empty iterator — for-loops and list comprehensions over a missing
        # field yield nothing rather than hanging.
        return iter(())

    def __len__(self) -> int:
        return 0

    def __eq__(self, other: Any) -> bool:
        return other is None or isinstance(other, _Missing)

    def __ne__(self, other: Any) -> bool:
        return not self.__eq__(other)

    def __bool__(self) -> bool:
        return False

    def __hash__(self) -> int:
        return 0

    def __repr__(self) -> str:
        return "Missing"


_MISSING = _Missing()


class _AttrDict(dict):
    """Dict that also exposes its keys as attributes, recursively. Missing
    keys/attrs return the _MISSING sentinel rather than raising — assertions
    targeting fields the agent didn't produce should evaluate to falsy and
    chained accesses (`output.a.b.c`) should not crash midway."""

    def __getattr__(self, name: str) -> Any:
        if name in self:
            return _wrap(self[name])
        return _MISSING

    def __getitem__(self, key: Any) -> Any:
        if key in self:
            return _wrap(dict.__getitem__(self, key))
        return _MISSING


def _wrap(value: Any) -> Any:
    if isinstance(value, dict) and not isinstance(value, _AttrDict):
        return _AttrDict(value)
    if isinstance(value, list):
        return [_wrap(v) for v in value]
    return value


def _build_context(
    trace_steps: Sequence[Mapping[str, Any]],
    current: Mapping[str, Any],
) -> dict[str, Any]:
    ctx: dict[str, Any] = {
        "step": current.get("tool_name"),
        "output": _wrap(current.get("output")),
        "input": _wrap(current.get("input")),
        "None": None,
        "True": True,
        "False": False,
    }
    # Each named OTHER step is reachable by its tool_name. If a tool_name
    # appears multiple times, the last occurrence wins — simple + predictable.
    for s in trace_steps:
        name = s.get("tool_name")
        if not name or name == current.get("tool_name"):
            continue
        ctx[str(name)] = _AttrDict(
            {
                "input": _wrap(s.get("input")),
                "output": _wrap(s.get("output")),
                "status": s.get("status"),
            }
        )
    return ctx


# Pattern matches `LHS matches /regex-body/`. The LHS capture is intentionally
# loose; we expect the suggestion engine to emit single-expression LHS values
# (e.g. `output`, `output.field`). Nested boolean expressions on the LHS work
# because the regex is non-greedy and stops at the keyword `matches`.
_MATCHES_RE = re.compile(
    r"([\w\.\[\]'\"\(\)\s\-]+?)\s+matches\s+/((?:[^/\\]|\\.)*)/",
)


def _rewrite_dsl(expr: str) -> str:
    """Pre-rewrite the two non-Python DSL forms.

    - `LHS matches /pattern/`  →  `re_search(r\"\"\"pattern\"\"\", LHS)`
    - `LHS contains RHS`       →  `(RHS) in (LHS)`

    Limitations: each form is rewritten at the top level of the expression.
    Nested contains/matches inside parenthesized sub-expressions are not
    supported in v1; the suggestion engine doesn't emit those today.
    """

    def matches_sub(m: re.Match[str]) -> str:
        lhs = m.group(1).strip()
        pat = m.group(2)
        # Triple-quoted raw string so the pattern body doesn't need escaping.
        return f're_search(r"""{pat}""", {lhs})'

    expr = _MATCHES_RE.sub(matches_sub, expr)

    # `contains` rewrite: split on the first occurrence, rewrap as `RHS in LHS`.
    parts = re.split(r"\s+contains\s+", expr, maxsplit=1)
    if len(parts) == 2:
        lhs, rhs = parts[0].strip(), parts[1].strip()
        expr = f"({rhs}) in ({lhs})"

    return expr


def _re_search(pattern: str, s: Any) -> bool:
    if s is None:
        return False
    return re.search(pattern, str(s)) is not None


def _eval_expr(expr: str, ctx: Mapping[str, Any]) -> Any:
    rewritten = _rewrite_dsl(expr)
    evaluator = EvalWithCompoundTypes(
        names=dict(ctx),
        functions={"re_search": _re_search},
    )
    try:
        return evaluator.eval(rewritten)
    except InvalidExpression as e:
        raise _EvalError(str(e)) from e
    except SyntaxError as e:
        raise _EvalError(f"syntax error: {e.msg}") from e
    except Exception as e:
        # simpleeval can raise NumberTooHigh, IterableTooLong, NameNotDefined,
        # FeatureNotAvailable, etc. Normalize to a single error type so the
        # caller doesn't have to enumerate them.
        raise _EvalError(f"{type(e).__name__}: {e}") from e
