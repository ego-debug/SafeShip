"""Unit tests for the YAML assertion evaluator.

Coverage targets:
  - both example shapes from lib/suggest.ts's system prompt
  - the four DSL forms we explicitly support (dot access, ==/!=,
    `contains`, `matches /regex/`)
  - skipped status when no step matches `when`
  - graceful handling of missing fields (returns None, not crash)
  - malformed YAML returns error, not crash
  - simpleeval's safety guarantees still apply (no __import__, no exec)
"""

from __future__ import annotations

from safeship._assertions import evaluate_test


def _step(tool_name, *, input=None, output=None, status="ok"):
    return {"tool_name": tool_name, "input": input, "output": output, "status": status}


# ---------- example A: hallucinated refund amount (from suggest.ts prompt) ----------


def test_contains_passes_when_refund_matches_order():
    trace = [
        _step("lookup_order", output={"total": "$24.99"}),
        _step("draft_reply", output="Your refund of $24.99 will be processed."),
    ]
    test = """
test: draft_reply.refund_matches_order
when: step == "draft_reply"
assert: output contains lookup_order.output.total
"""
    r = evaluate_test(test, trace)
    assert r.status == "passed", f"got {r.status}: {r.reason}"
    assert r.matched_step == "draft_reply"


def test_contains_fails_when_refund_does_not_match():
    trace = [
        _step("lookup_order", output={"total": "$24.99"}),
        _step("draft_reply", output="Your refund of $249.00 will be processed."),
    ]
    test = """
test: draft_reply.refund_matches_order
when: step == "draft_reply"
assert: output contains lookup_order.output.total
"""
    r = evaluate_test(test, trace)
    assert r.status == "failed"
    assert "draft_reply" in r.reason


# ---------- example B: silent KB empty result (from suggest.ts prompt) ----------


def test_complex_bool_passes_when_results_present():
    trace = [_step("search_kb", output={"results": [{"id": "a"}], "status": None})]
    test = """
test: search_kb.no_silent_empty
when: step == "search_kb"
assert: (output.results != [] and output.results != None) or output.status == "not_found"
"""
    r = evaluate_test(test, trace)
    assert r.status == "passed", f"got {r.status}: {r.reason}"


def test_complex_bool_passes_when_not_found_status():
    trace = [_step("search_kb", output={"results": [], "status": "not_found"})]
    test = """
test: search_kb.no_silent_empty
when: step == "search_kb"
assert: (output.results != [] and output.results != None) or output.status == "not_found"
"""
    r = evaluate_test(test, trace)
    assert r.status == "passed"


def test_complex_bool_fails_when_silent_empty():
    trace = [_step("search_kb", output={"results": [], "status": None})]
    test = """
test: search_kb.no_silent_empty
when: step == "search_kb"
assert: (output.results != [] and output.results != None) or output.status == "not_found"
"""
    r = evaluate_test(test, trace)
    assert r.status == "failed"


# ---------- skipped when no matching step ----------


def test_skipped_when_no_step_matches_when_clause():
    trace = [_step("only_thing", output="ok")]
    test = """
test: somewhere.else
when: step == "missing"
assert: output == "anything"
"""
    r = evaluate_test(test, trace)
    assert r.status == "skipped"
    assert r.matched_step is None


# ---------- regex matches form ----------


def test_matches_passes_on_well_formed_phone():
    trace = [_step("validate_phone", output="(555) 123-4567")]
    test = """
test: validate_phone.format
when: step == "validate_phone"
assert: output matches /^\\(\\d{3}\\) \\d{3}-\\d{4}$/
"""
    r = evaluate_test(test, trace)
    assert r.status == "passed", f"got {r.status}: {r.reason}"


def test_matches_fails_on_malformed_phone():
    trace = [_step("validate_phone", output="abc")]
    test = """
test: validate_phone.format
when: step == "validate_phone"
assert: output matches /^\\(\\d{3}\\) \\d{3}-\\d{4}$/
"""
    r = evaluate_test(test, trace)
    assert r.status == "failed"


# ---------- missing-field handling ----------


def test_missing_nested_field_evaluates_to_none():
    trace = [_step("agent", output={})]
    test = """
test: agent.has_field
when: step == "agent"
assert: output.nonexistent == None
"""
    r = evaluate_test(test, trace)
    assert r.status == "passed", f"got {r.status}: {r.reason}"


def test_deeply_missing_field_does_not_crash():
    trace = [_step("agent", output={"a": {}})]
    test = """
test: agent.deep_field
when: step == "agent"
assert: output.a.b.c == None
"""
    r = evaluate_test(test, trace)
    # Missing nested field returns None — assertion `None == None` is True
    assert r.status == "passed", f"got {r.status}: {r.reason}"


# ---------- malformed YAML / specs ----------


def test_invalid_yaml_returns_error():
    trace = [_step("agent", output="x")]
    r = evaluate_test("this :: is :: not :: valid", trace)
    assert r.status == "error"


def test_missing_when_clause_returns_error():
    trace = [_step("agent", output="x")]
    test = """
test: x.y
assert: output == "x"
"""
    r = evaluate_test(test, trace)
    assert r.status == "error"
    assert "when" in r.reason


def test_missing_assert_clause_returns_error():
    trace = [_step("agent", output="x")]
    test = """
test: x.y
when: step == "agent"
"""
    r = evaluate_test(test, trace)
    assert r.status == "error"
    assert "assert" in r.reason


# ---------- safety: dangerous expressions get rejected ----------


def test_import_call_is_rejected():
    trace = [_step("agent", output="x")]
    test = """
test: x.y
when: step == "agent"
assert: __import__("os").system("echo pwned")
"""
    r = evaluate_test(test, trace)
    assert r.status == "error", f"expected error, got {r.status}: {r.reason}"


def test_unbound_function_is_rejected():
    trace = [_step("agent", output="x")]
    test = """
test: x.y
when: step == "agent"
assert: open("/etc/passwd").read() == ""
"""
    r = evaluate_test(test, trace)
    assert r.status == "error"


# ---------- cross-step reference via tool_name ----------


def test_cross_step_attribute_access():
    trace = [
        _step("classify", output={"intent": "refund"}),
        _step("route", input={"intent": "refund"}, output="refund_handler"),
    ]
    test = """
test: route.respects_classification
when: step == "route"
assert: input.intent == classify.output.intent
"""
    r = evaluate_test(test, trace)
    assert r.status == "passed", f"got {r.status}: {r.reason}"


# ---------- contains with string literal RHS (also from suggest.ts docs) ----------


def test_contains_with_string_literal():
    trace = [_step("draft_reply", output="Your refund of $24.99 will be processed.")]
    test = """
test: draft_reply.mentions_refund
when: step == "draft_reply"
assert: output contains "refund"
"""
    r = evaluate_test(test, trace)
    assert r.status == "passed"
