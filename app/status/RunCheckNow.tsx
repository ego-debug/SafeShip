"use client";

import { useState } from "react";

type RunResult =
  | { state: "idle" }
  | { state: "running" }
  | { state: "ok"; durationMs: number }
  | { state: "err"; msg: string };

export function RunCheckNow() {
  const [result, setResult] = useState<RunResult>({ state: "idle" });

  async function run() {
    setResult({ state: "running" });
    try {
      const r = await fetch("/api/cron/ingest-ping", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        duration_ms?: number;
        detail?: string | null;
        error?: string;
      };
      if (!r.ok || !data.ok) {
        setResult({
          state: "err",
          msg: data.detail || data.error || `request failed (${r.status})`,
        });
        return;
      }
      setResult({
        state: "ok",
        durationMs: typeof data.duration_ms === "number" ? data.duration_ms : 0,
      });
      // Refresh the page so the new measurement is reflected in the SLA card.
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 800);
    } catch (err) {
      setResult({
        state: "err",
        msg: err instanceof Error ? err.message : "network error",
      });
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={result.state === "running"}
        className="rounded-md border border-line-strong bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[12.5px] font-medium text-fg transition-colors hover:border-[rgba(255,255,255,0.25)] disabled:opacity-60"
      >
        {result.state === "running" ? "Pinging…" : "Run check now"}
      </button>
      {result.state === "ok" && (
        <span className="font-mono text-[11px] text-accent">
          {result.durationMs}ms · refreshing…
        </span>
      )}
      {result.state === "err" && (
        <span className="font-mono text-[11px] text-danger">{result.msg}</span>
      )}
    </div>
  );
}
