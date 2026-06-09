import Link from "next/link";
import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata = {
  title: "Migrate from Helicone · SafeShip",
  description:
    "Helicone is in maintenance mode after the Mintlify acquisition. Move to SafeShip in 5 minutes: flat $29.99/mo, auto-generated regression tests, and a GitHub Action that blocks bad deploys.",
};

export default function HeliconeMigrationPage() {
  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />

        <main className="flex flex-col gap-16 py-16">
          <Hero />
          <StatusBox />
          <Migration />
          <Comparison />
          <Honesty />
          <FAQ />
          <CTA />
          <TrademarkNotice />
        </main>

        <Footer />
      </div>
    </>
  );
}

function Hero() {
  return (
    <header className="flex flex-col gap-4">
      <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
        <span
          className="h-1.5 w-1.5 rounded-full bg-accent"
          style={{ boxShadow: "0 0 8px rgba(194,249,112,0.6)" }}
        />
        Helicone migration
      </span>
      <h1 className="text-[clamp(34px,5vw,56px)] font-semibold leading-[1.04] tracking-[-0.03em] [text-wrap:balance]">
        Helicone is in maintenance mode. Here&apos;s the five-minute move.
      </h1>
      <p className="max-w-[680px] text-lg text-fg-2">
        SafeShip is a logical next step for solo developers and small teams who
        used Helicone to monitor agents in production. Same{" "}
        <i>install-and-go</i> posture, plus the part Helicone never shipped:
        regression tests that build themselves from your real failures, and a
        GitHub Action that blocks deploys when behavior regresses.
      </p>
    </header>
  );
}

function StatusBox() {
  return (
    <section className="rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-6">
      <h2 className="mb-3 text-[15px] font-semibold uppercase tracking-[0.12em] text-fg-3">
        What happened to Helicone
      </h2>
      <p className="mb-3 text-fg-2">
        In <b className="text-fg">March 2026</b>, Mintlify acquired Helicone
        and, per their announcement, placed it in maintenance mode: security
        patches and bug fixes only, no new features. The team has publicly
        redirected focus to Mintlify, and the self-hosted distribution has
        open issues (Docker, ClickHouse, AzureOpenAI) that are not being
        actively addressed.
      </p>
      <p className="text-[13.5px] text-fg-3">
        Sources:{" "}
        <a
          href="https://www.mintlify.com/blog/mintlify-acquires-helicone"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-[#d3ff85]"
        >
          Mintlify acquisition announcement
        </a>{" "}
        ·{" "}
        <a
          href="https://github.com/Helicone/helicone/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-[#d3ff85]"
        >
          public GitHub issues tracker
        </a>
        . Status accurate as of May 2026; check the linked sources for the
        most current state.
      </p>
    </section>
  );
}

function Migration() {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        The migration
      </h2>
      <p className="text-fg-2">
        SafeShip is{" "}
        <b className="text-fg">instrumentation, not a proxy</b>. You go back to
        calling your LLM provider directly (no proxy URL, no extra header) and
        wrap your agent function with one line. No latency tax, no extra single
        point of failure in your request path.
      </p>

      <Step
        n="1"
        title="Remove the Helicone proxy from your LLM client"
        before={`# Before: Helicone (Anthropic example)
import anthropic

client = anthropic.Anthropic(
    base_url="https://anthropic.helicone.ai",
    default_headers={
        "Helicone-Auth": f"Bearer {HELICONE_KEY}",
    },
)`}
        after={`# After: talk to your provider directly
import anthropic

client = anthropic.Anthropic()  # standard, no proxy`}
      />

      <Step
        n="2"
        title="Install SafeShip and wrap your agent"
        before={`# (no equivalent in Helicone: the proxy "wrapped" requests
#  by sitting between your code and the LLM)`}
        after={`# pip install "git+https://github.com/ego-debug/SafeShip.git#subdirectory=sdks/python"
import safeship

safeship.init(api_key="sk_live_...")  # from /app/onboarding

@safeship.wrap
def my_agent(message: str) -> str:
    # your existing agent code stays the same
    ...`}
      />

      <Step
        n="3"
        title="Open the dashboard"
        body={
          <p className="text-fg-2">
            Every call to your wrapped agent ships a trace from a background
            daemon thread. Open{" "}
            <Link
              href="/app/dashboard"
              className="text-accent hover:text-[#d3ff85]"
            >
              /app/dashboard
            </Link>{" "}
            and watch your runs appear in the &quot;Recent runs&quot; panel
            within seconds. Click into a failed run, hit{" "}
            <b className="text-fg">✓ Suggest a regression test</b>, and Claude
            writes a YAML assertion that would have caught it. Accept it (press{" "}
            <Kbd>Y</Kbd>) and it lands in your regression suite, replayed
            against every PR by the SafeShip GitHub Action.
          </p>
        }
      />

      <p className="text-[13.5px] text-fg-3">
        Total time: ~5 minutes if your agent is one function, ~15 minutes if
        you have a few entry points. The Helicone proxy lines come out;
        SafeShip&apos;s wrap goes in once at startup.
      </p>
    </section>
  );
}

