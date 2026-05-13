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
                Add SafeShip to your PR workflow to fail any deploy whose
                latest run scored below a threshold:
              </p>
              <CodeBlock language="yaml">{`# .github/workflows/deploy.yml
jobs:
  safeship:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ego-debug/SafeShip/.github/actions/safeship@main
        with:
          api-key: \${{ secrets.SAFESHIP_API_KEY }}
          min-score: 80`}</CodeBlock>
              <p className="mt-3 text-[13.5px] text-fg-3">
                Store your <Mono>sk_live_…</Mono> key as a repo secret named{" "}
                <Mono>SAFESHIP_API_KEY</Mono>. Full reference:{" "}
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
                You hit either the burst (100/min) or daily (5,000/day)
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
              <TocLink href="#async">Async agents</TocLink>
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
