# Contributing to SafeShip

Solo founder project, contributions welcome. Two paths: SDK fixes (low
ceremony) and webapp / engine changes (a bit more). Both are documented
below.

## Code of conduct

Be decent. Disagree with code, not with people.

## Python SDK (`sdks/python/`)

The SDK is the most welcoming surface for contributions — small,
focused, no external state.

### Dev loop

```bash
git clone https://github.com/ego-debug/SafeShip
cd SafeShip/sdks/python
pip install -e ".[dev]"
pytest -q
ruff check safeship tests
```

CI runs against Python 3.9, 3.11, and 3.12 on every push. Stay
compatible with 3.9 (`from __future__ import annotations` for PEP 604
union syntax). If you add a new test that needs `respx`, it's already
in the dev extras.

### Style

- `ruff check safeship tests` must pass. Line length 100, import sorted.
- `from __future__ import annotations` at the top of every new module.
- Public API additions to `safeship/__init__.py` need a docstring and
  a passing test.
- The SDK **never crashes the customer's agent**. New code paths that
  could raise must be wrapped in `try/except` with logging behind
  `debug=True`. There are pytest assertions that verify this; see
  `tests/test_reliability.py` for examples.

### What's easy to land

- A new auto-instrument provider parser under
  `safeship/_providers/<provider>.py`. Mirror the shape of
  `anthropic.py` or `openai.py`. Add a unit test that mocks the
  provider's HTTP host with `respx` and checks the recorded step shape.
- Extra assertion primitives in `safeship/_assertions.py`. Keep the
  YAML DSL surface small — anything you add gets a worked example in
  `evals/suggest/failure-types.md` so the suggest engine knows when to
  emit it.
- Reliability tests: edge cases where the SDK should *not* crash the
  agent. We're happy with redundant coverage here.

### What's hard to land

- API changes to `safeship.init()` / `safeship.wrap()` signatures. Open
  an issue first; we'd rather discuss before you write code.
- Anything that adds a runtime dependency. The SDK's footprint is
  `httpx`, `PyYAML`, `simpleeval` — additions need a real reason.

## Webapp (Next.js, top-level)

The webapp is `Next.js 14 App Router` + Tailwind + Supabase + Clerk +
Stripe. See `README.md` and `CLAUDE.md` at the repo root for the
product brief and stack overview.

### Dev loop

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase + Clerk + Stripe
npm run db:push                    # apply schema
npm run dev                        # http://localhost:3000
npm run typecheck                  # tsc --noEmit
```

### Style

- TypeScript strict, no `any` without a `// why:` comment.
- App Router only — no Pages Router.
- Server Components by default; mark Client Components with
  `"use client"` only when interactivity demands it.
- Tailwind only — no separate CSS files except the global reset.
- Server actions for mutations; API routes for SDK ingestion only.

## Examples (`examples/`)

If you've built a working integration with a framework or platform we
don't have a demo for yet, drop it under `examples/<name>/` with a
README explaining how to run it. The cassette-replay demo is the
template — short, runnable without secrets, with an explicit "try
breaking it" section so reviewers can verify it's not faking.

## Reporting bugs

GitHub Issues at <https://github.com/ego-debug/SafeShip/issues>. Include:
- What you tried.
- What you expected.
- What actually happened.
- A minimal reproduction (a 5-line script beats a paragraph of
  description).

Security issues: email <founder@safeship.dev> instead of opening a
public issue. See `/security` on the website for the disclosure policy.

## Signing your commits

Not required, but appreciated. Co-author trailers (`Co-authored-by:
Name <email>`) are great for credit when multiple people work on a
change.

## License

By contributing, you agree your contributions are licensed under the
MIT License — same terms as the rest of the project. See
[`LICENSE`](./LICENSE).