function Comparison() {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        Helicone vs SafeShip: what changes
      </h2>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-[13.5px]">
          <thead className="border-b border-line bg-[rgba(255,255,255,0.02)] font-mono text-[11px] uppercase tracking-wide text-fg-4">
            <tr>
              <th className="px-4 py-3">Concern</th>
              <th className="px-4 py-3">Helicone</th>
              <th className="px-4 py-3">SafeShip</th>
            </tr>
          </thead>
          <tbody className="text-fg-2 [&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-b-0">
            <Row
              label="Project status"
              helicone="Maintenance mode (Mar 2026)"
              safeship="Active development"
            />
            <Row
              label="Architecture"
              helicone="Proxy in front of every LLM call"
              safeship="SDK wrap, traces ship from a daemon thread"
            />
            <Row
              label="Added latency"
              helicone="Per-call proxy hop (third-party teardowns measured ~50–80ms)"
              safeship="0ms: trace ships from a daemon thread"
            />
            <Row
              label="Single point of failure"
              helicone="Yes: your requests stop if proxy is down"
              safeship="No: your agent runs even if SafeShip is down"
            />
            <Row
              label="Auto-generates regression tests"
              helicone={<Cross />}
              safeship={<Check>From real failed traces, you accept or skip</Check>}
            />
            <Row
              label="Blocks deploys on regression"
              helicone={<Cross />}
              safeship={<Check>Drop-in GitHub Action, two modes</Check>}
            />
            <Row
              label="Replays past runs in CI"
              helicone={<Cross />}
              safeship={<Check>Replay fixture stored with each accepted test</Check>}
            />
            <Row
              label="Pricing"
              helicone="Tiered: Free → Pro → Team → Enterprise (see their pricing page)"
              safeship={<>Flat <b className="text-fg">$29.99/mo</b>, unlimited traces</>}
            />
            <Row
              label="Cloud bill kill-switch"
              helicone="None: viral traffic = full provider bill"
              safeship="Per-project rate limits + flat plan = no surprises"
            />
            <Row
              label="Framework lock-in"
              helicone="None (it's a proxy)"
              safeship="None (works with any LLM SDK or raw HTTP)"
            />
            <Row
              label="Where your data lives"
              helicone="US Cloudflare Workers"
              safeship="US (Vercel + Supabase). EU residency on roadmap."
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Honesty() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">
        What SafeShip does <i>not</i> do
      </h2>
      <p className="text-fg-2">
        We&apos;re a 1-person company shipping a focused product. A few things
        Helicone offered are deliberately not on our roadmap yet. If these are
        load-bearing for you, plan accordingly:
      </p>
      <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
        <li>
          <b className="text-fg">Response caching.</b> Helicone caches identical
          requests. SafeShip doesn&apos;t. Your provider sees every call.
        </li>
        <li>
          <b className="text-fg">Prompt management with approval workflows.</b>{" "}
          We don&apos;t store, version, or A/B test prompts. Manage them in
          your repo.
        </li>
        <li>
          <b className="text-fg">Self-hosted.</b> SafeShip is SaaS only. No
          Docker image, no Kubernetes chart.
        </li>
        <li>
          <b className="text-fg">Multi-seat / multi-workspace.</b> One account,
          unlimited projects, no team features yet.
        </li>
        <li>
          <b className="text-fg">EU data residency.</b> Currently US-only. On
          the roadmap; ask if it&apos;s a hard requirement.
        </li>
      </ul>
      <p className="mt-1 text-[13.5px] text-fg-3">
        If those are deal-breakers, open-source self-hosted observability
        tools (run from your own infra) are the closest functional successor
        to late-era Helicone, though plan on standing up a multi-service
        stack and the eng time that entails.
      </p>
    </section>
  );
}

