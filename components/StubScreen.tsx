import Link from "next/link";

export function StubScreen({
  eyebrow,
  title,
  stage,
  prototypeHref,
}: {
  eyebrow: string;
  title: string;
  stage: string;
  prototypeHref: string;
}) {
  return (
    <main className="grid place-items-center py-24">
      <div
        className="flex max-w-xl flex-col gap-5 rounded-2xl border border-line-strong p-8"
        style={{
          background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -28px rgba(0,0,0,0.6)",
        }}
      >
        <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent"
            style={{ boxShadow: "0 0 8px rgba(194,249,112,0.6)" }}
          />
          {eyebrow}
        </span>
        <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.025em]">
          {title}
        </h1>
        <p className="text-fg-2">
          This screen is real in the design prototype but hasn&apos;t been ported
          to React yet. That ships in <b className="text-fg">{stage}</b>.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={prototypeHref}
            className="inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4),0_10px_24px_-10px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
          >
            View HTML prototype →
          </a>
          <Link
            href="/app/onboarding"
            className="text-sm text-fg-3 hover:text-fg-2"
          >
            ← back to setup
          </Link>
        </div>
      </div>
    </main>
  );
}
