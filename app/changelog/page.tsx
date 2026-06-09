import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

export const metadata = {
  title: "Changelog · SafeShip",
  description:
    "What shipped, when. Every meaningful change to SafeShip, dated and in plain language.",
};

// Hand-written entries, newest first. Keep each entry to what a customer
// would notice or benefit from. No internal refactors, no filler. Dates
// are real ship dates.
const ENTRIES: Array<{
  date: string;
  title: string;
  items: string[];
}> = [
  {
    date: "2026-06-09",
    title: "Quickstarts, OSS demo, and a full polish pass",
    items: [
      "Per-platform quickstarts for Cursor, Claude Code, Lovable, and n8n. Each one hands the SafeShip wiring back to the AI tool that wrote your agent.",
      "Runnable cassette-replay demo in the repo (examples/cassette-replay). Clone, install, and watch a regression test pass with zero network and zero API keys.",
      "MIT license and contributing guide published. The Python SDK is fully open source.",
      "Offline eval set for the suggest engine: 12 grounded failure cases across 4 failure types, scored on 5 dimensions before any prompt change ships.",
      "Suggestions queue: the review count now ticks down live, double-clicking Accept can no longer create duplicate tests, and every error message is a sentence a person can act on.",
      "Dashboard polls lighter (4s visible, 20s in background tabs) and loads one database round-trip faster.",
    ],
  },
  {
    date: "2026-06-05",
    title: "Suggest loop, front and center",
    items: [
      "Landing page shows the actual accept-a-test moment: a stacked suggestion queue with plain English on the left and the YAML test on the right.",
      "Onboarding success state now points you straight at the suggestions queue with a preview of what a drafted test looks like.",
      "Suggestion review cards redesigned: plain-English description and the exact YAML side by side, severity chip, keyboard shortcuts.",
      "Privacy and Terms pages published with plain-English summary tables.",
    ],
  },
  {
    date: "2026-05-16",
    title: "Free CI replay (cassettes)",
    items: [
      "SafeShip now records the raw request and response of every Anthropic and OpenAI call your agent makes. Accepted tests carry those recordings into CI.",
      "In CI, recorded responses replay instead of hitting the provider. Regression tests run with zero LLM spend. Three modes: cached_or_live (default), cached_only (strict), live.",
      "Auto-instrumentation: calls made with the Anthropic or OpenAI SDK are captured as trace steps with zero code changes. Opt out with SAFESHIP_AUTO_INSTRUMENT=false.",
    ],
  },
  {
    date: "2026-05-12",
    title: "Test runner and deploy gating",
    items: [
      "safeship test CLI: replays every accepted regression test against your current code and exits non-zero on failure.",
      "GitHub Action with two modes: test (replay accepted tests on every PR) and score-gate (fail the PR if the latest production run scored below threshold).",
      "Accepted tests carry the original failing input so the runner can reproduce the exact failure.",
    ],
  },
  {
    date: "2026-05-08",
    title: "Auto-suggest engine and review queue",
    items: [
      "Claude reads your failing traces and drafts the regression test that would have caught each one: a name, a plain-English description, and runnable YAML.",
      "Review queue at /app/suggestions: accept with Y, skip with N, 5-second undo on both.",
      "Failure alerts by email (and Slack webhook), throttled to one per 10 minutes and 10 per day so a flapping agent can't flood you.",
    ],
  },
  {
    date: "2026-05-02",
    title: "Traces, dashboard, and the first SDK release",
    items: [
      "Python SDK: safeship.init() plus safeship.wrap() ships a trace for every agent run from a background thread. Never blocks, never crashes your agent.",
      "Dashboard with regression score, recent runs, and recent failures. Trace detail view with a step-by-step timeline.",
      "Public ingestion endpoint at /v1/traces with per-project rate limits.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />
        <main className="py-16">
          <header className="mb-12 flex flex-col gap-3">
            <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Changelog
            </span>
            <h1 className="text-[clamp(32px,4vw,48px)] font-semibold leading-[1.05] tracking-[-0.03em]">
              What shipped, when.
            </h1>
            <p className="max-w-[560px] text-lg text-fg-2">
              Every meaningful change, dated and in plain language. If it
              isn&apos;t here, it didn&apos;t ship.
            </p>
          </header>

          <ol className="flex max-w-[760px] flex-col gap-12">
            {ENTRIES.map((e) => (
              <li key={e.date} className="grid grid-cols-1 gap-3 md:grid-cols-[130px_1fr] md:gap-8">
                <time
                  dateTime={e.date}
                  className="font-mono text-[12.5px] text-fg-3 md:pt-1"
                >
                  {formatDate(e.date)}
                </time>
                <div className="flex flex-col gap-3 border-l border-line pl-6 md:border-l-0 md:pl-0">
                  <h2 className="text-[19px] font-semibold leading-snug tracking-[-0.015em] text-fg">
                    {e.title}
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {e.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-[14.5px] leading-[1.6] text-fg-2"
                      >
                        <span
                          className="mt-[9px] h-1 w-1 flex-none rounded-full bg-fg-4"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-16 max-w-[560px] text-[13.5px] text-fg-3">
            Want something that isn&apos;t here yet? Email{" "}
            <a
              href="mailto:founder@safeship.dev"
              className="text-accent hover:text-[#d3ff85]"
            >
              founder@safeship.dev
            </a>{" "}
            with the use case. Solo founder, so the roadmap genuinely bends
            toward what paying customers ask for.
          </p>
        </main>
        <Footer />
      </div>
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