function FAQ() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">
        Migration FAQ
      </h2>
      <Q q="Can I export my historical Helicone traces into SafeShip?">
        Not automatically. SafeShip starts fresh from your first wrapped call.
        If you need historical data preserved, export from Helicone first
        (their export endpoints still work in maintenance mode) and keep the
        archive. SafeShip&apos;s value is forward-looking: every <i>future</i>{" "}
        failure becomes a regression test.
      </Q>
      <Q q="Do I need to change my Anthropic / OpenAI account?">
        No. SafeShip never sees your LLM provider keys. You go back to calling
        the provider directly with your own credentials, exactly the
        pre-Helicone setup.
      </Q>
      <Q q="Will SafeShip slow down my agent?">
        No. The SDK ships traces from a background daemon thread; your agent
        function returns the moment it would have without SafeShip. Compare
        with Helicone&apos;s 50–80ms proxy hop on every LLM call.
      </Q>
      <Q q="What if SafeShip's ingest endpoint is down?">
        Your agent keeps running. The SDK catches every internal error
        silently, retries 5xx/429 with exponential backoff, and never crashes
        your code. Verified in our pytest suite. (Helicone, being a proxy,
        couldn&apos;t make this guarantee: proxy down = your LLM call down.)
      </Q>
      <Q q="I was using Helicone's prompt management / caching / custom properties. What now?">
        SafeShip doesn&apos;t replace those features (yet; see &quot;What
        SafeShip does <i>not</i> do&quot; above). If those are load-bearing,
        a self-hosted observability tool is your closest functional path
        forward. If you can live without them, SafeShip&apos;s wedge
        (auto-generated tests + deploy gating) is what you actually need to
        ship agents reliably.
      </Q>
      <Q q="Can I run SafeShip alongside Helicone during the cutover?">
        Yes. They&apos;re completely independent: Helicone proxies your LLM
        calls, SafeShip wraps your agent function. Run both for a week if
        you&apos;d like to compare dashboards before pulling the proxy lines.
      </Q>
      <Q q="What's the total cost if I switch?">
        $29.99/mo flat, no per-trace overage, no per-seat charge. Compare
        against Helicone&apos;s current{" "}
        <a
          href="https://www.helicone.ai/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-[#d3ff85]"
        >
          published pricing
        </a>{" "}
        for your traffic volume. For most solo devs and small teams, SafeShip
        comes out at a wash or better on price, and ahead on capability,
        since auto-generated regression tests and deploy gating aren&apos;t
        on the Helicone roadmap.
      </Q>
    </section>
  );
}

function CTA() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-7">
      <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">
        Ready to switch?
      </h2>
      <p className="max-w-[600px] text-fg-2">
        Start a 7-day free trial: card on file, $0 charged unless you keep
        it. The first trace lands on your dashboard within 5 seconds of
        wrapping your agent.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/sign-up"
          className="rounded-lg bg-fg px-[18px] py-2.5 text-sm font-semibold text-bg shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] transition hover:bg-white hover:-translate-y-px"
        >
          Start 7-day free trial
        </Link>
        <Link
          href="/docs"
          className="rounded-lg border border-line px-[18px] py-2.5 text-sm font-semibold text-fg transition hover:border-line-strong"
        >
          Read the setup guide
        </Link>
        <a
          href="mailto:founder@safeship.dev?subject=Helicone%20migration%20question"
          className="px-2 text-sm text-fg-3 transition-colors hover:text-fg-2"
        >
          Or email founder@safeship.dev
        </a>
      </div>
    </section>
  );
}

function TrademarkNotice() {
  return (
    <section className="border-t border-line pt-6 text-[12px] leading-[1.6] text-fg-4">
      <p>
        Helicone and Mintlify are trademarks of their respective owners. This
        page is not affiliated with, endorsed by, or sponsored by Helicone,
        Inc. or Mintlify, Inc. All claims about third-party products are
        based on publicly available sources cited above and are accurate to
        the best of our knowledge as of May 2026; check the linked sources
        for the current state.
      </p>
    </section>
  );
}

function Step({
  n,
  title,
  before,
  after,
  body,
}: {
  n: string;
  title: string;
  before?: string;
  after?: string;
  body?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-3 text-[18px] font-semibold text-fg">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-line text-[13px] font-mono text-fg-2">
          {n}
        </span>
        {title}
      </h3>
      {body}
      {before && after && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <CodeCard label="Before: Helicone">{before}</CodeCard>
          <CodeCard label="After: SafeShip">{after}</CodeCard>
        </div>
      )}
    </div>
  );
}

function CodeCard({
  label,
  children,
}: {
  label: string;
  children: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-line">
      <div className="border-b border-line px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-4">
        {label}
      </div>
      <pre
        className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] text-fg"
        style={{ background: "rgba(0,0,0,0.4)" }}
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Row({
  label,
  helicone,
  safeship,
}: {
  label: string;
  helicone: React.ReactNode;
  safeship: React.ReactNode;
}) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-fg">{label}</td>
      <td className="px-4 py-3 align-top">{helicone}</td>
      <td className="px-4 py-3 align-top">{safeship}</td>
    </tr>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-accent">✓</span>
      <span>{children}</span>
    </span>
  );
}

function Cross() {
  return <span className="text-fg-4">–</span>;
}

function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-line bg-[rgba(255,255,255,0.015)] px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-fg">
        {q}
      </summary>
      <div className="mt-2 text-[13.5px] text-fg-2">{children}</div>
    </details>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded border border-line-strong bg-[rgba(255,255,255,0.04)] px-1 font-mono text-[10.5px] text-fg-2">
      {children}
    </span>
  );
}
