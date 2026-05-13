"""Module-level SafeShip configuration. Set via ``safeship.init(...)``."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from threading import RLock
from typing import Optional


@dataclass
class _Config:
    api_key: Optional[str] = None
    # www. is the canonical host. The apex (safeship.dev) 301-redirects to
    # www. and httpx strips Authorization headers on cross-host redirects
    # for security — so we'd silently lose the bearer token mid-trace if
    # we used the apex.
    endpoint: str = "https://www.safeship.dev/v1/traces"
    project_name: Optional[str] = None
    environment: str = "prod"
    timeout_seconds: float = 2.0
    queue_max: int = 1000
    debug: bool = False
    enabled: bool = True
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


def resolve_api_key(explicit: Optional[str]) -> Optional[str]:
    """Resolve the API key from (in order): explicit arg, env var, existing config."""
    if explicit:
        return explicit
    env = os.environ.get("SAFESHIP_API_KEY")
    if env:
        return env
    return _config.api_key


def resolve_endpoint(explicit: Optional[str]) -> str:
    if explicit:
        return explicit
    env = os.environ.get("SAFESHIP_ENDPOINT")
    if env:
        return env
    return _config.endpoint
