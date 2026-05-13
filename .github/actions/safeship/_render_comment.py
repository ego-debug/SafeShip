"""Render a SafeShip regression-test results JSON file into a markdown
PR-comment body. Called by the SafeShip GitHub Action's pr-comment step.

Usage:
    python _render_comment.py <results.json>

Reads the JSON written by `safeship test --results-json`, emits the
markdown to stdout. Stable HTML marker on the first line so the Action
can find + update an existing comment instead of stacking on every run.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Force UTF-8 stdout so emoji status icons survive Windows cp1252 consoles.
# GitHub Linux runners are already UTF-8; this is for local + Windows testing.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

MARKER = "<!-- safeship:results -->"
ICONS = {"passed": "✅", "failed": "❌", "skipped": "⏭️", "error": "⚠️"}


def render(results: list[dict]) -> str:
    counts = {"passed": 0, "failed": 0, "skipped": 0, "error": 0}
    for r in results:
        s = str(r.get("status", "error"))
        counts[s] = counts.get(s, 0) + 1
    total = len(results)

    lines: list[str] = [
        MARKER,
        "## SafeShip regression check",
        "",
        (
            f"**{counts['passed']} passed · "
            f"{counts['failed']} failed · "
            f"{counts['skipped']} skipped · "
            f"{counts['error']} errored** "
            f"(total: {total})"
        ),
        "",
        "| | Test | Outcome |",
        "|--|--|--|",
    ]
    for r in results:
        status = str(r.get("status", "error"))
        name = str(r.get("name", "?"))
        reason = str(r.get("reason", "")).replace("|", "\\|")
        lines.append(f"| {ICONS.get(status, '?')} | `{name}` | {reason} |")

    if counts["failed"] or counts["error"]:
        lines.extend(
            [
                "",
                (
                    "> A failing regression means this PR would reproduce a bug "
                    "SafeShip has already caught in production. Investigate the "
                    "failing assertion before merging."
                ),
            ]
        )
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: _render_comment.py <results.json>", file=sys.stderr)
        return 2
    path = Path(argv[1])
    if not path.is_file():
        print(f"results file not found: {path}", file=sys.stderr)
        return 2
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"invalid JSON in {path}: {e}", file=sys.stderr)
        return 2
    if not isinstance(data, list):
        print(f"expected a JSON array in {path}, got {type(data).__name__}", file=sys.stderr)
        return 2
    print(render(data))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
