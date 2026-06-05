import Link from "next/link";
import {
  Code,
  Mono,
  PasteIntoAI,
  QuickstartShell,
  Step,
} from "@/components/docs/QuickstartShell";

export const metadata = {
  title: "SafeShip quickstart for Claude Code · SafeShip",
  description:
    "Claude Code wrote your agent — give it one more prompt and SafeShip is live.",
};

export default function ClaudeCodeQuickstart() {
  return (
    <QuickstartShell
      platform="Claude Code"
      tagline="Claude Code wrote your agent. Give it one more prompt."
      estMinutes={3}
    >
      <Step n={1} title="Grab your SafeShip API key">
        <p>
          Open the{" "}
          <Link
            href="/app/onboarding"
            className="text-accent hover:text-[#d3ff85]"
          >
            Setup page
          </Link>{" "}
          and copy the <Mono>sk_live_…</Mono> key. Drop it into your{" "}
          <Mono>.env</Mono> as <Mono>SAFESHIP_API_KEY</Mono> — Claude Code
          picks it up from there.
        </p>
      </Step>

      <Step n={2} title="Hand the wiring to Claude Code">
        <p>
          In the project directory where your agent lives, start (or resume)
          a Claude Code session and paste this:
        </p>
        <PasteIntoAI
          toolName="Claude Code"
          prompt={`Wire up SafeShip tracing to this project.

1. Add this to pyproject.toml (or requirements.txt):
     safeship @ git+https://github.com/ego-debug/SafeShip.git#subdirectory=sdks/python
   Then install it.
2. Find the file that defines the public agent callable.
3. At the top, add: import safeship
4. Right after the env / config is loaded, add:
     safeship.init(api_key=os.environ["SAFESHIP_API_KEY"])
5. Wrap the public agent with safeship.wrap(). Preserve sync/async.
6. For every non-LLM tool call (DB, RPC, MCP, internal services),
   wrap the call site with safeship.step(tool_name=..., kind="tool",
   input=..., output=..., duration_ms=..., status="ok" or "fail").
   Anthropic and OpenAI SDK calls are captured automatically — leave them alone.
7. Add a CLAUDE.md note so future sessions know SafeShip is wired up
   and to use safeship.step() for any new tool calls.

Show me a single consolidated diff, then apply if I approve.`}
        />
        <p className="text-[13.5px] text-fg-3">
          Claude Code can also propose <Mono>safeship.yaml</Mono> for CI
          replay — ask it to in a follow-up if you want the GitHub Action
          wired in the same session.
        </p>
      </Step>

      <Step n={3} title="Verify with one run">
        <Code>{`python -m your_package.agent  # or however you invoke the agent`}</Code>
        <p>
          The trace should appear on{" "}
          <Link
            href="/app/dashboard"
            className="text-accent hover:text-[#d3ff85]"
          >
            your dashboard
          </Link>{" "}
          within a couple of seconds. If you see one run with the right step
          count, you&apos;re done.
        </p>
      </Step>

      <Step n={4} title="A CLAUDE.md snippet worth keeping">
        <p>
          Paste this into <Mono>CLAUDE.md</Mono> at the repo root so every
          future Claude Code session honors the SafeShip contract:
        </p>
        <Code>{`# SafeShip tracing

This project is wired with SafeShip. Rules for any agent-side changes:

- Never remove safeship.init() or safeship.wrap() — they're how production
  failures become regression tests.
- For new non-LLM tool calls (DB, RPC, MCP, internal services), wrap the
  call site with safeship.step(tool_name, kind="tool", input, output,
  duration_ms, status). Anthropic / OpenAI SDK calls are auto-captured;
  no manual step needed.
- When a regression test is accepted under /app/suggestions, keep the
  test_yaml stable — don't rewrite it casually. The CI replay uses it
  verbatim.
- The dashboard is at safeship.dev/app/dashboard. Failures show up there
  within seconds; the suggest queue is at /app/suggestions.`}</Code>
      </Step>

      <Step n={5} title="From here">
        <ul className="list-disc pl-5 [&>li]:mb-1.5">
          <li>
            <Link
              href="/docs#ci"
              className="text-accent hover:text-[#d3ff85]"
            >
              Block bad deploys with the GitHub Action →
            </Link>
          </li>
          <li>
            <Link
              href="/docs#free-replay"
              className="text-accent hover:text-[#d3ff85]"
            >
              Free CI replay with cached LLM responses →
            </Link>
          </li>
          <li>
            <Link
              href="/app/suggestions"
              className="text-accent hover:text-[#d3ff85]"
            >
              Accept your first regression test →
            </Link>
          </li>
        </ul>
      </Step>
    </QuickstartShell>
  );
}
