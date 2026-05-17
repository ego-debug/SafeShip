"use client";

import { useEffect, useState } from "react";

// Discoverability surface for the Cmd-K palette. Click opens it (works
// on mobile, where there's no Cmd+K keyboard chord). The visible kbd
// hint changes to ⌘K on Mac vs Ctrl+K elsewhere so the hint matches
// the actual chord the user can press.
//
// Decoupled from the palette via a window custom event — keeps both
// components independently testable and lets us mount the hint anywhere
// without prop drilling state.
export function CmdKHint() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));
  }, []);

  function open() {
    window.dispatchEvent(new CustomEvent("safeship:cmdk-open"));
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Open command palette"
      aria-label="Open command palette"
      className="inline-flex items-center gap-2 rounded-[7px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-2 py-1 text-[12px] text-fg-3 transition-colors hover:border-[rgba(255,255,255,0.22)] hover:text-fg-2"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <span className="hidden sm:inline">Jump to…</span>
      <kbd
        className="hidden h-[16px] min-w-[16px] place-items-center rounded border border-line-strong bg-[rgba(255,255,255,0.04)] px-1 font-mono text-[10px] text-fg-3 sm:inline-grid"
        aria-hidden="true"
      >
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
