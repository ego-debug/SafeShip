# Target failure types

Four canonical agent failure modes the suggest engine must produce
useful regression tests for. Picked because they account for the bulk
of "agent broke in front of a user" issues in the public traces I
audited (Anthropic's agentic-misuse papers, LangSmith error
taxonomies, Helicone's annual report). Specific enough to design
deterministic assertions for; common enough that the same shape
recurs across customer agents.

---

## 1. `hallucinated_value`

**Symptom**: an LLM-generated step output contains a value (a number,
an identifier, a string) that is inconsistent with a fact already
produced by an earlier tool step in the same run.

**Canonical example**: `draft_reply` told the customer "we'll refund
**$249.00**" but `lookup_order` had already returned `total: "$24.99"`.
The model invented the digits.

**Good test shape**: assert that the LLM output contains (or equals)
a specific field from the earlier tool step.

```yaml
test: draft_reply.refund_matches_order
when: step == "draft_reply"
assert: output contains lookup_order.output.total
```

**Why this matters**: hallucinated values are the failure mode that
costs customer trust the fastest. The fix is mechanical — the test
runner can check "did the LLM output contain the canonical fact"
without judgment.

---

## 2. `silent_empty_result`

**Symptom**: a tool step returned an empty list, null, or
zero-result response **without raising an error**, and the agent then
proceeded as if it had data. The LLM downstream typically invents
plausible-looking content to fill the void.

**Canonical example**: `search_kb` returned `{ results: [] }` for a
customer-support query. The downstream `draft_reply` produced "Per
our documentation, …" — fabricated, because there was no doc.

**Good test shape**: assert the tool output is non-empty OR carries
an explicit not-found status.

```yaml
test: search_kb.no_silent_empty
when: step == "search_kb"
assert: (output.results != [] and output.results != null) or output.status == "not_found"
```

**Why this matters**: silent empties are the most common cause of
"the agent confidently made stuff up." Distinct from
hallucinated_value because the fault is in the *tool's* contract,
not the LLM's recall.

---

## 3. `schema_violation`

**Symptom**: a step output is missing a field that downstream code
needs, or a field has the wrong type. Often surfaces as a
`TypeError` or a downstream tool getting `undefined`.

**Canonical example**: `classify_intent` returned the bare string
`"refund_request"` when downstream `route_to_queue` expected
`{ intent: string, confidence: number }`. The router crashed with
`Cannot read property 'intent' of string`.

**Good test shape**: assert that the required fields exist on the
output with the right types.

```yaml
test: classify_intent.returns_object_with_confidence
when: step == "classify_intent"
assert: output.intent != null and output.confidence != null
```

**Why this matters**: schema drift between LLM-generated structured
output and downstream consumers is the #1 reason agents fail after a
model upgrade. The test is cheap to author and catches the regression
the first time it recurs.

---

## 4. `tool_loop`

**Symptom**: the same tool is called many times in one run without
converging. Either the LLM doesn't trust the first result, or it
keeps tweaking the input hoping for a different output. The run
either times out, exhausts a budget, or eventually fails with
something unrelated.

**Canonical example**: `lookup_order` was called 8 times with the
same `order_id`, each returning the same `{ status: "not_found" }`.
The agent never gave up.

**Good test shape**: assert the count of calls to a specific tool
stays under a sane budget.

```yaml
test: lookup_order.call_count_budget
when: step == "lookup_order"
assert: count(steps where step == "lookup_order") <= 2
```

**Why this matters**: loops burn tokens silently. The customer
notices because their bill spikes or the response takes 40 seconds.
A `count(...) <= N` assertion is one line and stops the bleeding.

---

## Out of scope (for now)

These are real failure modes too, but harder to test deterministically
without judgment, so they're not in the v1 eval set:

- Tone / brand-voice drift in LLM outputs
- Subtle factual errors that aren't contradicted by trace context
- Race conditions across multiple concurrent runs
- Authorization / access-control bypasses

We can add cases for these once we have a heuristic that doesn't
require human reading of every output.
