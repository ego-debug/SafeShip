"""Auto-instrumentation of common LLM provider HTTP calls.

Two responsibilities, both driven by the same wrapping httpx transport:

1. **Recording (production):** every outbound Anthropic / OpenAI call is
   timed, parsed into a step via ``record_step()`` (so the trace UI shows
   model + messages + response), and the raw request/response bytes are
   pushed into a per-run buffer (``_active_llm_calls``). The agent
   wrapper ships that buffer alongside the trace so the server can
   persist it as ``runs.cached_llm_calls``; when the user accepts a
   suggestion, those bytes are copied onto ``tests.cached_llm_calls``.

2. **Replay (CI):** the test runner loads ``cached_llm_calls`` from the
   manifest entry, calls ``set_replay_cache(...)`` before invoking the
   agent, and the transport short-circuits matching LLM calls by
   returning the cached response — no provider hit, no LLM bill. Match
   key is ``(cursor_advance, sha256(canonical request body))``. The
   ``replay_mode`` knob controls cache-miss behavior:
     * ``cached_or_live`` (default) — miss falls back to a live call
     * ``cached_only`` — miss returns synthetic 599 so the test fails
       with a clear "fixture mismatch" reason
     * ``live`` — cache is ignored entirely

Both modes still fire ``record_step()`` so the assertion evaluator has
the new trace to work against.


What this does:

- ``install_instrumentation()`` monkey-patches ``httpx.Client.__init__`` and
  ``httpx.AsyncClient.__init__`` so every httpx client created after
  ``safeship.init()`` runs gets a small wrapping transport.
- The wrapper inspects outbound request hosts. If the host is in our LLM
  allowlist (``api.anthropic.com`` / ``api.openai.com``), the wrapper times
  the request, parses request + response into a step dict via the provider
  parser, and calls ``record_step()``. Non-LLM hosts pass straight through.
- ``record_step()`` is a no-op when called outside a wrapped agent run, so
  installing the patch is safe even when the user hasn't called
  ``safeship.wrap``.

Reliability rules (same as the rest of the SDK):

- MUST NEVER crash the customer's HTTP call. Every error in instrumentation
  is swallowed.
- MUST NEVER inflate token costs. No retries, no shadow requests.
- MUST be opt-out via ``SAFESHIP_AUTO_INSTRUMENT=false`` for the small set
  of users whose stack actively conflicts with httpx monkey-patching.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
import time
from contextvars import ContextVar
from typing import Any

import httpx

from ._providers import match_provider
from ._wrap import record_step

_log = logging.getLogger("safeship")


_installed = False
_orig_client_init: Any = None
_orig_async_client_init: Any = None


# Per-run buffer of raw LLM calls (request + response bytes + metadata),
# populated by the recording transport. The agent wrapper sets and reads
# this contextvar; outside of a wrapped run it's None and the transport
# skips buffering. Shape per entry:
#   {
#     "index": int,           # 0-based call order within the run
#     "host": str,            # e.g. "api.anthropic.com"
#     "method": str,          # "POST"
#     "path": str,            # e.g. "/v1/messages"
#     "request_body": str,    # base64-encoded raw bytes
#     "request_hash": str,    # sha256 of canonical request JSON, for matching
#     "response_status": int,
#     "response_body": str,   # base64-encoded raw bytes
#     "response_headers": {str: str},
#     "duration_ms": int,
#   }
_active_llm_calls: ContextVar[list[dict[str, Any]] | None] = ContextVar(
    "safeship_active_llm_calls", default=None
)


# Per-run replay cache, populated by the test runner before invoking the
# wrapped agent. When present, the transport short-circuits matching LLM
# calls and returns the cached response instead of calling the provider.
# Shape: same as _active_llm_calls entries (the runner loads it from the
# manifest's cached_llm_calls field on the test).
_active_replay_cache: ContextVar[list[dict[str, Any]] | None] = ContextVar(
    "safeship_active_replay_cache", default=None
)


# Per-run cursor into the replay cache. Each successful cached match
# advances it; allows duplicate-prompt scenarios to disambiguate by order.
_active_replay_cursor: ContextVar[int] = ContextVar(
    "safeship_active_replay_cursor", default=0
)


# Replay mode for the current run. Set by the test runner from
# safeship.yaml / CLI / env. Possible values:
#   "cached_or_live" — cache hit returns cached; cache miss makes the
#                      real call and emits a warning step. (Default.)
#   "cached_only"    — cache hit returns cached; cache miss returns a
#                      synthetic 599 response so the assertion fails
#                      explicitly with a "fixture mismatch" message.
#   "live"           — cache is ignored entirely; all calls go live.
_active_replay_mode: ContextVar[str] = ContextVar(
    "safeship_active_replay_mode", default="cached_or_live"
)


# ---------- public helpers (called by _wrap and the test runner) ----------

REPLAY_FLAG_ENV = "SAFESHIP_REPLAY_LLM_CACHE"


def is_replay_feature_enabled() -> bool:
    """Two-week observation flag (per the Phase 3 audit). Replay is a no-op
    unless this is truthy. Once we're confident, flip the default in code."""
    v = os.environ.get(REPLAY_FLAG_ENV, "")
    return v.strip().lower() in {"1", "true", "yes", "on"}


