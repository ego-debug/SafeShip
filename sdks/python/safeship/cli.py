"""`safeship` command-line entry point.

Usage:
    safeship test                       # fetch manifest from the server, replay
    safeship test --manifest tests.json # use a local manifest file (for testing)
    safeship test --config path.yaml    # use a non-default config path

Reads `safeship.yaml` (or `--config`) at the cwd to find the agent entry
point. Fetches the accepted-tests manifest from /v1/tests/manifest using
`SAFESHIP_API_KEY` from the environment, runs every test, prints a summary,
and exits 0 if all passed/skipped or 1 if any failed/errored.

The fetch and run code is split into helpers so the test suite can drive
each piece in isolation without spinning up a fake HTTP server.
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
from collections.abc import Sequence
from dataclasses import asdict
from typing import Any, Callable

import httpx
import yaml

from ._testrunner import ManifestEntry, TestRunResult, run_all

__all__ = [
    "main",
    "load_config",
    "resolve_agent",
    "fetch_manifest",
    "load_manifest_from_file",
    "format_results",
]


# Use the www host explicitly. The apex (safeship.dev) 301-redirects to
# www. and httpx strips the Authorization header on cross-host redirects
# for security — so the bearer token never reaches the route handler.
DEFAULT_ENDPOINT = "https://www.safeship.dev"
DEFAULT_CONFIG_PATH = "safeship.yaml"


# ---------- safeship.yaml loading ----------


class ConfigError(Exception):
    pass


def load_config(path: str = DEFAULT_CONFIG_PATH) -> dict:
    """Load and validate the customer's safeship.yaml. Returns the parsed
    dict on success; raises ConfigError with a human-readable message if
    the file is missing, malformed, or missing required keys."""
    if not os.path.isfile(path):
        raise ConfigError(
            f"safeship config not found at '{path}'. "
            f"Create one with at least:\n  agent: your_module:your_function"
        )
    try:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        raise ConfigError(f"invalid YAML in '{path}': {e}") from e
    if not isinstance(data, dict):
        raise ConfigError(f"'{path}' must contain a mapping at the top level")
    agent_spec = data.get("agent")
    if not agent_spec or not isinstance(agent_spec, str):
        raise ConfigError(
            f"'{path}' must define an `agent` key with the module:function path. "
            f"Example: agent: src.my_agent:run"
        )
    if ":" not in agent_spec:
        raise ConfigError(
            f"`agent` value '{agent_spec}' must use module:function syntax. "
            f"Example: agent: src.my_agent:run"
        )
    return data


# ---------- agent entry-point resolution ----------


def resolve_agent(spec: str) -> Callable[..., Any]:
    """Import the customer's agent function from a `module.path:function`
    spec. Raises ConfigError with a clear message on missing module or
    missing attribute."""
    if ":" not in spec:
        raise ConfigError(
            f"agent spec '{spec}' must use module:function syntax"
        )
    module_path, func_name = spec.split(":", 1)
    module_path = module_path.strip()
    func_name = func_name.strip()
    if not module_path or not func_name:
        raise ConfigError(f"agent spec '{spec}' has an empty module or function name")
    try:
        # cwd is typically not on sys.path when this runs via the console
        # script entry point — prepend it so the customer's own modules
        # resolve.
        if "" not in sys.path and os.getcwd() not in sys.path:
            sys.path.insert(0, os.getcwd())
        module = importlib.import_module(module_path)
    except ImportError as e:
        raise ConfigError(
            f"could not import module '{module_path}' (looked from {os.getcwd()}): {e}"
        ) from e
    if not hasattr(module, func_name):
        raise ConfigError(
            f"module '{module_path}' has no attribute '{func_name}'"
        )
    fn = getattr(module, func_name)
    if not callable(fn):
        raise ConfigError(f"'{module_path}:{func_name}' is not callable")
    return fn


# ---------- manifest fetching ----------


def fetch_manifest(api_key: str, endpoint: str = DEFAULT_ENDPOINT) -> list[ManifestEntry]:
    """GET /v1/tests/manifest. Returns the list of ManifestEntry rows."""
    url = f"{endpoint.rstrip('/')}/v1/tests/manifest"
    # follow_redirects=True so a Vercel/CDN auth wall lands us at the real
    # response (or a clear error), rather than returning the redirect JSON
    # body and confusing _parse_manifest downstream.
    # Don't set a custom user-agent. Vercel deployment protection can
    # flag uncommon UA strings as bot traffic and serve an auth-wall
    # redirect; the default httpx UA gets through reliably.
    resp = httpx.get(
        url,
        headers={
            "authorization": f"Bearer {api_key}",
            "accept": "application/json",
        },
        timeout=15.0,
        follow_redirects=True,
    )
    if resp.status_code == 401:
        raise ConfigError(
            "SafeShip rejected the API key. Set SAFESHIP_API_KEY to your project's "
            "sk_live_* key from https://safeship.dev/app/onboarding."
        )
    if resp.status_code >= 400:
        raise ConfigError(
            f"manifest fetch failed: HTTP {resp.status_code} {resp.text[:200]}"
        )
    # Defensive: detect Vercel/CDN auth-wall payloads that respond 200 with
    # a non-API body (e.g. {redirect: ..., status: ...}). The real manifest
    # always has a `tests` array or is a top-level list.
    try:
        data = resp.json()
    except ValueError as e:
        raise ConfigError(
            f"manifest response was not JSON (server returned HTML?): {resp.text[:200]}"
        ) from e
    if isinstance(data, dict) and "tests" not in data and "redirect" in data:
        raise ConfigError(
            "manifest fetch hit a Vercel/CDN auth wall — the server returned a "
            "redirect challenge instead of the manifest. Either disable deployment "
            "protection on this Vercel project, or set a deployment protection bypass "
            "token. Body sample: " + str(data)[:200]
        )
    return _parse_manifest(data)


def load_manifest_from_file(path: str) -> list[ManifestEntry]:
    """Load a manifest from a local JSON file (for `--manifest` flag)."""
    with open(path, encoding="utf-8") as f:
        return _parse_manifest(json.load(f))


def _parse_manifest(data: Any) -> list[ManifestEntry]:
    if isinstance(data, list):
        rows = data
    elif isinstance(data, dict) and isinstance(data.get("tests"), list):
        rows = data["tests"]
    else:
        raise ConfigError(
            "manifest must be a JSON list of test rows, or {tests: [...]}"
        )
    out: list[ManifestEntry] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        out.append(
            ManifestEntry(
                id=str(r.get("id") or ""),
                name=str(r.get("name") or "?"),
                test_yaml=str(r.get("test_yaml") or r.get("code_yaml") or ""),
                replay_input=r.get("replay_input"),
                original_trace_id=r.get("original_trace_id"),
                created_at=r.get("created_at"),
            )
        )
    return out


# ---------- result formatting ----------


def format_results(results: Sequence[TestRunResult]) -> str:
    """Render a list of TestRunResult as a human-readable summary string."""
    if not results:
        return "No accepted tests in your regression suite — nothing to verify.\n"

    by_status = {"passed": 0, "failed": 0, "skipped": 0, "error": 0}
    lines: list[str] = []
    icons = {"passed": "PASS", "failed": "FAIL", "skipped": "SKIP", "error": "ERR "}

    for r in results:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        lines.append(f"  [{icons.get(r.status, '????')}] {r.name}")
        if r.status == "failed":
            lines.append(f"         {r.reason}")
        elif r.status == "error":
            lines.append(f"         {r.reason}")
            if r.agent_error:
                lines.append(f"         agent: {r.agent_error}")
        elif r.status == "skipped":
            lines.append(f"         {r.reason}")

    total = len(results)
    summary = (
        f"\n  {by_status['passed']} passed · "
        f"{by_status['failed']} failed · "
        f"{by_status['skipped']} skipped · "
        f"{by_status['error']} errored "
        f"(total: {total})\n"
    )
    return "\n".join(lines) + summary


# ---------- main entry point ----------


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="safeship",
        description="SafeShip CLI — replay accepted regression tests against your agent.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    test_p = sub.add_parser(
        "test",
        help="Run accepted SafeShip tests against the agent declared in safeship.yaml",
    )
    test_p.add_argument(
        "--config",
        default=DEFAULT_CONFIG_PATH,
        help="Path to safeship.yaml (default: safeship.yaml in cwd)",
    )
    test_p.add_argument(
        "--manifest",
        default=None,
        help="Path to a local manifest JSON file (skips the network fetch)",
    )
    test_p.add_argument(
        "--endpoint",
        default=None,
        help=f"Override the SafeShip endpoint (default: {DEFAULT_ENDPOINT})",
    )
    test_p.add_argument(
        "--results-json",
        default=None,
        help="Write the test results to this path as JSON (consumed by the Action)",
    )

    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.cmd == "test":
        return _cmd_test(args)
    parser.print_help()
    return 1


def _cmd_test(args: argparse.Namespace) -> int:
    # Hint to the customer's agent that we're in replay mode. Lets them
    # gate non-deterministic side effects (datetime.now() mocks, fixed
    # seeds, lower temperatures) on this var. Documented in /docs.
    os.environ["SAFESHIP_RUN_MODE"] = "test"

    try:
        config = load_config(args.config)
        agent = resolve_agent(config["agent"])
    except ConfigError as e:
        print(f"safeship: {e}", file=sys.stderr)
        return 1

    if args.manifest:
        try:
            manifest = load_manifest_from_file(args.manifest)
        except (OSError, json.JSONDecodeError, ConfigError) as e:
            print(f"safeship: failed to load --manifest: {e}", file=sys.stderr)
            return 1
    else:
        api_key = os.environ.get("SAFESHIP_API_KEY")
        if not api_key:
            print(
                "safeship: SAFESHIP_API_KEY env var is not set. Either export it "
                "or pass --manifest <file> for a local run.",
                file=sys.stderr,
            )
            return 1
        endpoint = (
            args.endpoint or config.get("endpoint") or DEFAULT_ENDPOINT
        )
        try:
            manifest = fetch_manifest(api_key, endpoint)
        except (ConfigError, httpx.HTTPError) as e:
            print(f"safeship: {e}", file=sys.stderr)
            return 1

    results = run_all(manifest, agent)

    print(format_results(results))

    if args.results_json:
        # Serialize the captured_steps as-is — the Action reads this to
        # render the PR comment.
        payload = [_result_to_jsonable(r) for r in results]
        with open(args.results_json, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, default=str)

    failed = sum(1 for r in results if r.status == "failed")
    errored = sum(1 for r in results if r.status == "error")
    return 1 if (failed + errored) > 0 else 0


def _result_to_jsonable(r: TestRunResult) -> dict:
    d = asdict(r)
    # captured_steps contains arbitrary user data — let json.dump coerce
    # whatever it can via default=str.
    return d


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
