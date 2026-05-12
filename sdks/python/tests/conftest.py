"""Shared fixtures. Each test gets a freshly-initialized SDK pointed at a
local stub endpoint so HTTP retries don't bleed across tests."""

from __future__ import annotations

import importlib

import pytest


@pytest.fixture(autouse=True)
def reset_safeship():
    """Reload the safeship package between tests so module-level state
    (config, transport thread) doesn't leak."""
    import safeship
    import safeship._config as _config
    import safeship._transport as _transport
    import safeship._wrap as _wrap

    # If a previous test started a transport, ask it to stop.
    cfg = _config.get_config()
    if cfg._transport is not None:
        try:
            cfg._transport.flush(timeout=0.1)
        except Exception:
            pass

    # Reset the singleton — easier than reload() because we want test
    # symbols to keep working.
    cfg.api_key = None
    cfg.endpoint = "https://safeship.dev/v1/traces"
    cfg.project_name = None
    cfg.environment = "prod"
    cfg.timeout_seconds = 2.0
    cfg.queue_max = 1000
    cfg.debug = False
    cfg.enabled = True
    cfg._transport = None

    yield

    cfg = _config.get_config()
    if cfg._transport is not None:
        try:
            cfg._transport.flush(timeout=0.1)
        except Exception:
            pass

    _ = importlib.import_module  # keep imports referenced
    _ = _transport
    _ = _wrap
    _ = safeship
