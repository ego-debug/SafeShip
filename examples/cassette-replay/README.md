# Cassette-replay demo

Proves the SafeShip free-CI-replay feature works end-to-end with **no
network, no API keys, no SafeShip account**. Two minutes start to finish.

## What this shows

An agent makes one real-shaped Anthropic API call. Under `safeship test`,
SafeShip's auto-instrument transport intercepts that call and returns a
cached response straight from the manifest in this directory. The agent
never reaches Anthropic. The YAML assertion in the manifest checks that
the cached output appears in the agent's return value — if cassette
replay is working, the assertion passes; if it isn't, the agent would
401 from Anthropic and the test would fail.

This is the loop that lets paying SafeShip customers run regression
tests in CI without paying for LLM calls.

## What's in this directory

| File | What it is |
| --- | --- |
| `demo_agent.py` | A tiny agent. Makes one POST to `api.anthropic.com/v1/messages` using a bogus key. Returns the assistant text from the response. |
| `safeship.yaml` | Tells `safeship test` which callable to invoke (`demo_agent:agent`) and to use `cached_only` replay mode (any cache miss is a hard failure — no fallback to live). |
| `manifest.json` | One pre-built regression test. Contains the YAML assertion plus a `cached_llm_calls` entry with the canonical request hash and the response bytes. |
| `build_manifest.py` | Regenerates `manifest.json`. You only need this if you change the request body in `demo_agent.py` — the hash has to match exactly. |

## Run it

### 1. Install the SDK (editable, from this repo)

From the repo root:

```bash
pip install -e ./sdks/python
```

### 2. Run the test

```bash
cd examples/cassette-replay
SAFESHIP_REPLAY_LLM_CACHE=true safeship test --manifest manifest.json
```

Expected output:

```
  [PASS] demo.cassette_replay_returns_cached_text
  1 passed · 0 failed · 0 skipped · 0 errored (total: 1)
```

The `--manifest manifest.json` flag points the runner at the local file
in this directory. Without it, `safeship test` tries to fetch the manifest
from the SafeShip server and needs `SAFESHIP_API_KEY` set — which defeats
the point of an offline demo.

That's it. The agent executed, made the Anthropic POST, the transport
matched the request hash against the manifest, returned the cached
response, and the assertion passed. Zero network. Zero LLM cost.

## Try breaking it

To convince yourself the cassette is actually doing the work (not some
mocked-out path):

1. **Unset** `SAFESHIP_REPLAY_LLM_CACHE` and re-run
   `safeship test --manifest manifest.json`. The replay-from-cache code
   path is now gated off entirely; the SDK falls back to live calls. The
   bogus API key in `demo_agent.py` gets a real 401 from Anthropic and
   the test fails with the upstream HTTP error.
2. **Edit the prompt** in `demo_agent.py` (e.g. change `"hello"` to
   `"hi"`). Re-run. The request hash no longer matches the cassette. With
   `replay_mode: cached_only`, the cache miss is a hard failure. Run
   `python build_manifest.py` to regenerate the manifest.

Both failures are the system working as intended: cassettes are tightly
matched against the canonical request hash, so a real customer can't
silently get stale cached responses through a refactor.

## How the match works

```
canonical_hash(body) = sha256(json.dumps(json.loads(body), sort_keys=True,
                                        separators=(",", ":")).encode())
```

Keys are sorted, whitespace is stripped, then SHA-256. Two structurally
identical request bodies hash to the same value even if the literal byte
order differs — so a JSON serializer change doesn't break a hit. A
*semantic* change (different prompt, different model, different tool
definitions) always misses.

Cursor walking lets multi-call agents add or skip non-LLM steps between
LLM calls without breaking replay: the SDK matches the Nth recorded LLM
call against the Nth replay call, in order, not by absolute step index.
See [`../../docs/decisions/`](../../docs/decisions/) for the full design
notes.
