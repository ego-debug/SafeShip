import Link from "next/link";
import { Background } from "@/components/Background";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Setup guide · SafeShip",
  description:
    "Install the SafeShip SDK and get your first regression test in 5 minutes.",
};

export default function DocsPage() {
  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />

        <main className="grid grid-cols-1 gap-10 py-16 lg:grid-cols-[1fr_220px]">
          <article className="flex flex-col gap-10">
            <header className="flex flex-col gap-3">
              <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                  style={{ boxShadow: "0 0 8px rgba(194,249,112,0.6)" }}
                />
                Setup guide
              </span>
              <h1 className="text-[clamp(32px,4vw,48px)] font-semibold leading-[1.05] tracking-[-0.03em] [text-wrap:balance]">
                From install to first regression test in five minutes.
              </h1>
              <p className="text-lg text-fg-2">
                SafeShip drops into your agent code via a 4-line SDK. Below is
                everything you need to ship your first trace, see it on the
                dashboard, and accept your first auto-generated regression
                test.
              </p>
            </header>

            <Section id="prereqs" title="Before you start">
              <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
                <li>
                  A SafeShip account — create one at{" "}
                  <Link
                    href="/sign-up"
                    className="text-accent hover:text-[#d3ff85]"
                  >
                    safeship.dev/sign-up
                  </Link>{" "}
                  and start your 7-day free trial (see below)
                </li>
                <li>
                  Your API key (looks like <Mono>sk_live_…</Mono>) — find it on
                  the{" "}
                  <Link
                    href="/app/onboarding"
                    className="text-accent hover:text-[#d3ff85]"
                  >
                    Setup page
                  </Link>{" "}
                  inside the app
                </li>
                <li>A Python 3.9+ project where your AI agent runs</li>
              </ul>
            </Section>

            <Section id="billing" title="Billing & free trial">
              <p className="mb-3 text-fg-2">
                SafeShip is <b className="text-fg">$29.99 / month</b>, flat, no
                seats. There&apos;s one plan and a 7-day free trial.
              </p>
              <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
                <li>
                  <b className="text-fg">Card required upfront.</b> Stripe
                  holds your card but doesn&apos;t charge for 7 days.
                </li>
                <li>
                  <b className="text-fg">Cancel before day 7 = $0 charged.</b>{" "}
                  Cancel anytime from the customer portal — no email, no
                  retention loop.
                </li>
                <li>
                  <b className="text-fg">After 7 days</b>, your card is
                  auto-charged $29.99/mo. Cancel anytime — you keep access until
                  the current period ends. No refunds for partial months.
                </li>
                <li>
                  Manage your subscription at{" "}
                  <Link
                    href="/app/billing"
                    className="text-accent hover:text-[#d3ff85]"
                  >
                    /app/billing
                  </Link>{" "}
                  — update card, see invoices, or cancel from the Stripe
                  customer portal.
                </li>
              </ul>
              <p className="mt-3 text-[13.5px] text-fg-3">
                You can&apos;t access <Mono>/app/*</Mono> until your card is on
                file. We don&apos;t take payment details by phone or email —
                only through the Stripe checkout link inside the app.
              </p>
            </Section>

            <Section id="install" title="1 — Install the SDK">
              <p className="mb-3 text-fg-2">
                During beta, install directly from our GitHub:
              </p>
              <CodeBlock>
                {`pip install "git+https://github.com/ego-debug/SafeShip.git#subdirectory=sdks/python"`}
              </CodeBlock>
              <p className="mt-3 text-[13.5px] text-fg-3">
                We&apos;ll publish to PyPI as <Mono>pip install safeship</Mono>{" "}
                once the SDK is stable. For now, the GitHub install is the
                recommended path.
              </p>
            </Section>

            <Section id="wrap" title="2 — Initialize and wrap your agent">
              <p className="mb-3 text-fg-2">
                In your agent code, call <Mono>safeship.init()</Mono> once at
                startup, then wrap your agent callable with{" "}
                <Mono>safeship.wrap()</Mono>:
              </p>
              <CodeBlock>{`import safeship

safeship.init(api_key="sk_live_...")  # paste your key here
agent = safeship.wrap(my_agent)        # wraps any callable

# now call your agent normally — every run ships a trace
result = agent("user message here")`}</CodeBlock>
              <p className="mt-3 text-fg-2">
                That&apos;s it. Every call to <Mono>agent(...)</Mono> ships a
                trace to your dashboard from a background daemon thread —{" "}
                <b className="text-fg">never blocks your code</b>,{" "}
                <b className="text-fg">never crashes your agent</b> if our
                ingest is down.
              </p>
            </Section>

            <Section id="steps" title="3 — (Optional) Record sub-steps">
              <p className="mb-3 text-fg-2">
                By default, each wrapped call produces one trace with one
                step (the agent itself). To get richer step-by-step traces,
                drop <Mono>safeship.step(...)</Mono> calls inside your agent:
              </p>
              <CodeBlock>{`def my_agent(message: str) -> str:
    intent = classify(message)
    safeship.step(tool_name="classify_intent", kind="llm",
                  input=message, output=intent,
                  duration_ms=140, status="ok")

    order = lookup_order(intent)
    safeship.step(tool_name="lookup_order", kind="tool",
                  input=intent, output=order,
                  duration_ms=320, status="ok")

    return draft_reply(order)`}</CodeBlock>
              <p className="mt-3 text-fg-2">
                Each step shows up as a row in the Trace Detail timeline. Set
                <Mono>status=&quot;fail&quot;</Mono> on the step that broke and
                SafeShip&apos;s auto-suggest engine will write a regression
                test targeting it.
              </p>
            </Section>

            <Section id="view" title="4 — See your traces and accept tests">
              <ol className="list-decimal pl-5 text-fg-2 [&>li]:mb-2">
                <li>
                  Open{" "}
                  <Link
                    href="/app/dashboard"
                    className="text-accent hover:text-[#d3ff85]"
                  >
                    your dashboard
                  </Link>{" "}
                  — every run your agent does appears in the &quot;Recent
                  runs&quot; panel within seconds.
                </li>
                <li>
                  Click <b className="text-fg">View trace →</b> on any run to
                  see the step-by-step timeline.
                </li>
                <li>
                  On a failed run, click{" "}
                  <b className="text-fg">
                    ✓ Suggest a regression test
                  </b>{" "}
                  at the bottom of the page. Claude reads the trace and
                  proposes a YAML assertion that would have caught the
                  failure.
                </li>
                <li>
                  Review the suggestion at{" "}
                  <Link
                    href="/app/suggestions"
                    className="text-accent hover:text-[#d3ff85]"
                  >
                    /app/suggestions
                  </Link>
                  . Press <Kbd>Y</Kbd> to accept (lands in your regression
                  suite) or <Kbd>N</Kbd> to skip.
                </li>
              </ol>
            </Section>

            <Section id="ci" title="5 — Block bad deploys (GitHub Action)">
              <p className="mb-3 text-fg-2">
                SafeShip ships a GitHub Action that runs on every PR. By
                default (<Mono>mode: auto</Mono>) it picks one of two
                strategies based on whether you have a{" "}
                <Mono>safeship.yaml</Mono> at your repo root.
              </p>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                Test mode (recommended)
              </h3>
              <p className="mb-3 text-fg-2">
                Every accepted regression test is replayed against your new
                code in CI. If any test would reproduce a previously-caught
                failure, the PR fails. Add a <Mono>safeship.yaml</Mono> at
                the repo root pointing at your agent entry point:
              </p>
              <CodeBlock language="yaml">{`# safeship.yaml — declare which function the test runner should call
agent: src.my_agent:run`}</CodeBlock>
              <p className="mb-3 mt-3 text-fg-2">
                Then add the Action to your workflow:
              </p>
              <CodeBlock language="yaml">{`# .github/workflows/safeship.yml
name: SafeShip
on: pull_request
permissions:
  contents: read
  pull-requests: write    # optional, enables the inline PR comment
jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install -e .       # install your agent's deps
      - uses: ego-debug/SafeShip/.github/actions/safeship@main
        with:
          api-key: \${{ secrets.SAFESHIP_API_KEY }}`}</CodeBlock>
              <p className="mt-3 text-[13.5px] text-fg-3">
                Your workflow is responsible for setting up Python and
                installing your agent&apos;s dependencies — the SafeShip
                action installs only the SafeShip SDK on top, then runs{" "}
                <Mono>safeship test</Mono>. Each replayed test re-invokes
                your agent with real LLM calls; budget roughly{" "}
                <b className="text-fg">$0.05–$0.30 per accepted test per PR
                run</b>, depending on how chatty your agent is. Cancellable
                tests run in parallel-safe isolated steps so a flake on one
                test doesn&apos;t cascade.
              </p>

              <h3 className="mb-2 mt-6 text-[15.5px] font-semibold text-fg">
                Score-gate mode (simpler, ambient)
              </h3>
              <p className="mb-3 text-fg-2">
                If you&apos;d rather monitor average production quality than
                replay specific failures pre-deploy, omit the{" "}
                <Mono>safeship.yaml</Mono> (or set{" "}
                <Mono>mode: score-gate</Mono> explicitly). The Action then
                calls SafeShip&apos;s{" "}
                <Mono>/v1/runs/check</Mono> endpoint and fails the PR if
                your latest production run scored below the threshold:
              </p>
              <CodeBlock language="yaml">{`- uses: ego-debug/SafeShip/.github/actions/safeship@main
  with:
    api-key: \${{ secrets.SAFESHIP_API_KEY }}
    mode: score-gate
    min-score: 80`}</CodeBlock>
              <p className="mt-3 text-[13.5px] text-fg-3">
                Lighter setup, but catches regressions{" "}
                <i>after</i> they ship to production. Test mode catches them
                before they merge. You can keep score-gate as a fallback
                signal even if you adopt test mode later.
              </p>

              <p className="mt-5 text-[13.5px] text-fg-3">
                Store your <Mono>sk_live_…</Mono> key as a repo secret named{" "}
                <Mono>SAFESHIP_API_KEY</Mono>. Full input reference:{" "}
                <a
                  href="https://github.com/ego-debug/SafeShip/blob/main/.github/actions/safeship/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-[#d3ff85]"
                >
                  Action README →
                </a>
              </p>
            </Section>

            <Section id="branch-protection" title="6 — Make the red check actually block the merge">
              <p className="mb-3 text-fg-2">
                By default, GitHub <i>shows</i> failed status checks on a
                PR but doesn&apos;t prevent the merge button from being
                clicked. To actually <b className="text-fg">block</b> a PR
                from merging when SafeShip&apos;s check is red, enable a
                branch protection rule (or ruleset) for your default
                branch and require the SafeShip check.
              </p>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                Option A — Branch protection rule (classic, available on all plans)
              </h3>
              <ol className="list-decimal pl-5 text-fg-2 [&>li]:mb-1.5">
                <li>
                  Go to{" "}
                  <b className="text-fg">
                    repo Settings → Branches → Branch protection rules →
                    Add rule
                  </b>
                  .
                </li>
                <li>
                  In <b className="text-fg">Branch name pattern</b>, enter{" "}
                  <Mono>main</Mono> (or whatever your default branch is).
                </li>
                <li>
                  Tick{" "}
                  <b className="text-fg">
                    Require status checks to pass before merging
                  </b>
                  .
                </li>
                <li>
                  In the search box that appears, type{" "}
                  <Mono>safeship</Mono> and select the SafeShip check.
                  GitHub only lists checks that have <i>run at least once</i>
                  {" "}on the repo — so open a throwaway PR first and let
                  the workflow finish if you don&apos;t see the option.
                </li>
                <li>
                  Optionally tick{" "}
                  <b className="text-fg">
                    Require branches to be up to date before merging
                  </b>{" "}
                  so the check re-runs against the latest base.
                </li>
                <li>
                  <b className="text-fg">Create</b>. From now on, any PR
                  against this branch with a red SafeShip check has the
                  merge button disabled.
                </li>
              </ol>

              <h3 className="mb-2 mt-6 text-[15.5px] font-semibold text-fg">
                Option B — Repository ruleset (recommended for new repos)
              </h3>
              <p className="mb-3 text-fg-2">
                GitHub Rulesets are the newer, more flexible replacement
                for Branch protection rules. If you&apos;re starting fresh,
                use these:
              </p>
              <ol className="list-decimal pl-5 text-fg-2 [&>li]:mb-1.5">
                <li>
                  Go to{" "}
                  <b className="text-fg">
                    repo Settings → Rules → Rulesets → New ruleset → New
                    branch ruleset
                  </b>
                  .
                </li>
                <li>
                  Name it (e.g. <Mono>main-protection</Mono>), set{" "}
                  <b className="text-fg">Enforcement status: Active</b>.
                </li>
                <li>
                  Under <b className="text-fg">Target branches</b>, add{" "}
                  <Mono>Default branch</Mono>.
                </li>
                <li>
                  Under <b className="text-fg">Rules</b>, tick{" "}
                  <b className="text-fg">Require status checks to pass</b>{" "}
                  and add the SafeShip check by its workflow job name.
                </li>
                <li>
                  <b className="text-fg">Create</b>. Same merge-blocking
                  outcome, more flexibility for future rules.
                </li>
              </ol>

              <h3 className="mb-2 mt-6 text-[15.5px] font-semibold text-fg">
                Finding the right check name
              </h3>
              <p className="mb-3 text-fg-2">
                The check name GitHub remembers is the{" "}
                <b className="text-fg">job name</b> from your workflow YAML
                — <i>not</i> &quot;SafeShip&quot;. So if your workflow
                looks like:
              </p>
              <CodeBlock language="yaml">{`jobs:
  regression:    # <- this is what GitHub registers
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ego-debug/SafeShip/.github/actions/safeship@main`}</CodeBlock>
              <p className="mb-3 mt-3 text-fg-2">
                Then the check to require is called{" "}
                <Mono>regression</Mono>. If you have steps with{" "}
                <Mono>name:</Mono> set, GitHub uses{" "}
                <Mono>regression / Block on agent regression</Mono>{" "}
                instead. The branch-protection search box autocompletes,
                so just type a few letters of either.
              </p>

              <p className="mt-3 text-[13.5px] text-fg-3">
                If the check doesn&apos;t appear in the dropdown, the
                workflow hasn&apos;t finished running on this repo yet —
                open a draft PR, let it run once, then come back.
              </p>
            </Section>

            <Section id="replay" title="How replay works">
              <p className="mb-3 text-fg-2">
                When SafeShip generates a regression test from a failing
                trace, it also remembers the exact input the agent was
                called with when the failure occurred. In CI, the test
                runner replays that input through your <i>new</i> code and
                evaluates the test&apos;s assertion (e.g.{" "}
                <Mono>output contains lookup_order.output.total</Mono>)
                against the new trace. Three outcomes:
              </p>
              <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
                <li>
                  <b className="text-fg">passed</b> — the assertion held;
                  this regression won&apos;t recur with your new code.
                </li>
                <li>
                  <b className="text-fg">failed</b> — the assertion was
                  violated; your PR would reproduce the original failure.
                  The PR check fails and the inline comment shows which
                  test broke and why.
                </li>
                <li>
                  <b className="text-fg">skipped</b> — no step in the new
                  trace matched the test&apos;s <Mono>when:</Mono> clause.
                  The agent likely routed differently for this input;
                  non-blocking.
                </li>
              </ul>
              <p className="mt-3 text-fg-2">
                Replays run <i>your</i> code with <i>your</i> credentials
                inside <i>your</i> CI environment. SafeShip&apos;s servers
                never execute your agent — they only generate the YAML
                assertions and serve them via the manifest API.
              </p>
            </Section>

            <Section id="free-replay" title="Free CI replay (cached LLM responses)">
              <p className="mb-3 text-fg-2">
                By default, every replayed test re-invokes your agent with
                real LLM calls. That costs roughly{" "}
                <b className="text-fg">$0.05–$0.30 per accepted test per PR
                run</b>{" "}
                and grows linearly with both test count and PR cadence.
                SafeShip&apos;s auto-instrumentation captures every
                Anthropic / OpenAI call when the trace is first recorded;
                the cached request and response bodies travel with the
                test. In CI, those cached responses can be replayed
                verbatim — no provider hit, no LLM bill.
              </p>
              <p className="mb-3 text-fg-2">
                Opt in by setting the feature flag in your repo secrets:
              </p>
              <CodeBlock>{`SAFESHIP_REPLAY_LLM_CACHE=true`}</CodeBlock>
              <p className="mb-3 mt-3 text-fg-2">
                And (optionally) the mode in <Mono>safeship.yaml</Mono>:
              </p>
              <CodeBlock language="yaml">{`agent: src.my_agent:run
replay_mode: cached_or_live  # default — falls back to live on miss
# replay_mode: cached_only   # strict — miss = fail with "fixture mismatch"
# replay_mode: live          # ignore cache entirely (Phase-2 behavior)`}</CodeBlock>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                Match key
              </h3>
              <p className="mb-3 text-fg-2">
                A cached response is returned when the cursor-walked
                request matches by{" "}
                <Mono>sha256(canonical_json_body)</Mono>. Canonicalization
                sorts JSON keys and strips whitespace, so harmless
                serialization differences don&apos;t break a hit. Cursor
                walking means a refactor that adds or skips a non-LLM step
                in between calls still matches the remaining LLM calls in
                order.
              </p>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                Cache-miss behavior by mode
              </h3>
              <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
                <li>
                  <Mono>cached_or_live</Mono> <b className="text-fg">(default)</b>{" "}
                  — cache miss falls through to a real LLM call. The PR
                  comment notes which calls fell through, so you can see
                  cost creep over time.
                </li>
                <li>
                  <Mono>cached_only</Mono> — cache miss returns a synthetic
                  HTTP 599 response (no provider hit). The assertion
                  evaluator treats it as a failed step and reports
                  &quot;fixture mismatch&quot;. Use this when you want CI
                  to be guaranteed free even if it means refactor PRs need
                  fresh re-accepts.
                </li>
                <li>
                  <Mono>live</Mono> — cache is ignored entirely. Every call
                  goes to the provider. Identical to Phase-2 behavior;
                  useful as an escape hatch.
                </li>
              </ul>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                When to re-accept a test
              </h3>
              <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
                <li>
                  You materially rewrote the prompt for a step the test
                  targets — the old cached response is now misleading.
                </li>
                <li>
                  You switched providers or models — cache entries are
                  per-host and per-model.
                </li>
                <li>
                  You started seeing too many fallthrough warnings in PR
                  comments — easier to re-accept once than to keep paying
                  for live calls.
                </li>
              </ul>
              <p className="mt-3 text-[13.5px] text-fg-3">
                Tests accepted before this feature shipped have no cache
                and continue to run via live calls (Phase-2 behavior,
                unchanged). The dashboard surfaces a small{" "}
                <b className="text-fg">&quot;LLM calls cached&quot;</b>{" "}
                badge per test so you can see which ones run free.
              </p>
              <p className="mt-3 text-[13.5px] text-fg-3">
                Two-week observation period: this feature is gated behind
                the env flag above for two weeks while we verify the
                cache-key strategy holds up across real refactor patterns.
                Once stable, the default flips to on.
              </p>
            </Section>

            <Section id="determinism" title="Making your agent deterministic-friendly">
              <p className="mb-3 text-fg-2">
                Replay assumes the same input produces a comparable output.
                If your agent is highly non-deterministic, tests may pass
                or fail differently between runs even when your code is
                unchanged. A few things help:
              </p>
              <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
                <li>
                  Set <Mono>temperature=0</Mono> on LLM calls in CI, or
                  whatever the equivalent &quot;most deterministic&quot;
                  knob is for the model you&apos;re using.
                </li>
                <li>
                  Pin the <Mono>seed</Mono> parameter where the provider
                  supports it.
                </li>
                <li>
                  Mock or stub time-dependent inputs (<Mono>datetime.now()</Mono>,
                  randomness sources, external clocks) when running under
                  the test runner. The simplest way is to gate them on an
                  env var: <Mono>SAFESHIP_RUN_MODE=test</Mono> is set by
                  the runner automatically.
                </li>
                <li>
                  Re-accept the suggestion (or skip it and let SafeShip
                  generate a fresh one) when you&apos;ve materially
                  rewritten the prompt — the old fixture may no longer
                  reproduce the failure even on broken code.
                </li>
              </ul>
              <p className="mt-3 text-[13.5px] text-fg-3">
                Determinism is your agent&apos;s property, not ours. We
                surface flaky behavior so you can decide whether to
                tighten the assertion, lower the temperature, or accept
                the noise.
              </p>
            </Section>

            <Section id="async" title="Async agents">
              <p className="mb-3 text-fg-2">
                <Mono>safeship.wrap()</Mono> detects coroutine functions
                automatically — the wrapped callable stays awaitable:
              </p>
              <CodeBlock>{`import asyncio
import safeship

safeship.init(api_key="sk_live_...")

async def my_agent(prompt):
    ...

agent = safeship.wrap(my_agent)
asyncio.run(agent("hello"))`}</CodeBlock>
            </Section>

            <Section id="compatibility" title="What it works with">
              <p className="mb-3 text-fg-2">
                SafeShip is framework-agnostic by design.{" "}
                <Mono>safeship.wrap()</Mono> takes any Python callable, and
                the SDK auto-records calls to common LLM providers as
                steps — no per-call instrumentation needed. A few common
                patterns:
              </p>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                Anthropic SDK
              </h3>
              <p className="mb-3 text-fg-2">
                Every call to <Mono>client.messages.create</Mono> is
                auto-captured as a step with model, messages, and assistant
                text. No <Mono>safeship.step()</Mono> calls needed.
              </p>
              <CodeBlock>{`import anthropic, safeship

safeship.init(api_key="sk_live_...")
client = anthropic.Anthropic()

@safeship.wrap
def agent(prompt: str) -> str:
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text`}</CodeBlock>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                OpenAI SDK
              </h3>
              <p className="mb-3 text-fg-2">
                Same story — <Mono>client.chat.completions.create</Mono>{" "}
                and the legacy <Mono>completions</Mono> endpoint are both
                captured automatically.
              </p>
              <CodeBlock>{`import openai, safeship

safeship.init(api_key="sk_live_...")
client = openai.OpenAI()

@safeship.wrap
def agent(prompt: str) -> str:
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.choices[0].message.content`}</CodeBlock>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                How auto-instrumentation works
              </h3>
              <p className="mb-3 text-fg-2">
                <Mono>safeship.init()</Mono> installs a small httpx
                transport interceptor. Outbound requests to{" "}
                <Mono>api.anthropic.com</Mono> and{" "}
                <Mono>api.openai.com</Mono> are timed, parsed, and recorded
                as steps on the in-flight run. Everything else (your
                database, your tools, third-party APIs) passes through
                untouched. The interceptor runs in your process, on your
                infra — no requests go through SafeShip.
              </p>
              <p className="mb-3 text-[13.5px] text-fg-3">
                Set <Mono>auto_instrument=False</Mono> in{" "}
                <Mono>init()</Mono>, or{" "}
                <Mono>SAFESHIP_AUTO_INSTRUMENT=false</Mono> in your env, to
                opt out — for the rare stacks that depend on raw httpx
                behavior.
              </p>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                MCP tool calls and other non-LLM steps
              </h3>
              <p className="mb-3 text-fg-2">
                MCP tool invocations and other non-LLM operations
                aren&apos;t HTTP calls to a known provider host, so wrap
                each one in <Mono>safeship.step()</Mono> to surface them on
                the trace timeline. The auto-suggest engine then knows
                which tool failed and can target the assertion at it
                specifically.
              </p>
              <CodeBlock>{`import safeship
from your_mcp_client import call_mcp_tool

safeship.init(api_key="sk_live_...")

@safeship.wrap
def agent(user_message: str) -> str:
    search = call_mcp_tool("search_docs", {"q": user_message})
    safeship.step(
        tool_name="mcp.search_docs",
        kind="tool",
        input={"q": user_message},
        output=search,
        duration_ms=search["_elapsed_ms"],
        status="ok" if search.get("results") else "fail",
    )

    summary = call_mcp_tool("summarize", {"docs": search["results"]})
    safeship.step(
        tool_name="mcp.summarize",
        kind="tool",
        input={"docs_n": len(search["results"])},
        output=summary,
        duration_ms=summary["_elapsed_ms"],
        status="ok",
    )

    return summary["text"]`}</CodeBlock>
              <p className="mt-3 text-[13.5px] text-fg-3">
                Same pattern for any non-HTTP tool — function calling,
                custom RPC, in-process libraries. SafeShip cares about{" "}
                <Mono>tool_name</Mono>, <Mono>input</Mono>,{" "}
                <Mono>output</Mono>, and <Mono>status</Mono>.
              </p>

              <h3 className="mb-2 mt-5 text-[15.5px] font-semibold text-fg">
                Custom LLM endpoints or other providers
              </h3>
              <p className="mb-3 text-fg-2">
                If you call a self-hosted model, a less-common provider, or
                anything outside the auto-instrument allowlist, record it
                with <Mono>safeship.step()</Mono> just like a tool call:
              </p>
              <CodeBlock>{`import httpx, safeship, time

safeship.init(api_key="sk_live_...")

@safeship.wrap
def agent(prompt: str) -> str:
    t0 = time.perf_counter()
    r = httpx.post("https://your-llm-endpoint", json={"prompt": prompt})
    safeship.step(
        tool_name="custom_llm",
        kind="llm",
        input=prompt,
        output=r.json(),
        duration_ms=int((time.perf_counter() - t0) * 1000),
        status="ok" if r.status_code == 200 else "fail",
    )
    return r.json()["text"]`}</CodeBlock>
              <p className="mt-3 text-[13.5px] text-fg-3">
                Want a provider added to the auto-instrument allowlist?
                Email <a href="mailto:founder@safeship.dev" className="text-accent hover:text-[#d3ff85]">founder@safeship.dev</a>{" "}
                with the API host and we&apos;ll prioritize it.
              </p>
            </Section>

            <Section id="config" title="Configuration reference">
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-[13.5px]">
                  <thead className="border-b border-line bg-[rgba(255,255,255,0.015)] font-mono text-[11px] uppercase tracking-wide text-fg-4">
                    <tr>
                      <th className="px-3 py-2">Parameter</th>
                      <th className="px-3 py-2">Env var</th>
                      <th className="px-3 py-2">Default</th>
                    </tr>
                  </thead>
                  <tbody className="text-fg-2 [&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-b-0">
                    <tr>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-fg">
                        api_key
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        SAFESHIP_API_KEY
                      </td>
                      <td className="px-3 py-2">—</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-fg">
                        endpoint
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        SAFESHIP_ENDPOINT
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        https://safeship.dev/v1/traces
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-fg">
                        timeout_seconds
                      </td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2">2.0</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-fg">
                        debug
                      </td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2">False</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-mono text-[12.5px] text-fg">
                        enabled
                      </td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2">True (set False in tests)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="reliability" title="Reliability guarantees">
              <p className="mb-3 text-fg-2">
                The SDK is built to never get in the way of your agent. These
                are enforced by code and verified in our pytest suite:
              </p>
              <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
                <li>
                  <b className="text-fg">Never crashes your agent.</b> Every
                  internal error is caught and dropped silently (turn on{" "}
                  <Mono>debug=True</Mono> to log them).
                </li>
                <li>
                  <b className="text-fg">Never blocks on the network.</b>{" "}
                  Trace upload happens on a daemon thread; your code returns
                  the moment your agent returns.
                </li>
                <li>
                  <b className="text-fg">No extra LLM calls.</b> SafeShip
                  never re-prompts your model or makes shadow calls — your
                  token spend is unchanged.
                </li>
                <li>
                  <b className="text-fg">Survives transient failures.</b> 5xx
                  and 429 responses are retried with exponential backoff;
                  permanent 4xx errors are dropped without crashing.
                </li>
              </ul>
            </Section>

            <Section id="troubleshoot" title="Troubleshooting">
              <Trouble q="My traces aren't showing up on the dashboard.">
                Check that your <Mono>api_key</Mono> starts with{" "}
                <Mono>sk_live_</Mono> and matches the one shown on{" "}
                <Link
                  href="/app/onboarding"
                  className="text-accent hover:text-[#d3ff85]"
                >
                  the Setup page
                </Link>
                . Set <Mono>debug=True</Mono> in{" "}
                <Mono>safeship.init()</Mono> to log transport errors to
                stderr.
              </Trouble>
              <Trouble q='I got a 429 "rate_limited" response.'>
                You hit either the burst (200/min) or daily (50,000/day)
                ingestion cap. The response includes a{" "}
                <Mono>Retry-After</Mono> header telling you how many seconds
                to wait. Contact{" "}
                <a
                  href="mailto:founder@safeship.dev"
                  className="text-accent hover:text-[#d3ff85]"
                >
                  founder@safeship.dev
                </a>{" "}
                if you need higher limits.
              </Trouble>
              <Trouble q="The 'Suggest a regression test' button errors out.">
                Either the per-project Claude rate limit has been reached
                (50/day) or there&apos;s a temporary backend issue. The error
                message will tell you which. Wait the displayed time or email
                support.
              </Trouble>
              <Trouble q="How do I send a test trace without writing code?">
                On the{" "}
                <Link
                  href="/app/onboarding"
                  className="text-accent hover:text-[#d3ff85]"
                >
                  Setup page
                </Link>
                , click <b className="text-fg">Send us a test trace</b>. It
                inserts a synthetic 5-step run so you can preview the
                dashboard and trace-detail UI without wiring real code.
              </Trouble>
            </Section>

            <Section id="help" title="Stuck?">
              <p className="text-fg-2">
                Email{" "}
                <a
                  href="mailto:founder@safeship.dev"
                  className="text-accent hover:text-[#d3ff85]"
                >
                  founder@safeship.dev
                </a>{" "}
                — solo founder, replies usually same-day. Include your
                project ID (visible on the dashboard) if you have one.
              </p>
            </Section>
          </article>

          <aside className="hidden lg:block">
            <nav className="sticky top-8 flex flex-col gap-2 border-l border-line pl-4 text-[13px]">
              <span className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-4">
                On this page
              </span>
              <TocLink href="#prereqs">Before you start</TocLink>
              <TocLink href="#billing">Billing & free trial</TocLink>
              <TocLink href="#install">1 — Install the SDK</TocLink>
              <TocLink href="#wrap">2 — Initialize and wrap</TocLink>
              <TocLink href="#steps">3 — Record sub-steps</TocLink>
              <TocLink href="#view">4 — See your traces</TocLink>
              <TocLink href="#ci">5 — Block bad deploys</TocLink>
              <TocLink href="#branch-protection">6 — Branch protection</TocLink>
              <TocLink href="#replay">How replay works</TocLink>
              <TocLink href="#free-replay">Free CI replay</TocLink>
              <TocLink href="#determinism">Deterministic agents</TocLink>
              <TocLink href="#async">Async agents</TocLink>
              <TocLink href="#compatibility">What it works with</TocLink>
              <TocLink href="#config">Configuration</TocLink>
              <TocLink href="#reliability">Reliability</TocLink>
              <TocLink href="#troubleshoot">Troubleshooting</TocLink>
              <TocLink href="#help">Stuck?</TocLink>
            </nav>
          </aside>
        </main>

        <Footer />
      </div>
    </>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-3 scroll-mt-24">
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function CodeBlock({
  children,
  language: _language,
}: {
  children: string;
  language?: string;
}) {
  return (
    <pre
      className="overflow-x-auto rounded-lg border border-line p-4 font-mono text-[12.5px] leading-[1.7] text-fg"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <code>{children}</code>
    </pre>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-line bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[12.5px] text-fg">
      {children}
    </code>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded border border-line-strong bg-[rgba(255,255,255,0.04)] px-1 font-mono text-[10.5px] text-fg-2">
      {children}
    </span>
  );
}

function Trouble({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mb-2 rounded-lg border border-line bg-[rgba(255,255,255,0.015)] px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-fg hover:text-fg">
        {q}
      </summary>
      <div className="mt-2 text-[13.5px] text-fg-2">{children}</div>
    </details>
  );
}

function TocLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-fg-3 transition-colors hover:text-fg-2"
    >
      {children}
    </a>
  );
}
