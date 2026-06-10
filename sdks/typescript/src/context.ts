/** Per-run async context so concurrent requests in one server process
 * never cross-contaminate each other's step lists. AsyncLocalStorage
 * propagates through awaits automatically (Node 18+). */

import { AsyncLocalStorage } from "node:async_hooks";

export type StepRecord = {
  tool_name: string | null;
  kind: string | null;
  input: unknown;
  output: unknown;
  duration_ms: number | null;
  status: string;
};

export type RunContext = {
  steps: StepRecord[];
};

const storage = new AsyncLocalStorage<RunContext>();

export function runWithContext<T>(ctx: RunContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentContext(): RunContext | undefined {
  return storage.getStore();
}
