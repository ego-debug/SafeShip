import Link from "next/link";
import { Background } from "@/components/Background";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

/**
 * Shared chrome for every quickstart page under /docs/quickstart/<platform>.
 * Keeps the visual rhythm identical across Cursor / Lovable / Claude Code /
 * n8n so they read as a family, while the per-platform content stays
 * tightly tailored to that stack's realities.
 */
export function QuickstartShell({
  platform,
  tagline,
  estMinutes,
  children,
}: {
  platform: string;
  tagline: string;
  estMinutes: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />
        <main className="py-14">
          <header className="mb-10 flex flex-col gap-3 border-b border-line pb-10">
            <Link
              href="/docs"
              className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-3 transition-colors hover:text-fg-2"
            >
              <span className="text-fg-4">←</span> Quickstarts
            </Link>
            <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-accent">
              <span
                className="h-1.5 w-1.5 rounded-full bg-accent"
                style={{ boxShadow: "0 0 8px rgba(194,249,112,0.6)" }}
              />
              SafeShip × {platform}
            </span>
            <h1 className="text-[clamp(30px,3.5vw,42px)] font-semibold leading-[1.05] tracking-[-0.025em] [text-wrap:balance]">
              {tagline}
            </h1>
            <p className="text-[13px] font-mono uppercase tracking-[0.12em] text-fg-4">
              ~{estMinutes} min · ends with a green trace on your dashboard
            </p>
          </header>

          <article className="flex flex-col gap-10">{children}</article>

          <footer className="mt-16 border-t border-line pt-8">
            <p className="text-sm text-fg-3">
              Full setup reference, every config option, troubleshooting →{" "}
              <Link
                href="/docs"
                className="text-accent transition-colors hover:text-[#d3ff85]"
              >
                docs home
              </Link>
              . Stuck?{" "}
              <a
                href="mailto:founder@safeship.dev"
                className="text-accent transition-colors hover:text-[#d3ff85]"
              >
                founder@safeship.dev
              </a>
              . Solo founder, replies same day.
            </p>
          </footer>
        </main>
        <Footer />
      </div>
    </>
  );
}

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 scroll-mt-24">
      <header className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-4">
          Step 0{n}
        </span>
        <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">
          {title}
        </h2>
      </header>
      <div className="flex flex-col gap-3 text-[15px] leading-[1.6] text-fg-2">
        {children}
      </div>
    </section>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <pre
      className="overflow-x-auto rounded-lg border border-line p-4 font-mono text-[12.5px] leading-[1.7] text-fg"
      style={{ background: "rgba(0,0,0,0.4)" }}
    >
      <code>{children}</code>
    </pre>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded border border-line bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[12.5px] text-fg">
      {children}
    </code>
  );
}

/**
 * The hero element of each quickstart: a paste-ready prompt the user can
 * drop into Cursor / Claude Code / Lovable's AI chat to have *that tool*
 * do the SafeShip wiring. This is the moment the quickstart pays off -
 * the user doesn't even have to read code, they hand the work back to
 * the AI tool that wrote their agent in the first place.
 */
export function PasteIntoAI({
  toolName,
  prompt,
}: {
  toolName: string;
  prompt: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-line-strong"
      style={{
        background:
          "linear-gradient(180deg, rgba(194,249,112,0.04) 0%, rgba(255,255,255,0.015) 100%)",
      }}
    >
      <div
        className="flex items-center justify-between border-b border-line px-4 py-2.5"
        style={{ background: "rgba(0,0,0,0.20)" }}
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-3">
          Paste into {toolName}
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
          ↘ have the AI do the wiring
        </span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] text-fg">
        <code>{prompt}</code>
      </pre>
    </div>
  );
}
