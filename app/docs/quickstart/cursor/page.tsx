import Link from "next/link";
import {
  Code,
  Mono,
  PasteIntoAI,
  QuickstartShell,
  Step,
} from "@/components/docs/QuickstartShell";

export const metadata = {
  title: "SafeShip quickstart for Cursor · SafeShip",
  description:
    "Cursor wrote your agent — now let it wire up SafeShip in three minutes flat.",
};

export default function CursorQuickstart() {
  return (
    <QuickstartShell
      platform="Cursor"
      tagline="Cursor wrote your agent. Now let it wire up SafeShip."
      estMinutes={3}
    >
      <Step n={1} title="Grab your SafeShip API key">
        <p>
          Sign in and open the{" "}
          <Link
            href="/app/onboarding"
            className="text-accent hover:text-[#d3ff85]"
          >
            Setup page
          </Link>
          . Copy the <Mono>sk_live_…</Mono> key. You&apos;ll paste it into
          Cursor in the next step.
        </p>
        <p className="text-[13.5px] text-fg-3">
          No account yet? Start the{" "}
          <Link
            href="/sign-up"
            className="text-accent hover:text-[#d3ff85]"
          >
            7-day free trial
          </Link>{" "}
          (card required, $0 charged if you cancel before day 7).
        </p>
      </Step>

      <Step n={2} title="Have Cursor do the wiring">
        <p>
          Open the agent file in Cursor (the Python file with your{" "}
          <Mono>agent</Mono> function — wherever the LLM call lives). Hit{" "}
          <Mono>⌘L</Mono> / <Mono>Ctrl+L</Mono> to open the chat panel, paste
          this prompt, and replace the key:
        </p>
        <PasteIntoAI
          toolName="Cursor chat"
          prompt={`Add SafeShip tracing to this agent.

1. pip-install: git+https://github.com/ego-debug/SafeShip.git#subdirectory=sdks/python
2. At module top, add: import safeship
3. Right after the imports, add: safeship.init(api_key="sk_live_REPLACE_ME")
4. Wrap the public agent callable with safeship.wrap() — don't change its signature.
5. For any custom tool calls in the agent (anything not via the Anthropic or OpenAI SDK), insert safeship.step(tool_name=..., kind="tool", input=..., output=..., duration_ms=..., status="ok") right after each call so the trace shows them as separate steps.
6. Don't add any try/except around SafeShip — the SDK never crashes the agent.

Show me the full diff before applying.`}
        />
        <p className="text-[13.5px] text-fg-3">
          Cursor will produce a diff. Anthropic and OpenAI SDK calls are
          captured automatically — you only need explicit{" "}
          <Mono>safeship.step()</Mono> calls for custom tools (database
          lookups, internal RPC, MCP, etc.).
        </p>
      </Step>

      <Step n={3} title="Run your agent once">
        <p>Run the agent normally:</p>
        <Code>{`python -m your_package.agent`}</Code>
        <p>
          As soon as the call returns, a trace lands on your{" "}
          <Link
            href="/app/dashboard"
            className="text-accent hover:text-[#d3ff85]"
          >
            dashboard
          </Link>
          . Open it — you should see one run, one or more steps. That&apos;s
          the green-trace moment.
        </p>
      </Step>

      <Step n={4} title="From here">
        <ul className="list-disc pl-5 [&>li]:mb-1.5">
          <li>
            <b className="text-fg">Block bad deploys</b> — wire up the
            SafeShip GitHub Action so your PRs fail when an accepted
            regression test would reproduce a known failure. See{" "}
            <Link
              href="/docs#ci"
              className="text-accent hover:text-[#d3ff85]"
            >
              the CI section of the main guide
            </Link>
            .
          </li>
          <li>
            <b className="text-fg">Get free CI replays</b> — set{" "}
            <Mono>SAFESHIP_REPLAY_LLM_CACHE=true</Mono> in your repo secrets
            and SafeShip will replay cached LLM responses instead of paying
            for live calls.{" "}
            <Link
              href="/docs#free-replay"
              className="text-accent hover:text-[#d3ff85]"
            >
              How it works →
            </Link>
          </li>
          <li>
            <b className="text-fg">Accept your first regression test</b> —
            when a run fails, the auto-suggest engine drafts a YAML test for
            it. One tap to add it to your suite.{" "}
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
