import Link from "next/link";
import {
  Code,
  Mono,
  PasteIntoAI,
  QuickstartShell,
  Step,
} from "@/components/docs/QuickstartShell";

export const metadata = {
  title: "SafeShip quickstart for Lovable · SafeShip",
  description:
    "Lovable generated your AI app. Three messages later, SafeShip is tracing every run.",
};

export default function LovableQuickstart() {
  return (
    <QuickstartShell
      platform="Lovable"
      tagline="Lovable generated your AI app. Three messages later, you're tracing."
      estMinutes={4}
    >
      <Step n={1} title="Find your AI endpoint">
        <p>
          Lovable apps usually expose the agent through a single API route —
          something like <Mono>/api/chat</Mono>, <Mono>/api/agent</Mono>, or
          a Server Action that calls the LLM provider. Open your project in
          Lovable and locate that file. (Ask Lovable &quot;which file
          handles my AI requests?&quot; if you&apos;re not sure.)
        </p>
      </Step>

      <Step n={2} title="Grab your SafeShip key">
        <p>
          From the{" "}
          <Link
            href="/app/onboarding"
            className="text-accent hover:text-[#d3ff85]"
          >
            Setup page
          </Link>
          , copy the <Mono>sk_live_…</Mono> key. In Lovable, open{" "}
          <b className="text-fg">Project → Environment Variables</b> and add{" "}
          <Mono>SAFESHIP_API_KEY</Mono>. Save.
        </p>
      </Step>

      <Step n={3} title="Ask Lovable to wire it in">
        <p>
          Paste this into Lovable&apos;s chat (the build prompt at the
          bottom of the editor):
        </p>
        <PasteIntoAI
          toolName="Lovable chat"
          prompt={`Add SafeShip tracing to my AI route.

1. Install the npm package: safeship (TypeScript SDK).
2. In the API route that calls the LLM provider (the file with the
   OpenAI or Anthropic SDK call), import: import { safeship } from "safeship".
3. At module scope, call: safeship.init({ apiKey: process.env.SAFESHIP_API_KEY! }).
4. Wrap the handler function with safeship.wrap() — preserve the
   request and response signatures.
5. For each non-LLM step the route performs (database query,
   external fetch, embedding lookup), insert a safeship.step() call
   recording tool_name, kind="tool", input, output, duration_ms, and
   status. Provider SDK calls (OpenAI / Anthropic) are captured
   automatically — leave them.
6. Keep the handler's response shape exactly the same.

Show me the updated route file as a single block.`}
        />
        <p className="text-[13.5px] text-fg-3">
          The TypeScript SDK lands on npm shortly — until then, Lovable may
          need to add the GitHub URL{" "}
          <Mono>
            github:ego-debug/SafeShip&#123;sdks/typescript&#125;
          </Mono>{" "}
          to <Mono>package.json</Mono>. If you hit an install error, ask
          Lovable to use the Python SDK on a serverless function instead —
          link the{" "}
          <Link
            href="/docs#install"
            className="text-accent hover:text-[#d3ff85]"
          >
            main install guide
          </Link>{" "}
          and paste it in.
        </p>
      </Step>

      <Step n={4} title="Trigger one chat to verify">
        <p>
          Hit your deployed app and send one message through the AI. Within
          a few seconds, the trace appears on{" "}
          <Link
            href="/app/dashboard"
            className="text-accent hover:text-[#d3ff85]"
          >
            your dashboard
          </Link>
          . If it shows the LLM call as a step and any DB / fetch calls you
          recorded, you&apos;re live.
        </p>
        <Code>{`# tail your Lovable logs while testing
# you should NOT see SafeShip-related errors — the SDK is fire-and-forget
# and never crashes the request even if our ingest is unreachable.`}</Code>
      </Step>

      <Step n={5} title="From here">
        <ul className="list-disc pl-5 [&>li]:mb-1.5">
          <li>
            <b className="text-fg">Block bad deploys</b> — Lovable pushes
            to GitHub for you. Add the SafeShip Action to your repo and
            failed regression tests will block PR merges.{" "}
            <Link
              href="/docs#ci"
              className="text-accent hover:text-[#d3ff85]"
            >
              How to wire it →
            </Link>
          </li>
          <li>
            <b className="text-fg">Accept your first test</b> — when the
            agent fails in front of a user, SafeShip drafts a YAML
            assertion. One tap and it&apos;s in your suite.{" "}
            <Link
              href="/app/suggestions"
              className="text-accent hover:text-[#d3ff85]"
            >
              Open the queue →
            </Link>
          </li>
          <li>
            <b className="text-fg">Empty queue?</b> That&apos;s normal —
            it fills the moment a real failure lands. Send a synthetic
            failure to see the UI work:{" "}
            <Link
              href="/app/onboarding"
              className="text-accent hover:text-[#d3ff85]"
            >
              Setup → Send us a test trace
            </Link>
            .
          </li>
        </ul>
      </Step>
    </QuickstartShell>
  );
}
