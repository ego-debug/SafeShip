/** Core wrap()/step() behavior: payload shape matches the ingestion API
 * contract exactly ({ run: {...}, steps: [...] }, run metadata NESTED),
 * agent errors re-throw, tracing failures never crash the agent. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, init, shutdown, step, wrap } from "../src/index.js";

type CapturedRequest = { url: string; headers: Record<string, string>; body: any };

let captured: CapturedRequest[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  captured = [];
  fetchMock = vi.fn(async (url: any, init: any) => {
    captured.push({
      url: String(url),
      headers: Object.fromEntries(Object.entries(init?.headers ?? {})),
      body: JSON.parse(init?.body ?? "null"),
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  // autoInstrument false so the fetch mock sees ONLY transport traffic.
  init({ apiKey: "sk_live_test", endpoint: "https://ingest.test/v1/traces", autoInstrument: false });
});

afterEach(() => {
  shutdown();
  vi.unstubAllGlobals();
});

describe("wrap (sync)", () => {
  it("ships one run with nested run metadata and a synthesized step", async () => {
    const agent = wrap((q: string) => `echo:${q}`);
    expect(agent("hello")).toBe("echo:hello");
    await flush();

    expect(captured).toHaveLength(1);
    const { url, headers, body } = captured[0];
    expect(url).toBe("https://ingest.test/v1/traces");
    expect(headers.Authorization).toBe("Bearer sk_live_test");

    // The contract the server's lib/ingestion.ts enforces:
    expect(body.run).toBeTypeOf("object");
    expect(body.run.status).toBe("ok");
    expect(body.run.trigger).toBe("production");
    expect(typeof body.run.started_at).toBe("string");
    expect(Array.isArray(body.steps)).toBe(true);
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0].status).toBe("ok");
    expect(body.steps[0].output).toBe("echo:hello");
  });

  it("re-throws agent errors and records a fail run", async () => {
    const agent = wrap(() => {
      throw new Error("boom");
    });
    expect(() => agent()).toThrow("boom");
    await flush();

    expect(captured).toHaveLength(1);
    expect(captured[0].body.run.status).toBe("fail");
    expect(captured[0].body.steps[0].status).toBe("fail");
  });
});

describe("wrap (async)", () => {
  it("awaits settlement, records duration, returns the value", async () => {
    const agent = wrap(async (n: number) => {
      await new Promise((r) => setTimeout(r, 20));
      return n * 2;
    });
    await expect(agent(21)).resolves.toBe(42);
    await flush();

    expect(captured).toHaveLength(1);
    expect(captured[0].body.run.status).toBe("ok");
    expect(captured[0].body.run.duration_ms).toBeGreaterThanOrEqual(15);
  });

  it("records a fail run on rejection and re-rejects", async () => {
    const agent = wrap(async () => {
      throw new Error("async boom");
    });
    await expect(agent()).rejects.toThrow("async boom");
    await flush();
    expect(captured[0].body.run.status).toBe("fail");
  });
});

describe("step()", () => {
  it("explicit steps replace the synthesized one", async () => {
    const agent = wrap((q: string) => {
      step({ tool_name: "classify", kind: "llm", input: q, output: "intent", duration_ms: 5 });
      step({ tool_name: "lookup", kind: "tool", input: "intent", output: { id: 1 }, status: "ok" });
      return "done";
    });
    agent("question");
    await flush();

    const steps = captured[0].body.steps;
    expect(steps).toHaveLength(2);
    expect(steps[0].tool_name).toBe("classify");
    expect(steps[1].tool_name).toBe("lookup");
  });

  it("keeps working across awaits (AsyncLocalStorage flows)", async () => {
    const agent = wrap(async () => {
      step({ tool_name: "before_await" });
      await new Promise((r) => setTimeout(r, 5));
      step({ tool_name: "after_await" });
      return "ok";
    });
    await agent();
    await flush();

    const names = captured[0].body.steps.map((s: any) => s.tool_name);
    expect(names).toEqual(["before_await", "after_await"]);
  });

  it("is a silent no-op outside a wrapped invocation", () => {
    expect(() => step({ tool_name: "orphan" })).not.toThrow();
  });

  it("concurrent invocations don't cross-contaminate steps", async () => {
    const agent = wrap(async (label: string, delay: number) => {
      step({ tool_name: `${label}-1` });
      await new Promise((r) => setTimeout(r, delay));
      step({ tool_name: `${label}-2` });
      return label;
    });
    await Promise.all([agent("a", 25), agent("b", 5)]);
    await flush();

    expect(captured).toHaveLength(2);
    for (const req of captured) {
      const names = req.body.steps.map((s: any) => s.tool_name);
      const prefix = names[0][0];
      expect(names).toEqual([`${prefix}-1`, `${prefix}-2`]);
    }
  });
});

describe("reliability", () => {
  it("never crashes the agent when ingest is down", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const agent = wrap(() => "still fine");
    expect(agent()).toBe("still fine");
    await flush();
  });

  it("does not ship when disabled or missing apiKey", async () => {
    shutdown();
    init({ enabled: false, apiKey: "sk_live_x", autoInstrument: false });
    const agent = wrap(() => 1);
    agent();
    await flush();
    expect(captured).toHaveLength(0);
  });
});
