import Link from "next/link";
import type { DashboardSnapshot } from "@/lib/projects";
import { DashboardLiveSection } from "./DashboardLiveSection";
import { ScoreChart } from "./ScoreChart";

export function DashboardView({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { project, runs, failures, scoreSeries, totalRuns } = snapshot;
  const hasAnyData = runs.length > 0;

  return (
    <main className="flex flex-col gap-8 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
            <span
              className="h-1.5 w-1.5 rounded-full bg-accent"
              style={{ boxShadow: "0 0 8px rgba(194,249,112,0.6)" }}
            />
            Overview
          </span>
          <h1 className="text-[clamp(28px,3vw,36px)] font-semibold leading-[1.1] tracking-[-0.025em]">
            {project.name}
            <span className="ml-3 rounded border border-line-strong bg-[rgba(255,255,255,0.02)] px-2 py-1 font-mono text-xs uppercase tracking-wide text-fg-3">
              {project.environment}
            </span>
          </h1>
          <p className="text-sm text-fg-3">
            <b className="text-fg-2">{totalRuns}</b>{" "}
            {totalRuns === 1 ? "run" : "runs"} in the last 7 days
          </p>
        </div>

        <Link
          href="/app/onboarding"
          className="rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-3.5 py-2 text-sm text-fg-2 transition-colors hover:border-[rgba(255,255,255,0.25)] hover:text-fg"
        >
          API key + setup →
        </Link>
      </header>

      {!hasAnyData ? (
        <EmptyState />
      ) : (
        <DashboardLiveSection
          projectId={project.id}
          initialRuns={runs}
          initialFailures={failures}
          scoreChart={<ScoreChart series={scoreSeries} />}
        />
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <section
      className="grid place-items-center rounded-2xl border border-dashed border-line-strong py-16 text-center"
      style={{ background: "rgba(255,255,255,0.015)" }}
    >
      <div className="flex max-w-md flex-col gap-4">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-line-strong text-accent"
          style={{ background: "rgba(194,249,112,0.10)" }}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <polyline points="3 12 7 12 9 6 13 18 15 12 21 12" />
          </svg>
        </span>
        <h2 className="text-[22px] font-semibold tracking-tight">
          Send your first trace.
        </h2>
        <p className="text-fg-2">
          Once you start sending traces from your agent, the regression score,
          runs list, and failure cards land here in real time.
        </p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <Link
            href="/app/onboarding"
            className="inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4),0_10px_24px_-10px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
          >
            Get your API key →
          </Link>
          <Link
            href="/designs/dashboard.html"
            className="text-sm text-fg-3 hover:text-fg-2"
          >
            See an example dashboard →
          </Link>
        </div>
      </div>
    </section>
  );
}