def start_recording_buffer() -> list[dict[str, Any]]:
    """Initialize and install a fresh per-run LLM-call buffer. The wrapper
    calls this on agent entry; the returned list is what gets emitted on
    the trace payload."""
    buf: list[dict[str, Any]] = []
    _active_llm_calls.set(buf)
    return buf


def clear_recording_buffer() -> None:
    _active_llm_calls.set(None)


def set_replay_cache(
    calls: list[dict[str, Any]] | None,
    mode: str = "cached_or_live",
) -> None:
    """Install a replay cache for the current contextvar scope. Pass `None`
    to disable replay. Mode must be one of cached_only / cached_or_live /
    live; invalid values fall back to cached_or_live."""
    if mode not in {"cached_only", "cached_or_live", "live"}:
        mode = "cached_or_live"
    _active_replay_cache.set(calls)
    _active_replay_mode.set(mode)
    _active_replay_cursor.set(0)


def clear_replay_cache() -> None:
    _active_replay_cache.set(None)
    _active_replay_mode.set("cached_or_live")
    _active_replay_cursor.set(0)


def get_replay_mode() -> str:
    return _active_replay_mode.get()


# ---------- canonicalization + matching ----------


def _canonical_request_hash(body: bytes) -> str:
    """Hash the request body for cache matching. JSON bodies are canonicalized
    (sorted keys, no whitespace) so harmless reformatting doesn't break
    matches; non-JSON falls back to raw byte hash."""
    if not body:
        return hashlib.sha256(b"").hexdigest()
    try:
        parsed = json.loads(body)
        canonical = json.dumps(parsed, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    except Exception:
        return hashlib.sha256(body).hexdigest()


def _b64encode(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _b64decode(s: str) -> bytes:
    try:
        return base64.b64decode(s.encode("ascii"))
    except Exception:
        return b""


# ---------- recording side ----------


def _record_raw_call(
    request: httpx.Request,
    response: httpx.Response,
    duration_ms: int,
) -> None:
    """Push one raw call into the active recording buffer, if any."""
    buf = _active_llm_calls.get()
    if buf is None:
        return
    try:
        body = bytes(request.content or b"")
        resp_body = bytes(response.content or b"")
        # Cap response bytes at 256KB per call — runaway responses are rare
        # but we don't want to ship megabytes of trace per run.
        if len(resp_body) > 256 * 1024:
            resp_body = resp_body[: 256 * 1024]
        entry = {
            "index": len(buf),
            "host": request.url.host,
            "method": request.method,
            "path": str(request.url.path),
            "request_body": _b64encode(body),
            "request_hash": _canonical_request_hash(body),
            "response_status": response.status_code,
            "response_body": _b64encode(resp_body),
            "response_headers": _filter_response_headers(response.headers),
            "duration_ms": duration_ms,
        }
        buf.append(entry)
    except Exception as exc:
        _log.debug("safeship: raw-call buffer push failed: %s", exc)


def _filter_response_headers(headers: httpx.Headers) -> dict[str, str]:
    """Keep only the headers replay actually needs (content-type matters
    for client-side parsing). Strips request IDs, dates, server-internal
    metadata that would bloat the cache without helping replay."""
    keep = {"content-type"}
    out: dict[str, str] = {}
    for k, v in headers.items():
        if k.lower() in keep:
            out[k.lower()] = v
    return out


# ---------- replay side ----------


def _try_replay(request: httpx.Request) -> httpx.Response | None:
    """Look up the current request in the active replay cache. Returns a
    fabricated httpx.Response on hit, None on miss (caller decides what to
    do based on replay_mode)."""
    cache = _active_replay_cache.get()
    if cache is None:
        return None
    try:
        target_hash = _canonical_request_hash(bytes(request.content or b""))
    except Exception:
        return None
    cursor = _active_replay_cursor.get()
    # Walk forward from the cursor looking for a hash match; if found,
    # advance the cursor past it. This handles the common case where the
    # refactored agent might add or skip non-LLM logic between calls but
    # still issues the same LLM calls in the same order.
    for idx in range(cursor, len(cache)):
        entry = cache[idx]
        if not isinstance(entry, dict):
            continue
        if entry.get("request_hash") != target_hash:
            continue
        # Hit. Build the response and advance the cursor.
        _active_replay_cursor.set(idx + 1)
        return _response_from_cache_entry(entry)
    return None


def _response_from_cache_entry(entry: dict[str, Any]) -> httpx.Response:
    status = int(entry.get("response_status") or 200)
    body = _b64decode(str(entry.get("response_body") or ""))
    headers = entry.get("response_headers") or {}
    if not isinstance(headers, dict):
        headers = {}
    return httpx.Response(
        status_code=status,
        headers=headers,
        content=body,
    )


def _synthetic_miss_response() -> httpx.Response:
    """cached_only mode: synthetic 599 response so the assertion fails
    with a clear "fixture mismatch" reason. 599 is non-standard for HTTP
    (RFC 7231 says 5xx are server errors) and unmistakably ours."""
    body = json.dumps(
        {
            "safeship_replay_error": "fixture_mismatch",
            "detail": (
                "Replay cache had no matching response for this LLM call. "
                "Either the refactored agent is sending a different prompt, "
                "or the test was accepted before Phase 3 (re-accept to "
                "populate the cache)."
            ),
        }
    ).encode("utf-8")
    return httpx.Response(
        status_code=599,
        headers={"content-type": "application/json"},
        content=body,
    )


def install_instrumentation() -> None:
    """Idempotently patch httpx so newly-constructed clients auto-record
    LLM-provider calls. Called from ``safeship.init()``."""
    global _installed, _orig_client_init, _orig_async_client_init
    if _installed:
        return

    _orig_client_init = httpx.Client.__init__
    _orig_async_client_init = httpx.AsyncClient.__init__

    def patched_client_init(self: httpx.Client, *args: Any, **kwargs: Any) -> None:
        _orig_client_init(self, *args, **kwargs)
        _wrap_client_transports(self, sync=True)

    def patched_async_client_init(self: httpx.AsyncClient, *args: Any, **kwargs: Any) -> None:
        _orig_async_client_init(self, *args, **kwargs)
        _wrap_client_transports(self, sync=False)

    httpx.Client.__init__ = patched_client_init  # type: ignore[method-assign]
    httpx.AsyncClient.__init__ = patched_async_client_init  # type: ignore[method-assign]
    _installed = True


def uninstall_instrumentation() -> None:
    """Restore httpx to its original state. Useful for tests and the
    ``SAFESHIP_AUTO_INSTRUMENT=false`` opt-out."""
    global _installed, _orig_client_init, _orig_async_client_init
    if not _installed:
        return
    if _orig_client_init is not None:
        httpx.Client.__init__ = _orig_client_init  # type: ignore[method-assign]
    if _orig_async_client_init is not None:
        httpx.AsyncClient.__init__ = _orig_async_client_init  # type: ignore[method-assign]
    _installed = False


def _wrap_client_transports(client: Any, *, sync: bool) -> None:
    """Replace the client's transport (and any mounted transports) with our
    recording wrapper. Safe to call multiple times — won't double-wrap."""
    try:
        cls = _RecordingTransport if sync else _RecordingAsyncTransport
        # The main transport
        if hasattr(client, "_transport") and client._transport is not None:
            if not isinstance(client._transport, cls):
                client._transport = cls(client._transport)
        # Mounted transports (e.g. per-scheme overrides)
        mounts = getattr(client, "_mounts", None)
        if isinstance(mounts, dict):
            for key, transport in list(mounts.items()):
                if transport is not None and not isinstance(transport, cls):
                    mounts[key] = cls(transport)
    except Exception as exc:
        # If anything goes wrong wrapping the transports, just leave the
        # client untouched. The customer's HTTP still works; we just lose
        # auto-recording for this client.
        _log.debug("safeship: transport wrap failed: %s", exc)


class _RecordingTransport(httpx.BaseTransport):
    """Sync httpx transport that:
      - returns cached responses if a replay cache is active (CI mode)
      - records every LLM call as a step (always)
      - buffers raw bytes for the next ingest payload (recording mode)
    """

    def __init__(self, wrapped: httpx.BaseTransport):
        self._wrapped = wrapped

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        parser = match_provider(request.url.host)
        if parser is None:
            return self._wrapped.handle_request(request)

        # --- replay path -------------------------------------------------
        mode = _active_replay_mode.get()
        if _active_replay_cache.get() is not None and mode != "live":
            cached = _try_replay(request)
            if cached is not None:
                _safely_record(parser, request, cached, 0, None)
                return cached
            if mode == "cached_only":
                miss = _synthetic_miss_response()
                _safely_record(parser, request, miss, 0, None)
                return miss
            # cached_or_live: fall through and make the real call.

        # --- live path ---------------------------------------------------
        t0 = time.perf_counter()
        try:
            response = self._wrapped.handle_request(request)
        except Exception as exc:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            _safely_record(parser, request, None, duration_ms, exc)
            raise

        duration_ms = int((time.perf_counter() - t0) * 1000)
        _safely_buffer_and_record(parser, request, response, duration_ms)
        return response

    def close(self) -> None:
        try:
            self._wrapped.close()
        except Exception:
            pass


class _RecordingAsyncTransport(httpx.AsyncBaseTransport):
    """Async sibling of _RecordingTransport. Same behavior."""

    def __init__(self, wrapped: httpx.AsyncBaseTransport):
        self._wrapped = wrapped

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        parser = match_provider(request.url.host)
        if parser is None:
            return await self._wrapped.handle_async_request(request)

        mode = _active_replay_mode.get()
        if _active_replay_cache.get() is not None and mode != "live":
            cached = _try_replay(request)
            if cached is not None:
                _safely_record(parser, request, cached, 0, None)
                return cached
            if mode == "cached_only":
                miss = _synthetic_miss_response()
                _safely_record(parser, request, miss, 0, None)
                return miss

        t0 = time.perf_counter()
        try:
            response = await self._wrapped.handle_async_request(request)
        except Exception as exc:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            _safely_record(parser, request, None, duration_ms, exc)
            raise

        duration_ms = int((time.perf_counter() - t0) * 1000)
        try:
            await response.aread()
        except Exception:
            pass
        _safely_record(parser, request, response, duration_ms, None)
        _record_raw_call(request, response, duration_ms)
        return response

    async def aclose(self) -> None:
        try:
            await self._wrapped.aclose()
        except Exception:
            pass


def _safely_buffer_and_record(
    parser: Any,
    request: httpx.Request,
    response: httpx.Response,
    duration_ms: int,
) -> None:
    """Read the response body into memory (so we can parse it AND cache it)
    and then both record the step and push to the raw-call buffer.

    Reading caches the bytes on the response, so customer code can still
    access ``response.content`` / ``.text`` / ``.json()`` afterwards
    without a second network read."""
    try:
        response.read()
    except Exception:
        # If we can't read (e.g. streaming response), skip body parsing
        # and record what we have.
        pass
    _safely_record(parser, request, response, duration_ms, None)
    _record_raw_call(request, response, duration_ms)


def _safely_record(
    parser: Any,
    request: httpx.Request,
    response: httpx.Response | None,
    duration_ms: int,
    error: BaseException | None,
) -> None:
    try:
        step = parser(request, response, duration_ms, error)
        record_step(
            tool_name=step.get("tool_name"),
            kind=step.get("kind"),
            input=step.get("input"),
            output=step.get("output"),
            duration_ms=step.get("duration_ms"),
            status=step.get("status", "ok"),
        )
    except Exception as exc:
        _log.debug("safeship: record_step failed: %s", exc)
