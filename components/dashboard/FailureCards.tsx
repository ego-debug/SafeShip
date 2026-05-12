import Link from "next/link";
import type { DashboardFailure } from "@/lib/projects";

export function FailureCards({ failures }: { failures: DashboardFailure[] }) {
  if (failures.length === 0) {
    return (
      <div
        className="rounded-xl border border-line p-5 text-sm text-fg-3"
        style={{ background: "rgba(255,255,255,0.015)" }}
      >
        No failed steps yet. When your agent regresses, the failing step
        shows up here with a one-click path to the trace.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {failures.map((f) => (
        <article
          key={`${f.run_id}-${f.step_index}`}
          className="flex flex-col gap-3 rounded-xl border border-line-strong p-4"
          style={{
            background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="rounded border border-line-strong bg-[rgba(255,255,255,0.02)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-fg-3">
              {f.tool_name ?? "step"}
            </span>
            <span className="font-mono text-[11px] text-fg-4">
              {f.started_at ? timeAgo(f.started_at) : ""}
            </span>
          </div>
          <h4 className="text-[14.5px] leading-snug text-fg">
            Step {f.step_index} failed in <span className="font-mono">{f.tool_name ?? "?"}</span>.
          </h4>
          <p className="font-mono text-[11.5px] text-fg-3">
            run <span className="text-fg-2">#{f.run_id.slice(0, 8)}</span>
            {f.model ? <span className="ml-2">model {f.model}</span> : null}
          </p>
          <Link
            href={`/app/runs/${f.run_id}`}
            className="font-mono text-[11.5px] text-accent transition-colors hover:text-[#d3ff85]"
          >
            View trace →
          </Link>
        </article>
      ))}
    </div>
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
