"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AcceptedTest,
  PendingSuggestion,
  SuggestionsSummary,
} from "@/lib/suggestions";
import { ErrorBanner } from "@/components/ErrorBanner";

const UNDO_WINDOW_MS = 5000;

type PendingAction = {
  type: "accept" | "skip";
  suggestion: PendingSuggestion;
};

export function SuggestionsView({ snapshot }: { snapshot: SuggestionsSummary }) {
  const router = useRouter();
  const [items, setItems] = useState<PendingSuggestion[]>(snapshot.pending);
  const [accepted, setAccepted] = useState<AcceptedTest[]>(snapshot.recentlyAccepted);
  const [acceptedToday, setAcceptedToday] = useState(snapshot.acceptedToday);
  const [generating, setGenerating] = useState(false);
  const [flash, setFlash] = useState<"accept" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Holds the deferred-commit timer + a flag so we can fire the API call
  // even if the component unmounts (e.g. customer navigates away) - losing
  // an accept on unmount would silently swallow their click.
  const commitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingActionRef = useRef<PendingAction | null>(null);
  pendingActionRef.current = pendingAction;

  const current = items[0];

  const commitAction = useCallback(async (action: PendingAction) => {
    const endpoint =
      action.type === "accept"
        ? `/api/suggestions/${action.suggestion.id}/accept`
        : `/api/suggestions/${action.suggestion.id}/skip`;
    try {
      const r = await fetch(endpoint, { method: "POST" });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `${action.type}_failed`);
        // On failure, restore the suggestion to the top of the queue so
        // the customer can retry rather than losing it silently.
        setItems((prev) => [action.suggestion, ...prev]);
        if (action.type === "accept") {
          setAcceptedToday((n) => Math.max(0, n - 1));
          setAccepted((prev) =>
            prev.filter((t) => t.id !== action.suggestion.id),
          );
        }
      }
    } catch {
      setError("network_error");
      setItems((prev) => [action.suggestion, ...prev]);
      if (action.type === "accept") {
        setAcceptedToday((n) => Math.max(0, n - 1));
        setAccepted((prev) =>
          prev.filter((t) => t.id !== action.suggestion.id),
        );
      }
    }
  }, []);

  const clearPending = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  const queueAction = useCallback(
    (type: "accept" | "skip", suggestion: PendingSuggestion) => {
      setError(null);
      setFlash(type);
      setTimeout(() => setFlash(null), 450);

      // If there's already a pending undo-able action, commit it now -
      // pressing Y/N again means "I'm done deliberating on the previous one."
      const prev = pendingActionRef.current;
      if (prev) {
        clearPending();
        void commitAction(prev);
      }

      // Optimistically remove from queue + add to accepted (if accept).
      setItems((q) => q.slice(1));
      if (type === "accept") {
        setAccepted((prev) =>
          [
            {
              id: suggestion.id,
              name: suggestion.name,
              plain_english: suggestion.plain_english,
              code_yaml: suggestion.code_yaml,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ].slice(0, 5),
        );
        setAcceptedToday((n) => n + 1);
      }

      const action: PendingAction = { type, suggestion };
      setPendingAction(action);
      commitTimerRef.current = setTimeout(() => {
        setPendingAction(null);
        commitTimerRef.current = null;
        void commitAction(action);
      }, UNDO_WINDOW_MS);
    },
    [clearPending, commitAction],
  );

  const undoPending = useCallback(() => {
    const action = pendingActionRef.current;
    if (!action) return;
    clearPending();
    // Put the suggestion back at the top.
    setItems((q) => [action.suggestion, ...q]);
    if (action.type === "accept") {
      setAccepted((prev) => prev.filter((t) => t.id !== action.suggestion.id));
      setAcceptedToday((n) => Math.max(0, n - 1));
    }
    setPendingAction(null);
  }, [clearPending]);

  // Commit any pending action on unmount (don't lose customer's click).
  useEffect(() => {
    return () => {
      const a = pendingActionRef.current;
      if (a) {
        clearPending();
        void commitAction(a);
      }
    };
  }, [clearPending, commitAction]);

  function handleAccept() {
    if (!current) return;
    queueAction("accept", current);
  }

  function handleSkip() {
    if (!current) return;
    queueAction("skip", current);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch("/api/suggestions/generate", { method: "POST" });
      const data = (await r.json()) as {
        ok?: boolean;
        error?: string;
        generated?: number;
        rateLimited?: number;
        retry_after_seconds?: number;
        limit?: number;
        window?: string;
        reason?: string;
      };
      if (!r.ok) {
        if (r.status === 429) {
          setError(
            `Rate limit reached. ${data.limit ?? "?"} suggestions allowed per ${
              data.window ?? "day"
            }. Try again in ${humanWait(data.retry_after_seconds)}.`,
          );
          return;
        }
        setError(
          data.error === "engine_not_configured"
            ? "ANTHROPIC_API_KEY not set in .env.local. Add it to run the auto-suggest engine."
            : data.error ?? "generate_failed",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("network_error");
    } finally {
      setGenerating(false);
    }
  }

  function humanWait(seconds: number | undefined): string {
    if (!seconds || seconds < 0) return "a moment";
    if (seconds < 60) return `${seconds}s`;
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.round(m / 60);
    return `${h}h`;
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "y") {
        e.preventDefault();
        handleAccept();
      } else if (k === "n") {
        e.preventDefault();
        handleSkip();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <main className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
              <span
                className="h-1.5 w-1.5 rounded-full bg-accent"
              />
              Suggested tests
            </span>
            <h1 className="text-[clamp(28px,3vw,36px)] font-semibold leading-[1.1] tracking-[-0.025em]">
              {/* items.length, not the static snapshot total - the count
                  should tick down live as the user works the queue. */}
              {items.length} to review
              <span className="ml-3 font-mono text-base text-fg-3">
                · {acceptedToday} accepted today
              </span>
            </h1>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating || !snapshot.engineConfigured}
            className="inline-flex items-center gap-2 rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-3.5 py-2 text-sm text-fg-2 transition-colors hover:border-[rgba(255,255,255,0.25)] hover:text-fg disabled:opacity-60"
            title={
              !snapshot.engineConfigured
                ? "Set ANTHROPIC_API_KEY in .env.local"
                : "Scan recent failing runs for new suggestions"
            }
          >
            {generating ? "Generating…" : "Generate from recent failures"}
          </button>
        </header>

        {!snapshot.engineConfigured && (
          <div
            className="rounded-xl border px-4 py-3 text-sm text-fg-2"
            style={{
              background: "rgba(245,193,74,0.08)",
              borderColor: "rgba(245,193,74,0.32)",
            }}
          >
            <b className="text-fg">Auto-suggest engine isn&apos;t configured.</b>{" "}
            Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> in{" "}
            <code className="font-mono text-xs">.env.local</code> and restart the
            dev server to enable Claude-powered suggestions.
          </div>
        )}

        {error && (
          <ErrorBanner
            message={humanizeError(error)}
            onRetry={isRetryable(error) ? handleGenerate : undefined}
            onDismiss={() => setError(null)}
          />
        )}

        {!current ? (
          <EmptyQueue
            engineConfigured={snapshot.engineConfigured}
            onGenerate={handleGenerate}
            generating={generating}
          />
        ) : (
          <FocusCard
            suggestion={current}
            position={snapshot.pendingTotal - items.length + 1}
            total={snapshot.pendingTotal}
            flash={flash}
            onAccept={handleAccept}
            onSkip={handleSkip}
          />
        )}

        <UpNextPreview items={items.slice(1, 4)} extra={Math.max(0, items.length - 4)} />

        <KeyboardHints />

        {pendingAction && (
          <UndoToast action={pendingAction} onUndo={undoPending} />
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <SideCard title="Recently accepted">
          {accepted.length === 0 ? (
            <p className="text-sm text-fg-3">
              Nothing yet. Accept your first suggestion to start building the
              regression suite.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {accepted.map((t) => (
                <li key={t.id} className="flex flex-col gap-1">
                  <span className="truncate font-mono text-[12.5px] text-fg">
                    {t.name}
                  </span>
                  <span className="font-mono text-[11px] text-fg-4">
                    added {timeAgo(t.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/app/tests"
            className="mt-4 inline-block text-[12px] text-accent hover:text-[#d3ff85]"
          >
            View full suite →
          </Link>
        </SideCard>

        <SideCard title="How it works">
          <ol className="flex flex-col gap-2 text-[13px] text-fg-2">
            <li>
              <b className="font-medium text-fg">1.</b> Engine scans your recent
              failing runs.
            </li>
            <li>
              <b className="font-medium text-fg">2.</b> Claude reads the trace
              and proposes a YAML assertion that would have caught it.
            </li>
            <li>
              <b className="font-medium text-fg">3.</b> You accept or skip.
              Accepted suggestions become active tests in your regression suite.
            </li>
          </ol>
        </SideCard>
      </aside>
    </main>
  );
}

function FocusCard({
  suggestion,
  position,
  total,
  flash,
  onAccept,
  onSkip,
}: {
  suggestion: PendingSuggestion;
  position: number;
  total: number;
  flash: "accept" | "skip" | null;
  onAccept: () => void;
  onSkip: () => void;
}) {
  const severityColor =
    suggestion.severity === "high"
      ? "text-danger"
      : suggestion.severity === "medium"
      ? "text-[#f5c14a]"
      : "text-fg-3";
  const severityBg =
    suggestion.severity === "high"
      ? "bg-danger/10 border-danger/30"
      : suggestion.severity === "medium"
      ? "bg-[#f5c14a]/10 border-[#f5c14a]/30"
      : "bg-[rgba(255,255,255,0.04)] border-line-strong";

  return (
    <article
      className="relative flex flex-col gap-5 rounded-2xl border border-line-strong p-6 transition-all"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -28px rgba(0,0,0,0.6)",
        transform:
          flash === "accept"
            ? "translateX(40px) rotate(2deg)"
            : flash === "skip"
            ? "translateX(-40px) rotate(-2deg)"
            : undefined,
        opacity: flash ? 0.6 : 1,
        transitionProperty: "transform, opacity, border-color",
        transitionDuration: "0.45s",
        transitionTimingFunction: "cubic-bezier(.5, .05, .85, .35)",
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {suggestion.run_id && (
            <Link
              href={`/app/runs/${suggestion.run_id}`}
              className="inline-flex w-fit items-center gap-1.5 font-mono text-[11.5px] text-accent hover:text-[#d3ff85]"
            >
              <span aria-hidden="true">↗</span>
              From run #{suggestion.run_id.slice(0, 8)}
            </Link>
          )}
          <h2 className="truncate font-mono text-[15px] font-medium text-fg">
            {suggestion.name}
          </h2>
        </div>
        <div className="flex flex-none items-center gap-2.5 font-mono text-[11px]">
          <span
            className={`rounded-full border px-2 py-0.5 uppercase tracking-wide ${severityColor} ${severityBg}`}
          >
            {suggestion.severity ?? "unknown"}
          </span>
          <span className="text-fg-4">
            {position}/{total}
          </span>
        </div>
      </header>

      {/* Side-by-side: human-readable description (left) and the actual
          machine-checkable test definition (right). On narrow viewports
          (< md) they stack vertically. The dual-column layout is the
          centerpiece of the wedge - visitor sees plain English AND the
          test code at the same time, no clicking required. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
            What this test enforces
          </span>
          <div
            className="flex-1 rounded-xl border px-4 py-3"
            style={{
              background: "rgba(194,249,112,0.06)",
              borderColor: "rgba(194,249,112,0.28)",
            }}
          >
            <p className="text-[14.5px] leading-relaxed text-fg">
              {suggestion.plain_english}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
            The test SafeShip will add to your suite
          </span>
          <pre
            className="flex-1 overflow-x-auto rounded-xl border border-line px-4 py-3 font-mono text-[12px] leading-[1.55] text-fg"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            <code>{suggestion.code_yaml}</code>
          </pre>
        </div>
      </div>

      {suggestion.rationale && (
        <details className="rounded-md border border-line bg-[rgba(255,255,255,0.015)] px-3 py-2">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wide text-fg-3 hover:text-fg-2">
            Why this test?
          </summary>
          <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">
            {suggestion.rationale}
          </p>
        </details>
      )}

      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={onAccept}
          className="inline-flex items-center gap-2 rounded-[9px] bg-accent px-5 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.35),0_12px_24px_-12px_rgba(0,0,0,0.55)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
        >
          ✓ Add to regression suite
          <KeyHint k="Y" />
        </button>
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-2 rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-5 py-2.5 text-sm text-fg-2 transition-colors hover:border-[rgba(255,255,255,0.25)] hover:text-fg"
        >
          ✗ Skip
          <KeyHint k="N" />
        </button>
      </div>
    </article>
  );
}

function EmptyQueue({
  engineConfigured,
  onGenerate,
  generating,
}: {
  engineConfigured: boolean;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <section
      className="grid place-items-center rounded-2xl border border-dashed border-line-strong py-14 text-center"
      style={{ background: "rgba(255,255,255,0.015)" }}
    >
      <div className="flex max-w-md flex-col gap-3">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-line-strong text-accent"
          style={{ background: "rgba(194,249,112,0.10)" }}
          aria-hidden="true"
        >
          ✓
        </span>
        <h2 className="text-xl font-semibold tracking-tight">
          Queue empty. Nice work.
        </h2>
        <p className="text-fg-2">
          No suggestions waiting. As new failures land via{" "}
          <code className="font-mono text-xs">/v1/traces</code>, click the
          generate button to scan them for regression-test candidates.
        </p>
        {engineConfigured && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="mx-auto mt-2 inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85] disabled:opacity-60"
          >
            {generating ? "Scanning…" : "Generate from recent failures →"}
          </button>
        )}
      </div>
    </section>
  );
}

// Map raw error codes from the API into user-readable text. Falls back
// to the raw code if we don't have a translation yet (better than nothing).
function humanizeError(code: string): string {
  if (code.startsWith("Rate limit")) return code; // already formatted by handleGenerate
  switch (code) {
    case "network_error":
      return "Network error. Check your connection and try again.";
    case "engine_not_configured":
      return "Auto-suggest engine isn't configured. Set ANTHROPIC_API_KEY in your environment and redeploy.";
    case "accept_failed":
      return "Couldn't accept the suggestion. It's been restored to the top of the queue; try again.";
    case "skip_failed":
      return "Couldn't skip the suggestion. It's been restored to the top of the queue; try again.";
    case "generate_failed":
      return "Couldn't generate new suggestions. Try again, or check the server logs.";
    default:
      return code;
  }
}

function isRetryable(code: string): boolean {
  // Engine-not-configured is a config issue that retry can't fix.
  if (code === "engine_not_configured") return false;
  // Rate-limit copy already tells the user when to try again - no retry
  // button (they'd just hit the limit again immediately).
  if (code.startsWith("Rate limit")) return false;
  return true;
}

function KeyboardHints() {
  return (
    <footer className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[11px] text-fg-4">
      <span>
        <KeyHint k="Y" /> accept
      </span>
      <span>
        <KeyHint k="N" /> skip
      </span>
      <span className="opacity-70">5-second undo after either</span>
    </footer>
  );
}

function UpNextPreview({
  items,
  extra,
}: {
  items: PendingSuggestion[];
  extra: number;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-2 flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] uppercase tracking-wide text-fg-4">
        Up next
      </span>
      <ul className="flex flex-col gap-1">
        {items.map((s, i) => (
          <li
            key={s.id}
            className="flex items-baseline gap-3 truncate font-mono text-[12px]"
            style={{ opacity: 0.85 - i * 0.18 }}
          >
            <span className="text-fg-4">{i + 2}.</span>
            <span className="truncate text-fg-2">{s.name}</span>
            {s.severity && (
              <span
                className={`flex-none text-[10.5px] uppercase tracking-wide ${
                  s.severity === "high"
                    ? "text-danger"
                    : s.severity === "medium"
                    ? "text-[#f5c14a]"
                    : "text-fg-4"
                }`}
              >
                {s.severity}
              </span>
            )}
          </li>
        ))}
        {extra > 0 && (
          <li className="font-mono text-[11px] text-fg-4" style={{ opacity: 0.5 }}>
            + {extra} more
          </li>
        )}
      </ul>
    </section>
  );
}

function UndoToast({
  action,
  onUndo,
}: {
  action: PendingAction;
  onUndo: () => void;
}) {
  // Visible progress bar so the customer sees how long they have left
  // to undo. Pure CSS animation - no per-frame React re-render needed.
  const label =
    action.type === "accept" ? "Accepted" : "Skipped";
  const accentColor =
    action.type === "accept" ? "rgba(194,249,112,0.7)" : "rgba(245,193,74,0.7)";
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      <div
        className="pointer-events-auto relative flex items-center gap-4 overflow-hidden rounded-xl border border-line-strong px-4 py-2.5 shadow-2xl"
        style={{
          background: "rgba(15,15,17,0.96)",
          backdropFilter: "blur(6px)",
        }}
      >
        <span className="font-mono text-[12px] text-fg-3">
          <b className="font-medium text-fg-2">{label}</b>{" "}
          <span className="text-fg-4">·</span>{" "}
          <span className="truncate text-fg-2">{action.suggestion.name}</span>
        </span>
        <button
          onClick={onUndo}
          className="rounded border border-line-strong bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[12px] font-medium text-fg transition-colors hover:border-[rgba(255,255,255,0.25)]"
        >
          Undo
        </button>
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-[2px]"
          style={{
            background: accentColor,
            width: "100%",
            transformOrigin: "left",
            animation: `safeshipUndoProgress ${UNDO_WINDOW_MS}ms linear forwards`,
          }}
        />
        <style>{`
          @keyframes safeshipUndoProgress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

function KeyHint({ k }: { k: string }) {
  return (
    <span className="ml-1 inline-grid h-[18px] min-w-[18px] place-items-center rounded border border-line-strong bg-[rgba(255,255,255,0.04)] px-1 font-mono text-[10.5px] text-fg-2">
      {k}
    </span>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-line-strong p-5"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
      }}
    >
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
