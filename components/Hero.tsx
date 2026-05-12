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
          The same bug never{" "}
          <span className="underline-highlight whitespace-nowrap">ships</span>{" "}
          twice.
        </h1>

        <p
          className="mb-8 max-w-[540px] animate-rise text-lg leading-[1.5] text-fg-2 [text-wrap:pretty]"
          style={{ animationDelay: "0.2s" }}
        >
          Every production failure becomes a regression test. Drop in a
          4-line SDK — SafeShip captures the trace, writes the assertion,
          and blocks any future deploy that would reproduce it.
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
          <span className="font-mono text-xs">$29/mo · no seats · cancel before day 7 = $0 charged</span>
        </div>
      </div>

      <CodePanel />
    </section>
  );
}

