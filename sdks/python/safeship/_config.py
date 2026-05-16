"""Module-level SafeShip configuration. Set via ``safeship.init(...)``."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from threading import RLock


@dataclass
class _Config:
    api_key: str | None = None
    # www. is the canonical host. The apex (safeship.dev) 301-redirects to
    # www. and httpx strips Authorization headers on cross-host redirects
    # for security — so we'd silently lose the bearer token mid-trace if
    # we used the apex.
    endpoint: str = "https://www.safeship.dev/v1/traces"
    project_name: str | None = None
    environment: str = "prod"
    timeout_seconds: float = 2.0
    queue_max: int = 1000
    debug: bool = False
    enabled: bool = True
    # When True, init() installs a global httpx interceptor that auto-
    # records LLM-provider HTTP calls (Anthropic, OpenAI) as steps on the
    # in-flight wrapped agent run. No customer code change needed.
    # Disable with SAFESHIP_AUTO_INSTRUMENT=false if it conflicts with
    # some other library that depends on raw httpx behavior.
    auto_instrument: bool = True
    # internal: holds the singleton transport once started
    _transport: object = field(default=None, repr=False)


_lock = RLock()
_config = _Config()


def get_config() -> _Config:
    return _config


def set_config(**kwargs) -> _Config:
    """Update the singleton config. Intended to be called once from ``init()``."""
    with _lock:
        for k, v in kwargs.items():
            if v is None:
                continue
            if not hasattr(_config, k):
                raise AttributeError(f"unknown config key: {k}")
            setattr(_config, k, v)
        return _config


def resolve_api_key(explicit: str | None) -> str | None:
    """Resolve the API key from (in order): explicit arg, env var, existing config."""
    if explicit:
        return explicit
    env = os.environ.get("SAFESHIP_API_KEY")
    if env:
        return env
    return _config.api_key


def resolve_endpoint(explicit: str | None) -> str:
    if explicit:
        return explicit
    env = os.environ.get("SAFESHIP_ENDPOINT")
    if env:
        return env
    return _config.endpoint


def resolve_auto_instrument(explicit: bool | None) -> bool:
    """Resolve auto_instrument from (in order): explicit arg, env var, default True."""
    if explicit is not None:
        return explicit
    env = os.environ.get("SAFESHIP_AUTO_INSTRUMENT")
    if env is not None:
        return env.strip().lower() not in {"0", "false", "no", "off"}
    return _config.auto_instrument
