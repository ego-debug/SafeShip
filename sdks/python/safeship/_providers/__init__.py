"""Provider-specific parsing for the httpx auto-instrumentation transport.

Each provider module exposes a single ``parse(request, response, duration_ms,
error)`` callable that returns a dict suitable for ``record_step()``. The
parser must never raise — recording is best-effort and never crashes the
customer's HTTP call.
"""

from __future__ import annotations

from typing import Any, Callable, Optional

import httpx

from . import anthropic as _anthropic
from . import openai as _openai

# Map host suffix → provider parser
_PROVIDERS: dict[str, Callable[..., dict[str, Any]]] = {
    "api.anthropic.com": _anthropic.parse,
    "api.openai.com": _openai.parse,
}


def match_provider(host: str) -> Optional[Callable[..., dict[str, Any]]]:
    """Return the parser for the given host, or None if not an LLM host."""
    if not host:
        return None
    return _PROVIDERS.get(host.lower())


__all__ = ["match_provider"]
