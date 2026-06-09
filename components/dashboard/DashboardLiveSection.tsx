"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardFailure, DashboardRun } from "@/lib/projects";
import { FailureCards } from "./FailureCards";
import { RunsList } from "./RunsList";

const POLL_MS = 4000;
const HIDDEN_POLL_MS = 20000;
const FADE_HOLD_MS = 1500;

// Wraps the realtime-changing dashboard panels in a client component that
// polls /api/projects/[id]/recent every ~2s while the tab is visible. New
// runs and new failure rows get a one-shot accent fade so the customer
// sees liveness without a refresh. Polling pauses when the tab is hidden
// (per Page Visibility API) and resumes on focus.
export function DashboardLiveSection({
  projectId,
  initialRuns,
  initialFailures,
  scoreChart,
}: {
  projectId: string;
  initialRuns: DashboardRun[];
  initialFailures: DashboardFailure[];
  // Server-rendered ScoreChart slot — passed in as a prop so we don't
  // re-serialize the 7-day time series on every 2s poll. Score chart
  // updates only on full page render.
  scoreChart: React.ReactNode;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [failures, setFailures] = useState(initialFailures);
  const [highlightRunIds, setHighlightRunIds] = useState<Set<string>>(
    () => new Set(),
  );
  const knownRunIdsRef = useRef<Set<string>>(
    new Set(initialRuns.map((r) => r.id)),
  );
  // Show a "polling paused" hint when 3+ consecutive polls fail. Stays a
  // soft visual (header chip changes color) — no toast, no banner — so a
  // transient blip doesn't yell at the customer.
  const [staleSince, setStaleSince] = useState<number | null>(null);
  const failuresInARowRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (cancelled) return;
      // Don't poll a hidden tab — wastes bandwidth + battery on laptops.
      // Check back at a much slower cadence; the visibilitychange handler
      // below resumes fast polling the moment the tab is foregrounded.
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(poll, HIDDEN_POLL_MS);
        return;
      }
      try {
        const r = await fetch(`/api/projects/${projectId}/recent`, {
          cache: "no-store",
        });
        if (r.ok) {
          const data = (await r.json()) as {
            runs: DashboardRun[];
            failures: DashboardFailure[];
            totalRuns: number;
          };
          // Detect runs we haven't seen before — these are the ones to
          // flash on next render.
          const fresh = new Set<string>();
          for (const run of data.runs) {
            if (!knownRunIdsRef.current.has(run.id)) {
              fresh.add(run.id);
              knownRunIdsRef.current.add(run.id);
            }
          }
          setRuns(data.runs);
          setFailures(data.failures);
          if (fresh.size > 0) {
            setHighlightRunIds(fresh);
            // Clear the highlight set once the CSS animation has finished
            // so subsequent re-renders don't keep re-triggering the flash.
            if (fadeTimer) clearTimeout(fadeTimer);
            fadeTimer = setTimeout(
              () => setHighlightRunIds(new Set()),
              FADE_HOLD_MS,
            );
          }
          // Successful poll — reset failure streak + clear stale state.
          // Functional update: this closure runs once per projectId, so
          // reading `staleSince` directly would see the stale initial
          // value forever and the amber chip would never clear.
          failuresInARowRef.current = 0;
          setStaleSince((s) => (s !== null ? null : s));
        } else {
          recordPollFailure();
        }
      } catch {
        recordPollFailure();
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    function recordPollFailure() {
      failuresInARowRef.current += 1;
      // Flip to "stale" once three in a row have failed. Functional
      // update keeps the FIRST failure timestamp (the closure's
      // `staleSince` is frozen at mount, so a direct check would reset
      // the timestamp on every subsequent failure).
      if (failuresInARowRef.current >= 3) {
        setStaleSince((s) => (s === null ? Date.now() : s));
      }
    }

    timer = setTimeout(poll, POLL_MS);

    function onVisibility() {
      if (document.hidden) return;
      // Resume immediately when tab becomes visible — don't make the user
      // wait the full POLL_MS for fresh data.
      if (timer) clearTimeout(timer);
      timer = setTimeout(poll, 50);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [projectId]);

  return (
    <>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Regression score" meta="0 – 100 · higher is better">
          {scoreChart}
        </Panel>
        <Panel
          title="Recent runs"
          meta={<LiveMeta count={runs.length} staleSince={staleSince} />}
        >
          <RunsList runs={runs} highlightIds={highlightRunIds} />
        </Panel>
      </section>

      <section className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-fg">
            Recent failures
            <span className="ml-3 font-mono text-xs uppercase tracking-wide text-fg-4">
              {failures.length} unresolved
            </span>
          </h2>
        </header>
        <FailureCards failures={failures} highlightIds={highlightRunIds} />
      </section>
    </>
  );
}

// Header chip for the "Recent runs" panel. Pulses green during live
// polling; switches to amber with a "polling paused — last fresh data
// Ns ago" hint when 3+ consecutive polls have failed.
function LiveMeta({
  count,
  staleSince,
}: {
  count: number;
  staleSince: number | null;
}) {
  // Re-render once per second so the "Ns ago" timer ticks. Skipped when
  // not stale to avoid pointless renders on the happy path.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (staleSince === null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [staleSince]);

  if (staleSince !== null) {
    const ageSec = Math.max(0, Math.floor((Date.now() - staleSince) / 1000));
    const ageLabel =
      ageSec < 60
        ? `${ageSec}s`
        : ageSec < 3600
        ? `${Math.floor(ageSec / 60)}m`
        : `${Math.floor(ageSec / 3600)}h`;
    return (
      <span
        className="font-mono text-[11px] text-[#f5c14a]"
        title="Live polling is failing. Will resume automatically when reachable."
      >
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#f5c14a]" />
        polling paused · last fresh {ageLabel} ago
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] text-fg-4">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      live · {count} shown
    </span>
  );
}

// Local Panel duplicate — the original lives inside DashboardView. Tiny
// enough to mirror here rather than refactor.
function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border border-line-strong"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
      }}
    >
      <header
        className="flex items-baseline justify-between border-b border-line px-5 py-3"
        style={{ background: "rgba(255,255,255,0.015)" }}
      >
        <span className="text-sm font-medium text-fg-2">{title}</span>
        {typeof meta === "string" ? (
          <span className="font-mono text-[11px] text-fg-4">{meta}</span>
        ) : (
          meta
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

