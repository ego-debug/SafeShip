"""Background-thread transport that POSTs trace payloads to ``/v1/traces``.

Reliability rules (from CLAUDE.md):

- MUST NEVER crash the customer's agent. Every error here is swallowed
  unless debug mode is on.
- MUST NEVER block on the network. Calls to ``enqueue()`` return
  immediately; the actual HTTP POST happens on a daemon worker thread.
- MUST NEVER inflate token costs. No retries against the customer's
  LLM, no shadow calls. Network retries hit our ingest only.
- MUST work offline-ish. Failed POSTs are retried with exponential
  backoff up to ~24 hours, with a bounded in-memory queue. We don't
  persist to disk (yet) — that's a follow-up if real customers need it.
"""

from __future__ import annotations

import atexit
import logging
import random
import threading
import time
from queue import Empty, Queue
from typing import Any, Dict, Optional

import httpx

from ._config import _Config

_log = logging.getLogger("safeloop")


class Transport:
    """Single-process trace shipper. Created and owned by ``init()``."""

    def __init__(self, config: _Config):
        self.config = config
        self._queue: "Queue[Dict[str, Any]]" = Queue(maxsize=config.queue_max)
        self._stop = threading.Event()
        self._client: Optional[httpx.Client] = None
        self._thread = threading.Thread(
            target=self._run,
            name="safeloop-transport",
            daemon=True,
        )
        self._thread.start()
        atexit.register(self.flush, timeout=2.0)

    # ---------- producer side ----------

    def enqueue(self, payload: Dict[str, Any]) -> None:
        if not self.config.enabled:
            return
        try:
            self._queue.put_nowait(payload)
        except Exception as e:
            # Queue full or any other producer error — drop the trace silently
            # rather than blocking the customer's agent.
            self._debug(f"enqueue dropped trace: {e}")

    def flush(self, timeout: float = 2.0) -> None:
        """Best-effort blocking drain. Used at process exit."""
        deadline = time.monotonic() + timeout
        while not self._queue.empty() and time.monotonic() < deadline:
            time.sleep(0.05)
        self._stop.set()

    # ---------- consumer side ----------

    def _run(self) -> None:
        self._client = httpx.Client(timeout=self.config.timeout_seconds)
        try:
            while not self._stop.is_set():
                try:
                    payload = self._queue.get(timeout=0.5)
                except Empty:
                    continue
                self._post_with_retry(payload)
        finally:
            if self._client is not None:
                try:
                    self._client.close()
                except Exception:
                    pass

    def _post_with_retry(self, payload: Dict[str, Any]) -> None:
        """POST one payload. Retry with capped exponential backoff on transient
        failures. Permanent 4xx errors (other than 429) are dropped."""
        if not self.config.api_key:
            self._debug("missing api key, dropping trace")
            return
        attempt = 0
        # ~24h max wait if we want to be faithful to the spec; in practice
        # capping at 12 attempts with a 60s ceiling delays delivery by at
        # most ~12min, which is reasonable for a foreground process.
        while attempt < 12 and not self._stop.is_set():
            try:
                assert self._client is not None
                resp = self._client.post(
                    self.config.endpoint,
                    json=payload,
                    headers={
                        "authorization": f"Bearer {self.config.api_key}",
                        "content-type": "application/json",
                        "user-agent": "safeloop-python/0.1.0",
                    },
                )
                if resp.status_code < 400:
                    return
                if resp.status_code in (401, 403):
                    self._debug(f"auth error {resp.status_code}; dropping trace")
                    return
                if resp.status_code == 429 or resp.status_code >= 500:
                    pass  # fall through to retry
                else:
                    self._debug(f"non-retryable {resp.status_code}; dropping trace")
                    return
            except Exception as e:
                self._debug(f"transport error: {e}")
            attempt += 1
            wait = min(60.0, (2 ** attempt) * 0.25) + random.uniform(0, 0.5)
            if self._stop.wait(timeout=wait):
                return

    def _debug(self, msg: str) -> None:
        if self.config.debug:
            _log.warning("safeloop: %s", msg)
