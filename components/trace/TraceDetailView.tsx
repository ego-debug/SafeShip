"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RunDetail, RunDetailStep } from "@/lib/runs";

export function TraceDetailView({ run }: { run: RunDetail }) {
  const failingStep = run.steps.find((s) => s.status === "fail");
  const isFailedRun = run.status === "fail" || !!failingStep;

  return (
    <main className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <Breadcrumb runId={run.id} />

        <StatusBanner run={run} failingStep={failingStep ?? null} />

        <RunMeta run={run} />

        <section className="flex flex-col gap-3">
          <header className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-fg">Timeline</h2>
            <span className="font-mono text-xs text-fg-4">
              {run.steps.length} step{run.steps.length === 1 ? "" : "s"}
            </span>
          </header>
          <ol className="flex flex-col gap-2.5">
            {run.steps.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                expandedByDefault={step.status === "fail"}
                showVerdict={isFailedRun && step.status === "fail"}
              />
            ))}
            {run.steps.length === 0 && (
              <li className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-fg-3">
                This run has no trace steps. That&apos;s unusual — your SDK
                may have failed to capture them.
              </li>
            )}
          </ol>
        </section>

        <ActionBar runId={run.id} />
      </div>

      <aside className="flex flex-col gap-4">
        <RawTracePanel run={run} />
      </aside>
    </main>
  );
}

function Breadcrumb({ runId }: { runId: string }) {
  return (
    <nav className="flex items-center gap-2 font-mono text-xs text-fg-4">
      <Link href="/app/dashboard" className="hover:text-fg-2">
        Dashboard
      </Link>
      <span>/</span>
      <span>Runs</span>
      <span>/</span>
      <span className="text-fg-2">#{runId.slice(0, 8)}…{runId.slice(-4)}</span>
    </nav>
  );
}

function StatusBanner({
  run,
  failingStep,
}: {
  run: RunDetail;
  failingStep: RunDetailStep | null;
}) {
  if (run.status === "fail" || failingStep) {
    return (
      <div
        className="relative overflow-hidden rounded-xl border px-5 py-4"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,107,107,0.10), rgba(255,107,107,0.02))",
          borderColor: "rgba(255,107,107,0.32)",
        }}
      >
        <span className="absolute bottom-0 left-0 top-0 w-1 bg-danger" />
        <p className="font-medium text-fg">
          ❌ Run failed at step{" "}
          <span className="font-mono">
            {failingStep ? failingStep.step_index : "—"}
          </span>{" "}
          {failingStep?.tool_name ? (
            <>
              in <span className="font-mono">{failingStep.tool_name}</span>
            </>
          ) : null}
          .
        </p>
        <p className="mt-1 font-mono text-xs text-fg-3">
          score{" "}
          <span className="text-danger">
            {run.score == null ? "—" : `${run.score}/100`}
          </span>{" "}
          · trigger {run.trigger}
        </p>
      </div>
    );
  }
  return (
    <div
      className="relative overflow-hidden rounded-xl border px-5 py-4"
      style={{
        background:
          "linear-gradient(90deg, rgba(194,249,112,0.08), rgba(194,249,112,0.015))",
        borderColor: "rgba(194,249,112,0.28)",
      }}
    >
      <span className="absolute bottom-0 left-0 top-0 w-1 bg-accent" />
      <p className="font-medium text-fg">
        ✓ Run completed cleanly across {run.steps.length} step
        {run.steps.length === 1 ? "" : "s"}.
      </p>
      <p className="mt-1 font-mono text-xs text-fg-3">
        score{" "}
        <span className="text-accent">
          {run.score == null ? "—" : `${run.score}/100`}
        </span>{" "}
        · trigger {run.trigger}
      </p>
    </div>
  );
}

function RunMeta({ run }: { run: RunDetail }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-line p-4 font-mono text-xs sm:grid-cols-4">
      <Meta label="Project">
        {run.project_name}
        <span className="ml-1.5 text-fg-4">{run.project_environment}</span>
      </Meta>
      <Meta label="Model">{run.model ?? "—"}</Meta>
      <Meta label="Duration">{fmtDuration(run.duration_ms)}</Meta>
      <Meta label="Started">{fmtDate(run.started_at)}</Meta>
    </dl>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="uppercase tracking-wide text-fg-4">{label}</dt>
      <dd className="text-fg">{children}</dd>
    </div>
  );
}

