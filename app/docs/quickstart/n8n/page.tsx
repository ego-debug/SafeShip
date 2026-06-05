import Link from "next/link";
import {
  Code,
  Mono,
  QuickstartShell,
  Step,
} from "@/components/docs/QuickstartShell";

export const metadata = {
  title: "SafeShip quickstart for n8n · SafeShip",
  description:
    "Wrap your n8n AI Agent node with a SafeShip trace in five minutes — no code changes to the workflow.",
};

export default function N8nQuickstart() {
  return (
    <QuickstartShell
      platform="n8n"
      tagline="Wrap your n8n AI Agent node with a SafeShip trace."
      estMinutes={5}
    >
      <Step n={1} title="The shape of the integration">
        <p>
          n8n is a visual workflow editor — there&apos;s no Python file to
          drop SafeShip into. Instead, you add a{" "}
          <b className="text-fg">Code node</b> right after your AI Agent
          node that POSTs the agent&apos;s input/output to SafeShip&apos;s{" "}
          <Mono>/v1/traces</Mono> endpoint. One node, one HTTP call, no
          extra plumbing.
        </p>
        <p className="text-[13.5px] text-fg-3">
          A native n8n SafeShip node is on the roadmap. For now, a Code
          node is the cleanest integration — and it stays declarative inside
          the n8n editor.
        </p>
      </Step>

      <Step n={2} title="Grab your key and add it as a credential">
        <p>
          Copy the <Mono>sk_live_…</Mono> key from the{" "}
          <Link
            href="/app/onboarding"
            className="text-accent hover:text-[#d3ff85]"
          >
            Setup page
          </Link>
          . In n8n, open{" "}
          <b className="text-fg">
            Credentials → New → HTTP Request (Header Auth)
          </b>
          . Set:
        </p>
        <ul className="list-disc pl-5 text-[14px] [&>li]:mb-1">
          <li>
            Name: <Mono>SafeShip</Mono>
          </li>
          <li>
            Header name: <Mono>Authorization</Mono>
          </li>
          <li>
            Header value: <Mono>Bearer sk_live_…</Mono>
          </li>
        </ul>
        <p>Save. Now every node that wants to call SafeShip can reuse it.</p>
      </Step>

      <Step n={3} title="Drop a Code node after your AI Agent">
        <p>
          In the workflow, add a <b className="text-fg">Code node</b>{" "}
          immediately downstream of your <b className="text-fg">AI Agent</b>{" "}
          node. Set it to <Mono>Run Once for All Items</Mono>. Paste:
        </p>
        <Code>{`// SafeShip — record an AI Agent run as a trace.
// Place this Code node right after your AI Agent node.

const runStart = $node["AI Agent"].context?.startedAt ?? Date.now();
const runEnd = Date.now();
const items = $input.all();
const first = items[0]?.json ?? {};

const payload = {
  trigger: "n8n",
  status: first.error ? "fail" : "ok",
  model: first.model ?? null,
  duration_ms: runEnd - runStart,
  steps: [
    {
      step_index: 0,
      tool_name: "ai_agent",
      kind: "llm",
      input: first.input ?? first.prompt ?? null,
      output: first.output ?? first.response ?? null,
      duration_ms: runEnd - runStart,
      status: first.error ? "fail" : "ok",
    },
  ],
};

await this.helpers.httpRequest({
  method: "POST",
  url: "https://safeship.dev/v1/traces",
  headers: {
    Authorization: "Bearer " + $credentials.safeship.value,
    "Content-Type": "application/json",
  },
  body: payload,
  json: true,
});

return items; // pass the AI Agent output through unchanged`}</Code>
        <p className="text-[13.5px] text-fg-3">
          Adjust the input/output field names if your AI Agent node uses
          custom output keys. The node passes items through unchanged, so
          you can chain anything downstream as normal.
        </p>
      </Step>

      <Step n={4} title="Run the workflow once">
        <p>
          Hit <b className="text-fg">Execute Workflow</b> with a test input.
          A trace lands on{" "}
          <Link
            href="/app/dashboard"
            className="text-accent hover:text-[#d3ff85]"
          >
            your dashboard
          </Link>{" "}
          within a couple of seconds. Open it — you should see one run with
          the AI Agent step. That&apos;s the green-trace moment.
        </p>
      </Step>

      <Step n={5} title="From here">
        <ul className="list-disc pl-5 [&>li]:mb-1.5">
          <li>
            <b className="text-fg">Record individual tool calls</b> — if
            your AI Agent uses n8n Tool nodes (HTTP, Postgres, etc.), add
            a Code node after each one and append a step to the trace
            instead of replacing it. SafeShip&apos;s auto-suggest engine
            uses per-step inputs/outputs to write tighter assertions.
          </li>
          <li>
            <b className="text-fg">Block bad deploys</b> — if your workflow
            ships through n8n&apos;s Git integration or via CI, the
            SafeShip Action works on the repo side.{" "}
            <Link
              href="/docs#ci"
              className="text-accent hover:text-[#d3ff85]"
            >
              See the CI section →
            </Link>
          </li>
          <li>
            <b className="text-fg">Accept your first test</b> — when the
            agent fails in production, SafeShip drafts a regression test.{" "}
            <Link
              href="/app/suggestions"
              className="text-accent hover:text-[#d3ff85]"
            >
              Open the queue →
            </Link>
          </li>
        </ul>
      </Step>
    </QuickstartShell>
  );
}
