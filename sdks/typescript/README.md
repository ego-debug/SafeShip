# safeship · TypeScript SDK

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

> Every production failure becomes a regression test. The same bug never ships twice.

The TypeScript SDK for [SafeShip](https://safeship.dev): reliability for AI
agents. Drop in four lines, get a trace of every run on your dashboard,
accept one-tap regression tests when something breaks.

```ts
import { safeship } from "safeship";

safeship.init({ apiKey: process.env.SAFESHIP_API_KEY! });
const agent = safeship.wrap(myAgent);
```

Every call to `agent(...)` ships a trace. Tracing failures never crash
your agent.

## Install

npm publish is the last step on the checklist. Until it lands, install
from a checkout of this repo:

```bash
git clone https://github.com/ego-debug/SafeShip
cd SafeShip/sdks/typescript && npm install && npm run build
cd your-project && npm install ../SafeShip/sdks/typescript
```

After publish: `npm install safeship`.

Requires Node 18+ (global `fetch` and `AsyncLocalStorage`).

## What gets captured

### Automatically

`safeship.init()` patches `globalThis.fetch` so calls to supported LLM
providers are recorded as steps, with no per-call code:

- Anthropic (`api.anthropic.com`): the official `@anthropic-ai/sdk` and
  anything else that hits that host
- OpenAI (`api.openai.com`): the official `openai` package and equivalents

Request and response bodies are captured for normal JSON responses; for
streaming (SSE) responses the step is recorded with the request but the
body is marked as streaming, never consumed. All other traffic passes
through untouched. Opt out with `init({ autoInstrument: false })` or
`SAFESHIP_AUTO_INSTRUMENT=false`.

### Manually

For tool calls that aren't HTTP requests to a known provider (database,
internal RPC, MCP), record a step where the work happens:

```ts
import { safeship } from "safeship";

const agent = safeship.wrap(async (message: string) => {
  const intent = await classify(message);
  safeship.step({ tool_name: "classify", kind: "llm",
                  input: message, output: intent, status: "ok" });

  const order = await lookupOrder(intent);
  safeship.step({ tool_name: "lookup_order", kind: "tool",
                  input: intent, output: order, status: "ok" });

  return draftReply(order);
});
```

If the agent throws, the wrapper records a failed run and re-throws.
Concurrent invocations are isolated via `AsyncLocalStorage`, so steps
from overlapping requests never mix.

## Serverless (Vercel, Lambda)

Trace delivery is fire-and-forget. Serverless runtimes can freeze the
process the moment your handler returns, so flush before returning:

```ts
export async function POST(req: Request) {
  const reply = await agent(await req.text());
  await safeship.flush(); // or hand safeship.flush() to waitUntil
  return Response.json({ reply });
}
```

## Configuration

| Option | Env var | Default | What |
|---|---|---|---|
| `apiKey` | `SAFESHIP_API_KEY` | — | Project key, looks like `sk_live_*` |
| `endpoint` | `SAFESHIP_ENDPOINT` | `https://www.safeship.dev/v1/traces` | Ingest URL |
| `timeoutMs` | — | `10000` | Per-delivery timeout (never blocks the agent) |
| `debug` | — | `false` | Log dropped traces via `console.warn` |
| `enabled` | — | `true` | Set `false` in tests |
| `autoInstrument` | `SAFESHIP_AUTO_INSTRUMENT` | `true` | Auto-record LLM fetch calls |

## Reliability guarantees

Verified by the test suite (`npm test`):

- **Never crashes your agent.** Every internal error is caught; `debug: true` logs them.
- **Never blocks.** Delivery runs in the background; the wrapped call returns when your agent returns.
- **No extra LLM calls.** The SDK never re-prompts your model.
- **Survives ingest failures.** 5xx/429 retried with backoff; permanent 4xx dropped.

## CI replay

Regression-test replay in CI (`safeship test`) currently runs through the
[Python CLI](../python) and supports Python agents. TypeScript agents get
deploy gating today via the GitHub Action's score-gate mode, which is
language-agnostic. TS-native replay is on the roadmap.

## Local development

```bash
cd sdks/typescript
npm install
npm test          # vitest, no network
npm run build     # dist/ via tsup (ESM + CJS + types)
node test/integration-local.mjs 3000   # optional: against a running dev server
```

## License

MIT — see [LICENSE](./LICENSE).
