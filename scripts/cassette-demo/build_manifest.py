"""Generate manifest.json with one test + a correctly-hashed cassette.

The hash MUST match what `_instrument._canonical_request_hash` produces
for the exact request body demo_agent will send. We rebuild both sides
in this script so they can't drift apart.

Usage:
    python build_manifest.py > manifest.json
"""

from __future__ import annotations

import base64
import hashlib
import json


def canonical_hash(body: bytes) -> str:
    """Mirror of safeship._instrument._canonical_request_hash."""
    try:
        parsed = json.loads(body)
        canonical = json.dumps(parsed, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    except Exception:
        return hashlib.sha256(body).hexdigest()


# This MUST match exactly what demo_agent.agent("hello") sends.
REQUEST_BODY = json.dumps(
    {
        "model": "claude-sonnet-4-6",
        "max_tokens": 8,
        "messages": [{"role": "user", "content": "hello"}],
    }
).encode("utf-8")

# What the cassette returns. The assertion in the test_yaml checks that
# this text ends up in the agent's output — so if cassette replay works,
# the assertion passes; if it doesn't, the agent would 401 from
# Anthropic (no real key) and the assertion would fail.
RESPONSE_BODY = json.dumps(
    {
        "id": "msg_cassette_demo_01",
        "type": "message",
        "role": "assistant",
        "model": "claude-sonnet-4-6",
        "content": [{"type": "text", "text": "cached_demo_response"}],
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 3, "output_tokens": 4},
    }
).encode("utf-8")

cassette_entry = {
    "index": 0,
    "host": "api.anthropic.com",
    "method": "POST",
    "path": "/v1/messages",
    "request_body": base64.b64encode(REQUEST_BODY).decode("ascii"),
    "request_hash": canonical_hash(REQUEST_BODY),
    "response_status": 200,
    "response_body": base64.b64encode(RESPONSE_BODY).decode("ascii"),
    "response_headers": {"content-type": "application/json"},
    "duration_ms": 5,
}

manifest = {
    "tests": [
        {
            "id": "demo-cassette-1",
            "name": "demo.cassette_replay_returns_cached_text",
            "test_yaml": (
                "test: demo.cassette_replay_returns_cached_text\n"
                "when: step == 'claude-sonnet-4-6'\n"
                "assert: output.text contains 'cached_demo_response'\n"
            ),
            "replay_input": "hello",
            "original_trace_id": None,
            "created_at": "2026-06-05T00:00:00Z",
            "cached_llm_calls": [cassette_entry],
        }
    ]
}

# Write the file directly with UTF-8 NO-BOM. PowerShell's redirect / Out-File
# add a BOM that the CLI's strict utf-8 JSON loader rejects.
import os
out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "manifest.json")
with open(out_path, "w", encoding="utf-8", newline="\n") as f:
    json.dump(manifest, f, indent=2)
print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes, no BOM)")
