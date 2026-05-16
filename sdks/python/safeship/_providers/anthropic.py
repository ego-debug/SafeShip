"""Anthropic /v1/messages parser for the auto-instrument transport."""

from __future__ import annotations

import json
from typing import Any

import httpx


def parse(
    request: httpx.Request,
    response: httpx.Response | None,
    duration_ms: int,
    error: BaseException | None,
) -> dict[str, Any]:
    """Build a step dict from a captured Anthropic call. Must never raise."""
    body = _safe_request_body(request)
    model = body.get("model") if isinstance(body, dict) else None
    messages = body.get("messages") if isinstance(body, dict) else None
    max_tokens = body.get("max_tokens") if isinstance(body, dict) else None

    output: Any = None
    status = "ok"

    if error is not None:
        status = "fail"
        output = {"error": repr(error)}
    elif response is not None:
        if response.status_code >= 400:
            status = "fail"
        output = _extract_anthropic_output(response)

    return {
        "tool_name": str(model or "anthropic"),
        "kind": "llm",
        "input": {
            "provider": "anthropic",
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        },
        "output": output,
        "duration_ms": duration_ms,
        "status": status,
    }


def _safe_request_body(request: httpx.Request) -> dict[str, Any]:
    try:
        raw = request.content
        if not raw:
            return {}
        return json.loads(raw)
    except Exception:
        return {}


def _extract_anthropic_output(response: httpx.Response) -> Any:
    """Best-effort: pull the assistant text from an Anthropic /v1/messages
    JSON response. Falls back to the full JSON or raw text."""
    try:
        data = response.json()
    except Exception:
        try:
            return response.text
        except Exception:
            return None
    if not isinstance(data, dict):
        return data
    # Anthropic shape: {"content": [{"type": "text", "text": "..."}], "usage": {...}}
    content = data.get("content")
    if isinstance(content, list):
        chunks = [
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        ]
        text = "".join(chunks).strip()
        if text:
            return {
                "text": text,
                "usage": data.get("usage"),
                "stop_reason": data.get("stop_reason"),
            }
    return data
