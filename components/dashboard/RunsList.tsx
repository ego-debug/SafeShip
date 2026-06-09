import Link from "next/link";
import type { DashboardRun } from "@/lib/projects";

export function RunsList({
  runs,
  highlightIds,
}: {
  runs: DashboardRun[];
  highlightIds?: Set<string>;
}) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-fg-3">
        No runs yet. Send your first trace from the{" "}
        <Link href="/app/onboarding" className="text-accent hover:text-[#d3ff85]">
          setup page
        </Link>
        .
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {runs.map((run, i) => {
        const isNew = highlightIds?.has(run.id);
        return (
          <li
            key={run.id}
            className={i === 0 ? "" : "border-t border-line"}
            // When new, the row fades from an accent background back to
            // transparent over 1.5s - pure CSS animation, see globals.css.
            data-is-new={isNew ? "true" : undefined}
            style={
              isNew
                ? { animation: "safeshipNewRowFade 1.5s ease-out" }
                : undefined
            }
          >
            <Link
              href={`/app/runs/${run.id}`}
              className="grid items-center gap-4 px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.02)]"
              style={{
                gridTemplateColumns: "20px 1fr auto auto auto",
              }}
            >
              <StatusDot status={run.status} />
              <span className="overflow-hidden font-mono text-[12.5px] text-fg-2">
                <span className="text-fg-3">run </span>
                <span className="text-fg">#{run.id.slice(0, 8)}</span>
                <TriggerTag trigger={run.trigger} />
              </span>
              <span className="font-mono text-[12.5px] text-fg-3">
                {run.score == null ? "–" : `${run.score}/100`}
              </span>
              <span className="font-mono text-[11.5px] text-fg-4">
                {run.model ?? "–"}
              </span>
              <span className="font-mono text-[11.5px] text-fg-4">
                {timeAgo(run.started_at)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "fail"
      ? "bg-danger"
      : status === "warn"
      ? "bg-[#f5c14a]"
      : "bg-accent";
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

function TriggerTag({ trigger }: { trigger: string }) {
  return (
    <span
      className="ml-2 rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-fg-3"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      {trigger}
    </span>
  );
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
