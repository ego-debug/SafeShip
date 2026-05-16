import Link from "next/link";
import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata = {
  title: "Security · SafeShip",
  description:
    "How SafeShip handles your data. Customer code runs in your CI, not on our servers. We never see your LLM provider keys. Honest scope from a 1-person company.",
};

export default function SecurityPage() {
  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />

        <main className="flex flex-col gap-16 py-16">
          <Hero />
          <Architecture />
          <DataTable />
          <Subprocessors />
          <Incidents />
          <Roadmap />
          <Honest />
          <Contact />
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
        Security
      </span>
      <h1 className="text-[clamp(34px,5vw,56px)] font-semibold leading-[1.04] tracking-[-0.03em] [text-wrap:balance]">
        Your code runs in your CI. Your keys stay on your machine.
      </h1>
      <p className="max-w-[680px] text-lg text-fg-2">
        SafeShip is built so a breach of our database never gives an attacker
        the ability to run your agent or impersonate your LLM account. This
        page describes exactly what we store, what we don&apos;t, and where
        the boundary lives — written by the founder, no security-theater
        vocabulary.
      </p>
    </header>
  );
}

function Architecture() {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        Where the trust boundary sits
      </h2>
      <p className="text-fg-2">
        Most observability and eval tools take your LLM provider keys, your
        agent code, or both — and execute them on the vendor&apos;s
        infrastructure. SafeShip deliberately does neither.
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="What runs on SafeShip">
          <ul className="list-disc pl-5 [&>li]:mb-1.5">
            <li>The marketing site (this page).</li>
            <li>
              The signed-in dashboard at{" "}
              <Link
                href="/app/dashboard"
                className="text-accent hover:text-[#d3ff85]"
              >
                /app/*
              </Link>
              .
            </li>
            <li>
              The trace ingest endpoint at{" "}
              <Mono>POST /v1/traces</Mono>.
            </li>
            <li>
              The auto-suggest engine — Claude reads anonymized trace data
              and proposes a YAML assertion. <b className="text-fg">No
              re-execution of your code.</b>
            </li>
            <li>
              The manifest endpoint at <Mono>GET /v1/tests/manifest</Mono>{" "}
              that serves your accepted tests to your CI.
            </li>
          </ul>
        </Card>

        <Card title="What runs on your machine / your CI">
          <ul className="list-disc pl-5 [&>li]:mb-1.5">
            <li>
              <b className="text-fg">Your agent itself.</b> The SDK wraps
              your function in your process; we never proxy or re-host it.
            </li>
            <li>
              <b className="text-fg">Every regression test replay.</b> The
              SafeShip GitHub Action runs <i>your</i> agent under{" "}
              <i>your</i> credentials inside <i>your</i> runner. SafeShip
              servers never invoke your code.
            </li>
            <li>
              <b className="text-fg">Every LLM call.</b> Your agent talks
              directly to your provider (Anthropic, OpenAI, etc.) with your
              own keys. We don&apos;t proxy LLM traffic and never see those
              keys.
            </li>
          </ul>
        </Card>
      </div>

      <p className="text-[13.5px] text-fg-3">
        Practical implication: if SafeShip&apos;s database is breached
        tomorrow, an attacker gets your historical trace metadata. They do
        not get the ability to call your LLM provider, modify your agent
        code, or push to your repo. That isolation is structural — by
        design, not by promise.
      </p>
    </section>
  );
}

function DataTable() {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        What we store, what we don&apos;t
      </h2>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-[13.5px]">
          <thead className="border-b border-line bg-[rgba(255,255,255,0.02)] font-mono text-[11px] uppercase tracking-wide text-fg-4">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Stored?</th>
              <th className="px-4 py-3">Where</th>
            </tr>
          </thead>
          <tbody className="text-fg-2 [&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-b-0">
            <DataRow
              data="Your LLM provider keys (Anthropic, OpenAI, etc.)"
              stored={<Cross>Never. We never see them.</Cross>}
              where="Stays in your env vars / your secrets manager."
            />
            <DataRow
              data="Your agent's source code"
              stored={<Cross>Never.</Cross>}
              where="Stays in your repo and your runtime."
            />
            <DataRow
              data="Trace inputs and outputs"
              stored={<Check>Yes — that's the product.</Check>}
              where={
                <>
                  Supabase Postgres (US region). You control what your agent
                  passes to <Mono>safeship.step()</Mono> — redact upstream
                  if the content is sensitive.
                </>
              }
            />
            <DataRow
              data="Trace metadata (timestamps, durations, status)"
              stored={<Check>Yes.</Check>}
              where="Supabase Postgres (US region)."
            />
            <DataRow
              data="Accepted regression tests (YAML + replay fixture)"
              stored={<Check>Yes — served to your CI on demand.</Check>}
              where="Supabase Postgres (US region)."
            />
            <DataRow
              data="Your SafeShip API key (sk_live_*)"
              stored={<Check>Yes, hashed for verification only.</Check>}
              where={
                <>
                  Supabase Postgres. Rotate from{" "}
                  <Link
                    href="/app/onboarding"
                    className="text-accent hover:text-[#d3ff85]"
                  >
                    /app/onboarding
                  </Link>{" "}
                  if compromised.
                </>
              }
            />
            <DataRow
              data="Your email + Clerk-managed identity"
              stored={<Check>Yes (managed by Clerk).</Check>}
              where="Clerk (US). Used for auth + transactional email only."
            />
            <DataRow
              data="Your billing details (card, address)"
              stored={<Cross>Never on our infra.</Cross>}
              where="Stripe holds it; we get back a customer ID + subscription status."
            />
          </tbody>
        </table>
      </div>
      <p className="text-[13.5px] text-fg-3">
        The only customer-controlled content we ingest is whatever your agent
        explicitly passes into <Mono>safeship.step(...)</Mono> or the wrapped
        function&apos;s arguments. If your agent processes regulated data
        (PII, PHI, payment info), redact at the boundary before calling the
        SDK — same principle as any other observability tool.
      </p>
    </section>
  );
}

function Subprocessors() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        Sub-processors
      </h2>
      <p className="text-fg-2">
        These are the third-party services SafeShip relies on. All are major
        US-hosted vendors with their own published security postures. If
        you&apos;re evaluating SafeShip against a procurement checklist,
        their compliance pages are the direct sources to cite.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-left text-[13.5px]">
          <thead className="border-b border-line bg-[rgba(255,255,255,0.02)] font-mono text-[11px] uppercase tracking-wide text-fg-4">
            <tr>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Used for</th>
              <th className="px-4 py-3">Compliance</th>
            </tr>
          </thead>
          <tbody className="text-fg-2 [&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-b-0">
            <SubRow
              vendor="Vercel"
              use="Hosts the Next.js app + API routes"
              link="https://vercel.com/security"
            />
            <SubRow
              vendor="Supabase"
              use="Postgres database (traces, tests, accounts)"
              link="https://supabase.com/security"
            />
            <SubRow
              vendor="Clerk"
              use="Authentication + session management"
              link="https://clerk.com/security"
            />
            <SubRow
              vendor="Stripe"
              use="Billing + subscription management"
              link="https://stripe.com/docs/security"
            />
            <SubRow
              vendor="Anthropic"
              use="Powers the auto-suggest engine (reads trace data → proposes YAML)"
              link="https://trust.anthropic.com/"
            />
            <SubRow
              vendor="Resend"
              use="Transactional email (sign-up, billing notices)"
              link="https://resend.com/security"
            />
          </tbody>
        </table>
      </div>
      <p className="text-[13.5px] text-fg-3">
        We don&apos;t add new sub-processors without updating this page
        first. If you spot one missing, email{" "}
        <a
          href="mailto:founder@safeship.dev"
          className="text-accent hover:text-[#d3ff85]"
        >
          founder@safeship.dev
        </a>{" "}
        and we&apos;ll fix it the same day.
      </p>
    </section>
  );
}

function Incidents() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        Incident response
      </h2>
      <p className="text-fg-2">
        Recent events in the AI tooling category have made it clear that
        platforms holding customer credentials are concentrated targets. This
        is part of why SafeShip&apos;s architecture deliberately avoids
        holding your LLM keys or executing your code on our infra. But
        breaches happen, and we owe customers a clear posture for when they
        do.
      </p>
      <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-2">
        <li>
          <b className="text-fg">If we discover or are notified of a
          security incident affecting customer data, we email every
          potentially-affected customer within 72 hours</b> — even if the
          investigation is still in progress.
        </li>
        <li>
          <b className="text-fg">We rotate any potentially-exposed
          credentials immediately</b> (your SafeShip API keys, our
          sub-processor service tokens) and force re-issue from your
          dashboard.
        </li>
        <li>
          <b className="text-fg">We publish a postmortem within 30 days</b> —
          public, timestamped, on this page. Includes timeline, scope, root
          cause, and what we changed to prevent recurrence. No spin, no
          deletions of past status updates.
        </li>
        <li>
          <b className="text-fg">Reproducible vulnerabilities can be
          reported privately</b> to{" "}
          <a
            href="mailto:security@safeship.dev"
            className="text-accent hover:text-[#d3ff85]"
          >
            security@safeship.dev
          </a>
          . We respond within 24 hours and credit researchers in the
          postmortem (unless they prefer anonymity).
        </li>
      </ul>
    </section>
  );
}

function Roadmap() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">
        Compliance roadmap
      </h2>
      <p className="text-fg-2">
        SafeShip is a 1-person company today. Claiming SOC 2 or ISO 27001
        compliance would be a lie, and customers who care about those
        attestations should know that up front. Here&apos;s the honest
        sequence we&apos;re committed to:
      </p>
      <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
        <li>
          <b className="text-fg">At 10 paying customers</b> — engage a
          security auditor and start SOC 2 Type I observation period.
        </li>
        <li>
          <b className="text-fg">At ~25 paying customers</b> — SOC 2 Type II
          report available under NDA on request.
        </li>
        <li>
          <b className="text-fg">When EU customer demand is real</b> — add
          Supabase EU + Vercel EU regions for data-residency selection at
          sign-up. Until then, SafeShip data is US-only and we say so
          plainly so EU customers can self-select out instead of being
          surprised mid-buy.
        </li>
        <li>
          <b className="text-fg">HIPAA / BAA</b> — not on the roadmap.
          Don&apos;t pass PHI through SafeShip; redact at the boundary.
        </li>
      </ul>
    </section>
  );
}

function Honest() {
  return (
    <section className="rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-6">
      <h2 className="mb-3 text-[15px] font-semibold uppercase tracking-[0.12em] text-fg-3">
        Honest scope
      </h2>
      <p className="mb-2 text-fg-2">
        SafeShip is one person, building a focused product. Here&apos;s what
        that means in security terms:
      </p>
      <ul className="list-disc pl-5 text-fg-2 [&>li]:mb-1.5">
        <li>
          The architecture is the security story. We minimize what we hold
          rather than promise to defend a large attack surface.
        </li>
        <li>
          We use mature managed services (Vercel, Supabase, Clerk, Stripe)
          rather than rolling our own auth, key storage, or payment
          infrastructure.
        </li>
        <li>
          We don&apos;t have a 24/7 SOC. Detection and response are best-
          effort during waking hours; alerts go to the founder&apos;s phone
          and email.
        </li>
        <li>
          If you need a tool with a Trust Center, dedicated CISO, and signed
          BAA today, SafeShip is not yet the right fit. Email and we&apos;ll
          tell you honestly.
        </li>
      </ul>
    </section>
  );
}

function Contact() {
  return (
    <section className="flex flex-col items-start gap-3">
      <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">
        Questions or vulnerability reports
      </h2>
      <p className="text-fg-2">
        General security questions:{" "}
        <a
          href="mailto:founder@safeship.dev"
          className="text-accent hover:text-[#d3ff85]"
        >
          founder@safeship.dev
        </a>
      </p>
      <p className="text-fg-2">
        Vulnerability disclosures (private, 24-hour response):{" "}
        <a
          href="mailto:security@safeship.dev"
          className="text-accent hover:text-[#d3ff85]"
        >
          security@safeship.dev
        </a>
      </p>
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-6">
      <h3 className="text-[15px] font-semibold uppercase tracking-[0.12em] text-fg-3">
        {title}
      </h3>
      <div className="text-[14px] leading-[1.6] text-fg-2">{children}</div>
    </div>
  );
}

function DataRow({
  data,
  stored,
  where,
}: {
  data: string;
  stored: React.ReactNode;
  where: React.ReactNode;
}) {
  return (
    <tr>
      <td className="px-4 py-3 align-top font-medium text-fg">{data}</td>
      <td className="px-4 py-3 align-top">{stored}</td>
      <td className="px-4 py-3 align-top">{where}</td>
    </tr>
  );
}

function SubRow({
  vendor,
  use,
  link,
}: {
  vendor: string;
  use: string;
  link: string;
}) {
  return (
    <tr>
      <td className="px-4 py-3 align-top font-medium text-fg">{vendor}</td>
      <td className="px-4 py-3 align-top">{use}</td>
      <td className="px-4 py-3 align-top">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-[#d3ff85]"
        >
          security page →
        </a>
      </td>
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

function Cross({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-fg-4">—</span>
      <span>{children}</span>
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-line bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[12.5px] text-fg">
      {children}
    </code>
  );
}
