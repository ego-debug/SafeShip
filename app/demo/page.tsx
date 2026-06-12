import Link from "next/link";
import type { Metadata } from "next";
import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { ScoreChart } from "@/components/dashboard/ScoreChart";
import { getDemoData, type DemoStep } from "@/lib/demo";

// Refresh at most every 10 minutes — the demo project changes rarely and
// this keeps the page fast and resilient under booth traffic.
export const revalidate = 600;

export const metadata: Metadata = {
  title: "Live demo — SafeShip",
  description:
    "A real SafeShip dashboard: production agent traces, a caught failure, and the regression test that was suggested from it. No signup needed.",
};

export default async function DemoPage() {
  const demo = await getDemoData();

  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />
        <main className="flex flex-col gap-14 py-12">
          <header className="flex max-w-2xl flex-col gap-3">
            <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Live demo · no signup
            </span>
            <h1 className="text-[clamp(30px,4vw,44px)] font-semibold leading-[1.08] tracking-[-0.025em]">
              This is a real SafeShip project.
            </h1>
            <p className="text-[15px] leading-relaxed text-fg-2">
              A customer-support agent ran in production all week. Below is
              exactly what its developer sees: the health of every run, the
              moment it lied to a customer, and the regression test SafeShip
              wrote from that failure.
            </p>
          </header>

          {!demo ? (
            <DemoUnavailable />
          ) : (
            <>
              <section className="flex flex-col gap-4">
                <SectionTitle
                  step="1"
                  title="The week at a glance"
                  body={`${demo.snapshot.totalRuns} runs in the last 7 days. The dip is the day the agent started failing.`}
                />
                <div
                  className="rounded-2xl border border-line-strong p-5"
                  style={{ background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)" }}
                >
                  <ScoreChart series={demo.snapshot.scoreSeries} />
                </div>
              </section>

              {demo.failedRun && (
                <section className="flex flex-col gap-4">
                  <SectionTitle
                    step="2"
                    title="The failure, step by step"
                    body="No exception was thrown. The agent completed 'successfully' — and invented a $249.00 refund on a $24.99 order. Logging tools call this run fine."
                  />
                  <ol className="flex flex-col gap-2.5">
                    {demo.failedRun.steps.map((s) => (
                      <DemoStepCard key={s.id} step={s} />
                    ))}
                  </ol>
                </section>
              )}

              <section className="flex flex-col gap-4">
                <SectionTitle
                  step="3"
                  title="The test SafeShip suggested"
                  body="Generated from the trace above. The developer reads it in plain English, taps accept, and this exact failure can never ship again."
                />
                <div
                  className="grid gap-0 overflow-hidden rounded-2xl border border-line-strong md:grid-cols-2"
                  style={{ background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)" }}
                >
                  <div className="flex flex-col gap-3 border-b border-line p-6 md:border-b-0 md:border-r">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-4">
                        Plain English
                      </span>
                      {demo.suggestion.severity && (
                        <span className="rounded-full border border-[rgba(255,99,99,0.3)] bg-[rgba(255,99,99,0.08)] px-2 py-[2px] font-mono text-[10.5px] uppercase text-[#ff9c9c]">
                          {demo.suggestion.severity}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[13px] text-fg-3">{demo.suggestion.name}</p>
                    <p className="text-[15px] leading-relaxed text-fg">
                      {demo.suggestion.plain_english}
                    </p>
                    {demo.suggestion.rationale && (
                      <p className="text-[13px] leading-relaxed text-fg-3">
                        {demo.suggestion.rationale}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 p-6">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-4">
                      The test itself
                    </span>
                    <pre className="overflow-x-auto rounded-lg border border-line bg-[rgba(0,0,0,0.35)] p-4 font-mono text-[12.5px] leading-relaxed text-accent">
                      {demo.suggestion.code_yaml}
                    </pre>
                    <Link
                      href="/sign-up"
                      className="mt-auto inline-flex w-fit items-center gap-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.35)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
                    >
                      Accept tests like this on your agent →
                    </Link>
                  </div>
                </div>
              </section>

              <section
                className="flex flex-col items-start gap-4 rounded-2xl border border-line-strong p-8 md:flex-row md:items-center md:justify-between"
                style={{ background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)" }}
              >
                <div className="flex max-w-lg flex-col gap-1.5">
                  <h2 className="text-xl font-semibold tracking-tight">
                    Your agent could be on this dashboard in 5 minutes.
                  </h2>
                  <p className="text-[14px] text-fg-3">
                    Four lines of code. $29.99/month flat, 7-day free trial.
                    The same bug never ships twice.
                  </p>
                </div>
                <Link
                  href="/sign-up"
                  className="shrink-0 rounded-[9px] bg-fg px-5 py-3 text-sm font-semibold text-bg shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] transition hover:-translate-y-px hover:bg-white"
                >
                  Start free trial
                </Link>
              </section>
            </>
          )}
        </main>
        <Footer />
      </div>
    </>
  );
}

function SectionTitle({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <span className="grid h-6 w-6 place-items-center rounded-full border border-[rgba(194,249,112,0.35)] bg-[rgba(194,249,112,0.08)] font-mono text-[12px] text-accent">
          {step}
        </span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="max-w-2xl text-[14px] leading-relaxed text-fg-3">{body}</p>
    </div>
  );
}

function DemoStepCard({ step }: { step: DemoStep }) {
  const failed = step.status === "fail";
  return (
    <li
      className={`rounded-xl border p-4 ${
        failed ? "border-[rgba(255,99,99,0.4)]" : "border-line-strong"
      }`}
      style={{
        background: failed
          ? "linear-gradient(180deg, rgba(255,99,99,0.05) 0%, #0c0c0e 100%)"
          : "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`h-2 w-2 rounded-full ${
            failed ? "bg-danger" : step.status === "warn" ? "bg-[#f5c14a]" : "bg-accent"
          }`}
        />
        <span className="font-mono text-[13px] text-fg">{step.tool_name ?? "(step)"}</span>
        <span className="font-mono text-[10.5px] uppercase tracking-wide text-fg-4">
          {step.kind ?? "?"}
        </span>
        {step.duration_ms != null && (
          <span className="ml-auto font-mono text-[11px] text-fg-4">{step.duration_ms}ms</span>
        )}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <KV label="input" value={step.input} />
        <KV label="output" value={step.output} emphasize={failed} />
      </div>
      {failed && (
        <p className="mt-3 rounded-lg border border-[rgba(255,99,99,0.3)] bg-[rgba(255,99,99,0.06)] px-3 py-2 text-[13px] text-[#ff9c9c]">
          {JSON.stringify(step.output ?? "").includes("$249.00") ? (
            <>
              What went wrong: the reply invents a <b>$249.00</b> refund. The
              order total two steps earlier was <b>$24.99</b>.
            </>
          ) : (
            <>
              What went wrong: this step's output contradicts what an earlier
              tool returned. SafeShip flags the run and suggests a test below.
            </>
          )}
        </p>
      )}
    </li>
  );
}

function KV({ label, value, emphasize }: { label: string; value: unknown; emphasize?: boolean }) {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text && text.length > 220) text = text.slice(0, 220) + "…";
  return (
    <div className="min-w-0">
      <span className="font-mono text-[10.5px] uppercase tracking-wide text-fg-4">{label}</span>
      <pre
        className={`mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-line bg-[rgba(0,0,0,0.3)] px-2.5 py-1.5 font-mono text-[12px] leading-relaxed ${
          emphasize ? "text-[#ffb4b4]" : "text-fg-2"
        }`}
      >
        {text || "(none)"}
      </pre>
    </div>
  );
}

function DemoUnavailable() {
  return (
    <section
      className="grid place-items-center rounded-2xl border border-dashed border-line-strong py-16 text-center"
      style={{ background: "rgba(255,255,255,0.015)" }}
    >
      <div className="flex max-w-md flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          The live demo is taking a breather.
        </h2>
        <p className="text-fg-2">
          Start a free trial and your own dashboard will be live in five
          minutes — that's the better demo anyway.
        </p>
        <Link
          href="/sign-up"
          className="mx-auto mt-2 inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
        >
          Start free trial →
        </Link>
      </div>
    </section>
  );
}
