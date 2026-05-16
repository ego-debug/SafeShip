"""OpenAI chat/completions parser for the auto-instrument transport."""

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
    """Build a step dict from a captured OpenAI call. Must never raise."""
    body = _safe_request_body(request)
    model = body.get("model") if isinstance(body, dict) else None
    messages = body.get("messages") if isinstance(body, dict) else None
    prompt = body.get("prompt") if isinstance(body, dict) else None

    output: Any = None
    status = "ok"

    if error is not None:
        status = "fail"
        output = {"error": repr(error)}
    elif response is not None:
        if response.status_code >= 400:
            status = "fail"
        output = _extract_openai_output(response)

    return {
        "tool_name": str(model or "openai"),
        "kind": "llm",
        "input": {
            "provider": "openai",
            "model": model,
            "messages": messages,
            "prompt": prompt,
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


def _extract_openai_output(response: httpx.Response) -> Any:
    """Best-effort: pull the assistant message from a chat.completions or
    completions JSON response."""
    try:
        data = response.json()
    except Exception:
        try:
            return response.text
        except Exception:
            return None
    if not isinstance(data, dict):
        return data
    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            msg = first.get("message")
            if isinstance(msg, dict):
                return {
                    "text": msg.get("content"),
                    "role": msg.get("role"),
                    "usage": data.get("usage"),
                    "finish_reason": first.get("finish_reason"),
                }
            text = first.get("text")
            if text is not None:
                return {
                    "text": text,
                    "usage": data.get("usage"),
                    "finish_reason": first.get("finish_reason"),
                }
    return data
