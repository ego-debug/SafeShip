export function HowItWorks() {
  return (
    <section id="how" className="relative pb-10 pt-24">
      <div className="mb-14 flex max-w-[720px] flex-col gap-3.5">
        <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent"
            style={{ boxShadow: "0 0 8px rgba(194,249,112,0.6)" }}
          />
          How it works
        </span>
        <h2 className="text-[clamp(28px,3.2vw,40px)] font-semibold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">
          From install to deploy&nbsp;gating in five&nbsp;minutes.
        </h2>
        <p className="max-w-[560px] text-[16.5px] text-fg-2">
          Three steps. No agents to babysit, no dashboards to configure, no
          Slack channel to ignore.
        </p>
      </div>

      <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-[18px]">
        <span
          className="pointer-events-none absolute hidden h-px md:block"
          style={{
            top: "56px",
            left: "8%",
            right: "8%",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 20%, rgba(255,255,255,0.12) 80%, transparent)",
          }}
          aria-hidden="true"
        />

        <StepCard
          step="01"
          tag="INSTALL"
          title="Drop in 4 lines."
          desc="Install the SDK and wrap your agent. Done."
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <polyline points="9 6 4 12 9 18" />
              <polyline points="15 6 20 12 15 18" />
            </svg>
          }
          visual={
            <div className="overflow-hidden rounded-lg border border-line bg-black/35 px-3.5 py-3 font-mono text-xs leading-[1.6]">
              <div className="flex gap-3">
                <span className="w-2.5 flex-none select-none text-right text-fg-4">1</span>
                <span className="overflow-hidden text-ellipsis whitespace-pre text-fg">
                  <span className="text-[#c084fc]">import</span>
                  {" { "}
                  <span className="text-[#7dd3fc]">safeship</span>
                  {" } "}
                  <span className="text-[#c084fc]">from</span>{" "}
                  <span className="text-accent">&quot;safeship&quot;</span>
                </span>
              </div>
              <div className="flex gap-3">
                <span className="w-2.5 flex-none select-none text-right text-fg-4">2</span>
                <span className="whitespace-pre"> </span>
              </div>
              <div className="flex gap-3">
                <span className="w-2.5 flex-none select-none text-right text-fg-4">3</span>
                <span className="overflow-hidden text-ellipsis whitespace-pre text-fg">
                  <span className="text-[#c084fc]">export const</span>{" "}
                  <span className="text-[#fde68a]">agent</span> ={" "}
                  <span className="text-[#7dd3fc]">safeship</span>(
                  <span className="text-[#fde68a]">myAgent</span>)
                </span>
              </div>
            </div>
          }
        />

        <StepCard
          step="02"
          tag="RUN"
          title="We trace every run."
          desc="Every LLM call, every tool, every retry — auto-captured. No safeship.step() boilerplate."
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <polyline points="3 12 7 12 9 6 13 18 15 12 21 12" />
            </svg>
          }
          visual={
            <div>
              <div className="flex items-center gap-3 px-0.5 py-1">
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-fg-3">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
                  live
                </span>
                <span className="flex h-7 flex-1 items-end gap-[3px]">
                  {[30, 55, 42, 78, 60, 88, 64, 95, 72, 50, 68, 82, 58, 74, 46, 90, 66, 80].map((h, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-sm opacity-85"
                      style={{
                        height: `${h}%`,
                        background:
                          "linear-gradient(180deg, rgba(194,249,112,0.9), rgba(194,249,112,0.35))",
                      }}
                    />
                  ))}
                </span>
              </div>
              <div className="mt-2.5 flex justify-between font-mono text-[11px] text-fg-3">
                <span>
                  <b className="font-medium text-fg-2">4,829</b> runs today
                </span>
                <span>
                  p95 <b className="font-medium text-fg-2">312ms</b>
                </span>
              </div>
            </div>
          }
        />

        <StepCard
          step="03"
          tag="CATCH"
          title="Block the second time."
          desc="The first failure is yours to fix. After that, your PR fails any time it would ship the same bug again."
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M12 3 4 6v6c0 4.5 3.5 8 8 9 4.5-1 8-4.5 8-9V6l-8-3z" />
            </svg>
          }
          visual={
            <div>
              <div className="mb-2.5 flex items-center gap-2.5 font-mono text-xs">
                <span className="text-fg-3">#284</span>
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-fg">
                  feat: switch to gpt-5.1-mini
                </span>
              </div>
              <div className="mb-1.5 flex items-center gap-2 font-mono text-[11px] text-fg-3">
                <span
                  className="grid h-3 w-3 place-items-center rounded-full text-[8px] text-accent"
                  style={{ background: "rgba(194,249,112,0.15)" }}
                >
                  ✓
                </span>
                tests · 142 passed
              </div>
              <div className="mb-3 flex items-center gap-2 font-mono text-[11px] text-fg-3">
                <span
                  className="grid h-3 w-3 place-items-center rounded-full text-[8px] text-accent"
                  style={{ background: "rgba(194,249,112,0.15)" }}
                >
                  ✓
                </span>
                typecheck
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs font-medium"
                style={{
                  background: "rgba(255,107,107,0.10)",
                  borderColor: "rgba(255,107,107,0.32)",
                  color: "#ff8a8a",
                }}
              >
                <span
                  className="grid h-3.5 w-3.5 place-items-center rounded-full text-[9px] font-bold"
                  style={{
                    background: "rgba(255,107,107,0.18)",
                    color: "#ff8a8a",
                  }}
                >
                  ✕
                </span>
                safeship · blocked
              </span>
            </div>
          }
        />
      </div>
    </section>
  );
}

function StepCard({
  step,
  tag,
  title,
  desc,
  icon,
  visual,
}: {
  step: string;
  tag: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  visual: React.ReactNode;
}) {
  return (
    <article
      className="relative z-10 flex flex-col rounded-2xl border border-line-strong p-[22px] transition-all hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.18)]"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.5)",
      }}
    >
      <header className="mb-6 flex items-center justify-between">
        <span
          className="grid h-9 w-9 place-items-center rounded-[9px] border border-line-strong text-fg"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          {icon}
        </span>
        <span className="font-mono text-[11px] tracking-[0.16em] text-fg-4">
          <b className="font-medium text-fg-2">{step}</b> &nbsp;{tag}
        </span>
      </header>
      <h3 className="mb-2.5 text-[22px] font-semibold leading-[1.15] tracking-[-0.02em]">
        {title}
      </h3>
      <p className="mb-5 text-[14.5px] leading-[1.55] text-fg-2 [text-wrap:pretty]">
        {desc}
      </p>
      <div className="mt-auto border-t border-dashed border-line pt-4">
        {visual}
      </div>
    </article>
  );
}