function StepCard({
  step,
  expandedByDefault,
  showVerdict,
}: {
  step: RunDetailStep;
  expandedByDefault: boolean;
  showVerdict: boolean;
}) {
  const [open, setOpen] = useState(expandedByDefault);
  const failed = step.status === "fail";
  const warn = step.status === "warn";

  return (
    <li
      className={`overflow-hidden rounded-xl border transition-colors ${
        failed
          ? ""
          : warn
          ? "border-line-strong"
          : "border-line"
      }`}
      style={{
        background: failed
          ? "linear-gradient(180deg, rgba(255,107,107,0.04), #0c0c0e)"
          : "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
        borderColor: failed ? "rgba(255,107,107,0.45)" : undefined,
        boxShadow: failed
          ? "0 0 0 1px rgba(255,107,107,0.12) inset"
          : undefined,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
      >
        <div className="flex min-w-0 items-center gap-3">
          <StepDot status={step.status} />
          <span className="font-mono text-[12.5px] text-fg-3">
            {String(step.step_index).padStart(2, "0")}.
          </span>
          <span className="truncate font-mono text-[13px] text-fg">
            {step.tool_name ?? "(unnamed step)"}
          </span>
          {step.kind && (
            <span className="rounded border border-line-strong bg-[rgba(255,255,255,0.02)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-fg-4">
              {step.kind}
            </span>
          )}
        </div>
        <div className="flex flex-none items-center gap-3 font-mono text-[11.5px] text-fg-4">
          <span>{fmtDuration(step.duration_ms)}</span>
          <span
            className={`transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <IoBlock label="Input" data={step.input} />
            <IoBlock label="Output" data={step.output} />
          </div>

          {showVerdict && (
            <div
              className="mt-4 rounded-lg border p-3.5"
              style={{
                background: "rgba(255,107,107,0.06)",
                borderColor: "rgba(255,107,107,0.32)",
              }}
            >
              <p className="mb-1 text-sm font-medium text-fg">
                What went wrong
              </p>
              <p className="text-[13px] leading-relaxed text-fg-2">
                This step failed. Once the auto-suggest engine ships in
                Stage 5, this callout will contain a plain-English diagnosis
                and a one-click "add as regression test" action.
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function StepDot({ status }: { status: string | null }) {
  const color =
    status === "fail"
      ? "bg-danger"
      : status === "warn"
      ? "bg-[#f5c14a]"
      : "bg-accent";
  return (
    <span
      className={`h-2 w-2 flex-none rounded-full ${color}`}
      style={{
        boxShadow:
          status === "fail"
            ? "0 0 6px rgba(255,107,107,0.7)"
            : "0 0 6px rgba(194,249,112,0.6)",
      }}
    />
  );
}

function IoBlock({ label, data }: { label: string; data: unknown }) {
  const display =
    data == null
      ? "(none)"
      : typeof data === "string"
      ? data
      : safeStringify(data);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-wide text-fg-4">
        {label}
      </span>
      <pre
        className="overflow-x-auto rounded-md border border-line p-3 font-mono text-[11.5px] leading-[1.55] text-fg"
        style={{ background: "rgba(0,0,0,0.35)" }}
      >
        <code>{display}</code>
      </pre>
    </div>
  );
}

function ActionBar({ runId }: { runId: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestErr, setSuggestErr] = useState<string | null>(null);

  async function copyShareUrl() {
    await navigator.clipboard.writeText(
      `${window.location.origin}/app/runs/${runId}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function generateSuggestion() {
    setSuggesting(true);
    setSuggestErr(null);
    try {
      const r = await fetch(`/api/runs/${runId}/suggest`, { method: "POST" });
      const data = (await r.json()) as {
        ok?: boolean;
        error?: string;
        limit?: number;
        window?: string;
        retry_after_seconds?: number;
      };
      if (!r.ok || !data.ok) {
        if (r.status === 429) {
          const wait = data.retry_after_seconds
            ? data.retry_after_seconds < 60
              ? `${data.retry_after_seconds}s`
              : data.retry_after_seconds < 3600
              ? `${Math.round(data.retry_after_seconds / 60)} min`
              : `${Math.round(data.retry_after_seconds / 3600)}h`
            : "a moment";
          setSuggestErr(
            `Rate limit reached (${data.limit ?? "?"}/${
              data.window ?? "window"
            }). Try again in ${wait}.`,
          );
          return;
        }
        setSuggestErr(
          data.error === "engine_not_configured"
            ? "ANTHROPIC_API_KEY not set — add it to .env.local."
            : data.error ?? "suggest_failed",
        );
        return;
      }
      router.push("/app/suggestions");
    } catch {
      setSuggestErr("network_error");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div
      className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong px-4 py-3 backdrop-blur"
      style={{ background: "rgba(10,10,11,0.85)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={generateSuggestion}
          disabled={suggesting}
          className="inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4),0_10px_24px_-10px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85] disabled:opacity-60"
        >
          {suggesting ? "Generating…" : "✓ Suggest a regression test"}
        </button>
        <button
          disabled
          title="Coming with the eval set in a follow-up"
          className="inline-flex items-center gap-2 rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-4 py-2 text-sm text-fg-2 opacity-60"
        >
          Mark as expected behavior
        </button>
        {suggestErr && (
          <span className="font-mono text-[11px] text-danger">{suggestErr}</span>
        )}
      </div>
      <button
        onClick={copyShareUrl}
        className="font-mono text-[12px] text-fg-3 transition-colors hover:text-fg-2"
      >
        {copied ? "✓ link copied" : "Share trace →"}
      </button>
    </div>
  );
}

function RawTracePanel({ run }: { run: RunDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <section
      className="sticky top-4 rounded-xl border border-line-strong"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-line px-4 py-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.02)]"
        style={{ background: "rgba(255,255,255,0.015)" }}
      >
        <span className="text-sm font-medium text-fg-2">Raw trace</span>
        <span
          className={`font-mono text-[11px] text-fg-4 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {open && (
        <pre className="max-h-[60vh] overflow-auto px-4 py-3 font-mono text-[11px] leading-[1.55] text-fg-2">
          <code>{safeStringify(run)}</code>
        </pre>
      )}
    </section>
  );
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function fmtDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
