/** wrap() and step(): the core tracing surface. Mirrors the Python SDK:
 * - works for sync and async callables, preserving the signature
 * - agent errors re-throw untouched after a "fail" run is recorded
 * - if no explicit steps were recorded, synthesize one "agent" step
 * - tracing failures NEVER propagate into the agent path
 */

import { getConfig } from "./config.js";
import { currentContext, runWithContext, type RunContext, type StepRecord } from "./context.js";
import { safe } from "./safe.js";
import { enqueue } from "./transport.js";

export type StepOptions = {
  tool_name?: string | null;
  kind?: "llm" | "tool" | "retry" | null;
  input?: unknown;
  output?: unknown;
  duration_ms?: number | null;
  status?: "ok" | "warn" | "fail";
};

/** Manually append a step to the in-flight run. No-op outside wrap(). */
export function step(opts: StepOptions): void {
  try {
    const ctx = currentContext();
    if (!ctx) return;
    ctx.steps.push({
      tool_name: opts.tool_name ?? null,
      kind: opts.kind ?? null,
      input: safe(opts.input),
      output: safe(opts.output),
      duration_ms: typeof opts.duration_ms === "number" ? opts.duration_ms : null,
      status: opts.status ?? "ok",
    });
  } catch {
    // never crash the agent
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrap<F extends (...args: any[]) => any>(agent: F, name?: string): F {
  if (typeof agent !== "function") {
    throw new TypeError("safeship.wrap expects a function");
  }
  const label = name || agent.name || "agent";

  const wrapped = function (this: unknown, ...args: unknown[]): unknown {
    const ctx: RunContext = { steps: [] };
    const startedAt = new Date();
    const t0 = Date.now();

    return runWithContext(ctx, () => {
      let result: unknown;
      try {
        result = agent.apply(this, args);
      } catch (err) {
        emitRun(label, ctx.steps, startedAt, t0, args, null, err);
        throw err;
      }
      // Promise-returning agents: emit after settlement so duration and
      // async-recorded steps are complete. AsyncLocalStorage flows through
      // the awaits inside the agent, so step() keeps working.
      if (isThenable(result)) {
        return (result as Promise<unknown>).then(
          (value) => {
            emitRun(label, ctx.steps, startedAt, t0, args, value, null);
            return value;
          },
          (err) => {
            emitRun(label, ctx.steps, startedAt, t0, args, null, err);
            throw err;
          },
        );
      }
      emitRun(label, ctx.steps, startedAt, t0, args, result, null);
      return result;
    });
  };

  return wrapped as F;
}

function isThenable(v: unknown): boolean {
  return (
    v != null &&
    (typeof v === "object" || typeof v === "function") &&
    typeof (v as { then?: unknown }).then === "function"
  );
}

function emitRun(
  label: string,
  steps: StepRecord[],
  startedAt: Date,
  t0: number,
  args: unknown[],
  result: unknown,
  error: unknown,
): void {
  try {
    const cfg = getConfig();
    if (!cfg.enabled) return;

    const durationMs = Date.now() - t0;
    const failed = error != null;

    const finalSteps: StepRecord[] =
      steps.length > 0
        ? steps
        : [
            {
              tool_name: label,
              kind: "llm",
              input: safe({ args }),
              output: failed ? null : safe(result),
              duration_ms: durationMs,
              status: failed ? "fail" : "ok",
            },
          ];

    enqueue({
      run: {
        trigger: "production",
        score: null,
        status: failed ? "fail" : "ok",
        started_at: startedAt.toISOString(),
        duration_ms: durationMs,
        model: null,
      },
      steps: finalSteps,
    });
  } catch {
    // never let instrumentation errors reach the agent path
  }
}
