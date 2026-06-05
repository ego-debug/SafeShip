import Link from "next/link";
import { CodePanel } from "./CodePanel";

export function Hero() {
  return (
    <section className="grid grid-cols-1 items-start gap-14 pb-14 pt-[88px] md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:items-center md:gap-16">
      <div>
        <div
          className="mb-7 inline-flex animate-rise items-center gap-2.5 rounded-full border border-line-strong py-[5px] pl-3 pr-[5px] text-[12.5px] text-fg-2"
          style={{ background: "rgba(255,255,255,0.02)", animationDelay: "0.05s" }}
        >
          <span
            className="rounded-full px-2 py-[3px] font-mono text-[11px] tracking-wide text-accent"
            style={{ background: "rgba(194,249,112,0.12)" }}
          >
            LIVE
          </span>
          <span>7-day free trial · card required · cancel anytime</span>
          <span className="mx-1.5 text-fg-3">→</span>
        </div>

        <h1
          className="mb-[22px] animate-rise text-[clamp(40px,5.6vw,68px)] font-semibold leading-[1.02] tracking-[-0.035em] text-fg [text-wrap:balance]"
          style={{ animationDelay: "0.12s" }}
        >
          Your agent shouldn&apos;t fail in front of{" "}
          <span className="underline-highlight whitespace-nowrap">users</span>.
        </h1>

        <p
          className="mb-4 max-w-[560px] animate-rise text-lg leading-[1.5] text-fg-2 [text-wrap:pretty]"
          style={{ animationDelay: "0.2s" }}
        >
          Reliability for the AI agent you built with Cursor, Lovable,
          Claude Code, or n8n. SafeShip catches the failure the first time
          it hits production, writes the test in one tap, and blocks every
          future PR that would reproduce the same bug.
        </p>

        <p
          className="mb-8 max-w-[540px] animate-rise text-[13.5px] leading-[1.5] text-fg-3"
          style={{ animationDelay: "0.24s" }}
        >
          Managed. One-tap approve. <b className="text-fg-2">$29.99 flat</b> — no seats, no metering, no infra to run.
        </p>

        <div
          className="mb-7 flex animate-rise flex-wrap items-center gap-2.5"
          style={{ animationDelay: "0.28s" }}
        >
          <Link
            href="/sign-up"
            className="rounded-[9px] bg-accent px-[18px] py-3 text-[14.5px] font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4),0_10px_24px_-10px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
          >
            Start 7-day free trial →
          </Link>
          <a
            href="#how"
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-line-strong px-[18px] py-3 text-[14.5px] text-fg transition-colors hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.03)]"
          >
            See how it works
            <span className="ml-1.5 font-mono text-[11.5px] text-fg-3">90s</span>
          </a>
        </div>

        <div
          className="flex animate-rise flex-wrap items-center gap-2 text-[13px] text-fg-3"
          style={{ animationDelay: "0.36s" }}
        >
          <span className="font-mono text-xs">$29.99/mo · no seats · cancel before day 7 = $0 charged</span>
        </div>
      </div>

      <CodePanel />
    </section>
  );
}

