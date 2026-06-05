import Link from "next/link";
import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata = {
  title: "Privacy · SafeShip",
  description:
    "What SafeShip collects, where it lives, who has access, and how to delete it. Plain-English summary + the full legal Privacy Policy.",
};

// Bump this when material changes happen. Surfaced in the page header
// so customers can see at a glance when the policy was last revised.
const EFFECTIVE_DATE = "June 5, 2026";

export default function PrivacyPage() {
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
          style={{ boxShadow: "0 0 8px rgba(194,249,112,0.6)" }}
        />
        Privacy
      </span>
      <h1 className="text-[clamp(32px,4vw,48px)] font-semibold leading-[1.05] tracking-[-0.03em]">
        What we collect, where it lives, how to delete it.
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
        The plain-English summary
      </h2>
      <p className="text-fg-2">
        The full legal Privacy Policy is below. This is what it actually
        means in practice. If the two ever disagree, the legal text wins —
        but they shouldn&apos;t disagree, and if you spot a gap email{" "}
        <a
          href="mailto:founder@safeship.dev"
          className="text-accent hover:text-[#d3ff85]"
        >
          founder@safeship.dev
        </a>{" "}
        and we&apos;ll fix it.
      </p>

      <div className="overflow-hidden rounded-xl border border-line">
        <SummaryRow
          label="What we collect"
          detail={
            <>
              Whatever your agent passes into{" "}
              <code className="rounded border border-line bg-black/40 px-1 py-0.5 font-mono text-[12px]">safeship.wrap()</code>{" "}
              — inputs, outputs, step metadata, durations. Plus the
              Anthropic / OpenAI HTTP requests + responses your agent
              makes (so we can build regression tests from them). Your
              email via Clerk auth. Billing details via Stripe.
            </>
          }
        />
        <SummaryRow
          label="What we never collect"
          detail={
            <>
              Your LLM provider API keys (Anthropic, OpenAI, etc.) —
              those stay in your env vars and your agent talks to the
              provider directly. Your agent source code. Anything you
              don&apos;t explicitly hand to the SDK.
            </>
          }
        />
        <SummaryRow
          label="Where it lives"
          detail="Supabase (Postgres, US region). Stripe holds billing details on their infra. Clerk holds identity. We don't store your card number anywhere."
        />
        <SummaryRow
          label="Who has access"
          detail="The founder (one person). Sub-processors listed on /security have access to the data they handle on our behalf. No third-party data sales, no advertising trackers, no analytics SDKs beyond Vercel's first-party metrics."
        />
        <SummaryRow
          label="Cookies"
          detail="The Clerk authentication session cookie. That's it. No marketing cookies, no third-party trackers."
        />
        <SummaryRow
          label="How to delete your data"
          detail={
            <>
              Email{" "}
              <a
                href="mailto:founder@safeship.dev"
                className="text-accent hover:text-[#d3ff85]"
              >
                founder@safeship.dev
              </a>{" "}
              with your account email. We&apos;ll purge your account,
              projects, traces, tests, and billing history within 7 days
              and send confirmation. No retention guarantees, no
              &quot;backup tapes&quot; nonsense.
            </>
          }
          last
        />
      </div>

      <p className="text-[13.5px] text-fg-3">
        For the architectural details (what runs on our servers vs. your
        CI, how customer code is isolated), see{" "}
        <Link href="/security" className="text-accent hover:text-[#d3ff85]">
          /security
        </Link>
        .
      </p>
    </section>
  );
}

function TermlyPlaceholder() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
        Full legal Privacy Policy
      </h2>
      <div
        className="rounded-xl border p-6 text-[13.5px] text-fg-2"
        style={{
          background: "rgba(245,193,74,0.06)",
          borderColor: "rgba(245,193,74,0.28)",
        }}
      >
        <p className="mb-2">
          <b className="text-fg">Placeholder.</b> The legally-vetted Privacy
          Policy will be generated by{" "}
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
          description of how SafeShip handles your data, and the founder
          stands behind it personally.
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
        . Solo founder, same-day reply usually.
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
