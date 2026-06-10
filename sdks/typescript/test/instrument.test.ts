/** Auto-instrumentation: provider calls made inside a wrapped agent are
 * recorded as steps; non-provider traffic and the customer's ability to
 * read response bodies are untouched. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, init, shutdown, wrap } from "../src/index.js";

let traceBodies: any[];
let fetchMock: ReturnType<typeof vi.fn>;

const ANTHROPIC_RESPONSE = {
  id: "msg_01",
  content: [{ type: "text", text: "hello from claude" }],
  usage: { input_tokens: 3, output_tokens: 5 },
};

beforeEach(() => {
  traceBodies = [];
  fetchMock = vi.fn(async (url: any, init?: any) => {
    const u = String(url instanceof Request ? url.url : url);
    if (u.includes("ingest.test")) {
      traceBodies.push(JSON.parse(init?.body ?? "null"));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (u.includes("api.anthropic.com")) {
      return new Response(JSON.stringify(ANTHROPIC_RESPONSE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("passthrough", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  // init AFTER stubbing so instrumentation wraps the mock.
  init({ apiKey: "sk_live_test", endpoint: "https://ingest.test/v1/traces" });
});

afterEach(() => {
  shutdown();
  vi.unstubAllGlobals();
});

describe("auto-instrumentation", () => {
  it("records an Anthropic call as an llm step with extracted text", async () => {
    const agent = wrap(async (q: string) => {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        body: JSON.stringify({ model: "claude-sonnet-4-6", messages: [{ role: "user", content: q }] }),
      });
      const data = (await resp.json()) as any; // body must still be readable
      return data.content[0].text;
    });

    await expect(agent("hi")).resolves.toBe("hello from claude");
    await flush();

    expect(traceBodies).toHaveLength(1);
    const steps = traceBodies[0].steps;
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe("llm");
    expect(steps[0].tool_name).toBe("claude-sonnet-4-6");
    expect(steps[0].output.text).toBe("hello from claude");
    expect(traceBodies[0].run.status).toBe("ok");
  });

  it("leaves non-provider traffic untouched and unrecorded", async () => {
    const agent = wrap(async () => {
      const r = await fetch("https://example.com/data");
      return r.text();
    });
    await expect(agent()).resolves.toBe("passthrough");
    await flush();

    // Only the synthesized agent step; the example.com call is invisible.
    expect(traceBodies[0].steps).toHaveLength(1);
    expect(traceBodies[0].steps[0].tool_name).toBe("agent");
  });

  it("provider calls outside a wrapped run pass through silently", async () => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      body: JSON.stringify({ model: "claude-sonnet-4-6" }),
    });
    expect(r.status).toBe(200);
    await flush();
    expect(traceBodies).toHaveLength(0);
  });

  it("autoInstrument: false leaves fetch unpatched", async () => {
    shutdown();
    const bare = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", bare);
    init({ apiKey: "sk_live_test", autoInstrument: false });
    expect(globalThis.fetch).toBe(bare);
  });
});
