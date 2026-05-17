"use client";

import { useState } from "react";

// Shared error surface for client-side fetches. Renders inline as a
// dismissable banner with an optional Retry action.
//
// Why a shared component:
// - Consistent visual language across the app (one place to change the
//   color/copy contract).
// - Forces every error path to think about whether retry makes sense
//   (pass `onRetry` if yes; omit if not).
// - Lets the message stay user-readable rather than raw error codes
//   ("rate_limited" → "Rate limit reached. Try again in 2 minutes.").
//
// Usage:
//   <ErrorBanner
//     message="Couldn't generate a suggestion: rate limit reached. Try again in 2 minutes."
//     onRetry={handleGenerate}
//     onDismiss={() => setError(null)}
//   />

type Severity = "error" | "warn";

export function ErrorBanner({
  message,
  onRetry,
  onDismiss,
  severity = "error",
  retryLabel = "Try again",
}: {
  message: string;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  severity?: Severity;
  retryLabel?: string;
}) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  const palette =
    severity === "error"
      ? {
          background: "rgba(255,107,107,0.08)",
          border: "rgba(255,107,107,0.32)",
          icon: "text-danger",
          text: "text-fg",
        }
      : {
          background: "rgba(245,193,74,0.08)",
          border: "rgba(245,193,74,0.32)",
          icon: "text-[#f5c14a]",
          text: "text-fg",
        };

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border px-4 py-3"
      style={{ background: palette.background, borderColor: palette.border }}
    >
      <span aria-hidden="true" className={`mt-0.5 flex-none ${palette.icon}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <p className={`flex-1 text-[13.5px] leading-relaxed ${palette.text}`}>
        {message}
      </p>
      <div className="flex flex-none items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="rounded-md border border-line-strong bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[12px] font-medium text-fg transition-colors hover:border-[rgba(255,255,255,0.25)] disabled:opacity-60"
          >
            {retrying ? "Retrying…" : retryLabel}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded-md p-1 text-fg-3 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-fg-2"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
