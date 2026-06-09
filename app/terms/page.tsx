import Link from "next/link";
import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata = {
  title: "Terms · SafeShip",
  description:
    "The deal between you and SafeShip in plain English: what you get, what you pay, what we promise, what we don't. Plus the full legal Terms of Service.",
};

const EFFECTIVE_DATE = "June 5, 2026";

export default function TermsPage() {
  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />

        <main className="flex flex-col gap-10 py-16">
          <Header />
          <PlainEnglishSummary />
          <TermlyPlaceholder />
          <Contact />
        </main>

        <Footer />
      </div>
    </>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-3">
      <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
        <span
          className="h-1.5 w-1.5 rounded-full bg-accent"
        />
        Terms
      </span>
      <h1 className="text-[clamp(32px,4vw,48px)] font-semibold leading-[1.05] tracking-[-0.03em]">
        The deal, in plain English.
      </h1>
      <p className="font-mono text-[12px] text-fg-3">
        Effective {EFFECTIVE_DATE}
      </p>
    </header>
  );
}

function PlainEnglishSummary() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
        What you and SafeShip agree to
      </h2>
      <p className="text-fg-2">
        The full legal Terms of Service is below. This is the actual
        agreement in human language. If the two ever disagree, the legal
        text wins, but they shouldn&apos;t disagree.
      </p>

      <div className="overflow-hidden rounded-xl border border-line">
        <SummaryRow
          label="What you get"
          detail="A SafeShip account, one or more projects, unlimited agent traces, the auto-suggest engine, the deploy-gating GitHub Action, email + Slack alerts, dashboard + tests + suggestions screens. Pricing terms on /pricing."
        />
        <SummaryRow
          label="What you pay"
          detail={
            <>
              $29.99 / month, flat, no per-seat or per-trace fees. 7-day
              free trial with card on file. We charge nothing if you
              cancel before day 7. After day 7, we auto-charge $29.99 /
              month until you cancel. No refunds on partial months. Manage
              billing at <Link href="/app/billing" className="text-accent hover:text-[#d3ff85]">/app/billing</Link>.
            </>
          }
        />
        <SummaryRow
          label="What you promise us"
          detail="You won't try to break, scrape, or abuse the service. You won't use it for illegal stuff or to violate other people's rights. You keep your API key secret. You're 18+ or have a guardian's permission."
        />
        <SummaryRow
          label="What we promise you"
          detail={
            <>
              We&apos;ll run the service per the SLA targets on{" "}
              <Link href="/status" className="text-accent hover:text-[#d3ff85]">
                /status
              </Link>
              . We&apos;ll handle your data per the{" "}
              <Link href="/privacy" className="text-accent hover:text-[#d3ff85]">
                Privacy Policy
              </Link>
              . We&apos;ll email you about incidents within 72h. We
              won&apos;t use your trace data to train AI models or sell
              it to third parties.
            </>
          }
        />
        <SummaryRow
          label="What we don't promise"
          detail="That the service is bug-free, that LLM-suggested regression tests are perfect, that we'll never have outages, or that we'll never change the product. Standard SaaS limitations of liability apply (Termly text below has the formal version)."
        />
        <SummaryRow
          label="How to cancel"
          detail={
            <>
              From{" "}
              <Link href="/app/billing" className="text-accent hover:text-[#d3ff85]">
                /app/billing
              </Link>
              , which opens the Stripe customer portal. One click, no
              retention loop, no email required. You keep access until
              the current billing period ends.
            </>
          }
        />
        <SummaryRow
          label="If we shut down"
          detail="We'll give you 30 days notice + export tools to pull your trace data and accepted tests as JSON. No customer's data dies with the company."
          last
        />
      </div>
    </section>
  );
}

function TermlyPlaceholder() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
        Full legal Terms of Service
      </h2>
      <div
        className="rounded-xl border p-6 text-[13.5px] text-fg-2"
        style={{
          background: "rgba(245,193,74,0.06)",
          borderColor: "rgba(245,193,74,0.28)",
        }}
      >
        <p className="mb-2">
          <b className="text-fg">Placeholder.</b> The legally-vetted Terms
          of Service will be generated by{" "}
          <a
            href="https://termly.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-[#d3ff85]"
          >
            Termly
          </a>{" "}
          and embedded here before SafeShip charges any real customer.
        </p>
        <p className="text-[13px] text-fg-3">
          Until then, the plain-English summary above is the operative
          agreement between you and SafeShip, and the founder stands
          behind it personally.
        </p>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-6">
      <h2 className="mb-2 text-[15px] font-semibold uppercase tracking-[0.12em] text-fg-3">
        Questions
      </h2>
      <p className="text-fg-2">
        Email{" "}
        <a
          href="mailto:founder@safeship.dev"
          className="text-accent hover:text-[#d3ff85]"
        >
          founder@safeship.dev
        </a>
        .
      </p>
    </section>
  );
}

function SummaryRow({
  label,
  detail,
  last,
}: {
  label: string;
  detail: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[200px_1fr] sm:gap-6 ${
        last ? "" : "border-b border-line"
      }`}
    >
      <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-fg-4">
        {label}
      </span>
      <p className="text-[14px] leading-[1.55] text-fg-2">{detail}</p>
    </div>
  );
}
