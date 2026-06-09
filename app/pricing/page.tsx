import Link from "next/link";
import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata = {
  title: "Pricing · SafeShip",
  description:
    "$29.99/month flat, unlimited traces, no per-seat charges. See how that compares to per-seat eval platforms, enterprise eval suites, and self-hosted observability stacks at three workload tiers.",
};

export default function PricingPage() {
  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />

        <main className="flex flex-col gap-16 py-16">
          <Hero />
          <PlanCard />
          <Comparison />
          <Methodology />
          <FAQ />
          <CTA />
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
        Pricing
      </span>
      <h1 className="text-[clamp(34px,5vw,56px)] font-semibold leading-[1.04] tracking-[-0.03em] [text-wrap:balance]">
        $29.99 a month. Flat. Here&apos;s the math.
      </h1>
      <p className="max-w-[680px] text-lg text-fg-2">
        One tier. Unlimited agent traces. No per-seat fees, no per-trace
        overage, no surprise bill if your agent goes viral. The comparison
        below shows what equivalent functionality typically costs in three
        adjacent categories at three workload tiers.
      </p>
    </header>
  );
}

function PlanCard() {
  const features = [
    "Unlimited agent traces",
    "Unlimited projects",
    "Auto-suggested regression tests from real failures",
    "GitHub Action that blocks PRs on regression",
    "Email alerts on failed runs",
    "Add your whole team, no seat fees",
  ];
  return (
    <section
      className="grid grid-cols-1 gap-8 rounded-2xl border border-line-strong px-7 py-7 lg:grid-cols-[minmax(0,300px)_1fr] lg:items-center"
      style={{
        background:
          "radial-gradient(120% 80% at 0% 0%, rgba(194,249,112,0.06), transparent 60%), linear-gradient(180deg, #121215 0%, #0c0c0e 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.05) inset, 0 30px 60px -28px rgba(0,0,0,0.6)",
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <span
            className="h-2 w-2 rounded-full bg-accent"
            style={{ boxShadow: "0 0 10px rgba(194,249,112,0.6)" }}
          />
          Pro
          <span
            className="ml-1 rounded-full border px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent"
            style={{
              background: "rgba(194,249,112,0.10)",
              borderColor: "rgba(194,249,112,0.25)",
            }}
          >
            7-day free trial
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="-translate-y-3 text-[28px] font-medium text-fg-2">$</span>
          <span className="text-[80px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-fg">
            29
          </span>
          <span className="-translate-y-3 text-[28px] font-medium text-fg-2">.99</span>
          <span className="ml-1 text-[15px] text-fg-3">/ month</span>
        </div>
        <p className="font-mono text-xs text-fg-3">
          billed monthly · cancel anytime · $0 if you cancel before day 7
        </p>
        <Link
          href="/sign-up"
          className="mt-1 inline-flex items-center justify-center rounded-[9px] bg-accent px-[18px] py-3 text-[14.5px] font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4),0_10px_24px_-10px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
        >
          Start 7-day free trial <span aria-hidden="true">→</span>
        </Link>
      </div>

      <ul className="flex flex-col gap-3 lg:border-l lg:border-line lg:pl-8">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-3 text-[14.5px] text-fg">
            <span
              className="grid h-[18px] w-[18px] flex-none place-items-center rounded-full border text-accent"
              style={{
                background: "rgba(194,249,112,0.12)",
                borderColor: "rgba(194,249,112,0.3)",
              }}
            >
              <svg
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[9px] w-[9px]"
              >
                <polyline points="2 6 5 9 10 3" />
              </svg>
            </span>
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Comparison() {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        Effective monthly cost by workload
      </h2>
      <p className="text-fg-2">
        <b className="text-fg">Managed-middle pricing.</b> You&apos;re not
        running infra (free OSS CLIs), you&apos;re not paying ML-team rates
        (enterprise eval platforms), and you&apos;re not paying per seat for
        a one-person team. Three workload tiers, four pricing-model
        categories. Numbers are based on the published pricing pages of
        representative tools in each category as of June 2026 (see
        methodology below).
      </p>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-[13.5px]">
          <thead className="border-b border-line bg-[rgba(255,255,255,0.02)] font-mono text-[11px] uppercase tracking-wide text-fg-4">
            <tr>
              <th className="px-4 py-3">Pricing model</th>
              <th className="px-4 py-3">
                Hobbyist
                <small className="block font-normal normal-case text-fg-4">
                  1k traces · 1 dev
                </small>
              </th>
              <th className="px-4 py-3">
                Solo founder
                <small className="block font-normal normal-case text-fg-4">
                  50k traces · 1 dev
                </small>
              </th>
              <th className="px-4 py-3">
                Small team in production
                <small className="block font-normal normal-case text-fg-4">
                  500k traces · 3 devs
                </small>
              </th>
            </tr>
          </thead>
          <tbody className="text-fg-2 [&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-b-0">
            <Row
              label="SafeShip"
              detail="$29.99/mo flat · unlimited traces · unlimited seats"
              cells={["$29.99", "$29.99", "$29.99"]}
              us
            />
            <Row
              label="Per-seat eval platforms"
              detail="Example: ~$39/seat/mo + per-trace overage above the included quota"
              cells={[
                "~$39",
                "~$140",
                "~$317",
              ]}
            />
            <Row
              label="Enterprise eval suites"
              detail="Example: $0 free tier, then a $249/mo jump with nothing in between; Enterprise on quote"
              cells={[
                "$0 (free tier)",
                "~$249",
                "$249+ (often quote-based)",
              ]}
            />
            <Row
              label="Per-event observability (cloud)"
              detail="Example: ~$50/seat + ~$10 per million spans (sub-steps within a trace) + ~$3/GB payload"
              cells={[
                "~$0 (within free tier)",
                "~$60–100",
                "~$200–500",
              ]}
            />
            <Row
              label="Self-hosted observability"
              detail="Free software + your time to run a multi-service stack and absorb hosting"
              cells={[
                "Free + setup time",
                "Free + ongoing eng time",
                "Free + meaningful ops burden",
              ]}
            />
          </tbody>
        </table>
      </div>

      <p className="text-[13.5px] text-fg-3">
        For non-SafeShip rows, dollar figures are approximate and assume the
        most common public posture in each category. Exact prices vary by
        vendor and change frequently. The shape of the curve is the
        durable point: SafeShip is flat, the others scale with traces, seats,
        spans, or your engineering hours.
      </p>
    </section>
  );
}

function Methodology() {
  return (
    <section className="rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-6">
      <h2 className="mb-3 text-[15px] font-semibold uppercase tracking-[0.12em] text-fg-3">
        Methodology
      </h2>
      <ul className="list-disc pl-5 text-[13.5px] text-fg-2 [&>li]:mb-1.5">
        <li>
          A &quot;trace&quot; is one wrapped agent run; a typical agent run
          contains 5–15 sub-step spans. Per-event vendors meter on spans;
          per-trace vendors meter on runs. We translate one to the other
          using a 10×-spans-per-trace assumption (so 50k traces ≈ 500k
          spans).
        </li>
        <li>
          Per-seat figures assume the lowest paid tier each category
          publishes, multiplied by seat count, plus typical overage past
          the included quota at the published rate.
        </li>
        <li>
          Enterprise-suite figures assume the lowest published flat-rate
          tier; volumes that exceed it usually require an Enterprise quote
          that is not publicly listed.
        </li>
        <li>
          Self-hosted figures are <i>cash</i> cost only. We deliberately
          don&apos;t put a dollar figure on the engineering time required
          to run a multi-service observability stack. That varies too much
          to estimate honestly. Plan for your own time as the real cost.
        </li>
        <li>
          For your specific situation, check each vendor&apos;s pricing page
          directly. The goal of this table is the comparative shape, not
          precise quotes.
        </li>
      </ul>
    </section>
  );
}

function FAQ() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        Pricing FAQ
      </h2>
      <Q q="Is there really no per-seat charge?">
        No. Add your whole team to the same SafeShip account at $29.99
        total. We don&apos;t track or bill on seats. Team features (RBAC,
        audit logs, shared workspaces) are deliberately not built yet.
        When they ship, the price stays flat.
      </Q>
      <Q q="What if my agent goes viral and produces millions of traces?">
        You stay at $29.99/mo. Per-project rate limits exist as an abuse
        and cost-control safety net (5,000 traces per 24h burst-capped at
        100/min by default). If you legitimately need higher caps, email
        and we&apos;ll raise them. The price doesn&apos;t change.
      </Q>
      <Q q="Are there usage limits on the auto-suggest engine?">
        Yes: 50 suggestions per project per 24h, burst-capped at 5 per 5
        minutes. This protects the Anthropic spend cap behind the engine.
        For typical solo-dev usage (a few failing runs per day), this is
        invisible. If you need more, email.
      </Q>
      <Q q="What's the trial structure?">
        7-day free trial, card required upfront, $0 charged if you cancel
        before day 7. After day 7 the card is auto-charged $29.99/mo. You
        can cancel anytime from the customer portal. No email retention
        loop, no phone calls. You keep access until the current billing
        period ends.
      </Q>
      <Q q="Why not free forever?">
        Two reasons. The auto-suggest engine costs us real Anthropic tokens
        on every suggestion. A free tier big enough to be useful would be
        either abusable or unsustainable. And charging from day one keeps
        us building for people who depend on their agent in production,
        which is who this tool is for.
      </Q>
      <Q q="Do you offer annual pricing or volume discounts?">
        Not yet. One price, monthly. Once we have ten paying customers
        we&apos;ll consider an annual option.
      </Q>
      <Q q="What about refunds?">
        Cancel anytime to stop future charges. We don&apos;t refund partial
        months, but if something goes genuinely wrong on our end, email
        the founder and we&apos;ll do the right thing.
      </Q>
    </section>
  );
}

function CTA() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-7">
      <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">
        Ready to ship reliable agents?
      </h2>
      <p className="max-w-[600px] text-fg-2">
        Start the 7-day free trial. First trace lands on your dashboard
        within 5 seconds of wrapping your agent.
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
          href="mailto:founder@safeship.dev"
          className="px-2 text-sm text-fg-3 transition-colors hover:text-fg-2"
        >
          founder@safeship.dev
        </a>
      </div>
    </section>
  );
}

function Row({
  label,
  detail,
  cells,
  us,
}: {
  label: string;
  detail: string;
  cells: [string, string, string];
  us?: boolean;
}) {
  return (
    <tr
      className="relative"
      style={{
        background: us
          ? "linear-gradient(90deg, rgba(194,249,112,0.07), rgba(194,249,112,0.015))"
          : undefined,
      }}
    >
      <td className="px-4 py-4 align-top">
        <div className={`text-sm font-medium ${us ? "text-fg" : "text-fg"}`}>
          {label}
        </div>
        <div className="mt-1 text-[12px] text-fg-3">{detail}</div>
      </td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={`px-4 py-4 align-top font-mono text-[13.5px] ${
            us ? "font-semibold text-fg" : "text-fg-2"
          }`}
        >
          {c}
        </td>
      ))}
    </tr>
  );
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
