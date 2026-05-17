"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Phase B #6 — Cmd-K palette
//
// Batch 1: shell + global Cmd+K / Ctrl+K + Esc. (Done.)
// Batch 2: static nav destinations + arrow nav + Enter navigates. (This.)
// Batch 3: ⌘K hint in AppNav for discoverability. (Next.)
//
// Mounted once in the signed-in app layout so it's reachable from every
// /app/* page without per-page wiring.

type Destination = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  group: "App" | "Settings" | "External";
  keywords?: string[];
};

const DESTINATIONS: Destination[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    hint: "Recent runs, regression score, failures",
    href: "/app/dashboard",
    group: "App",
    keywords: ["home", "overview", "runs", "failures", "score"],
  },
  {
    id: "suggestions",
    label: "Suggestions queue",
    hint: "Review auto-generated regression tests",
    href: "/app/suggestions",
    group: "App",
    keywords: ["accept", "skip", "tinder", "ai", "claude"],
  },
  {
    id: "tests",
    label: "Tests",
    hint: "Your regression suite",
    href: "/app/tests",
    group: "App",
    keywords: ["suite", "mute", "regression", "yaml"],
  },
  {
    id: "onboarding",
    label: "Setup",
    hint: "API key, SDK install, failure alerts",
    href: "/app/onboarding",
    group: "Settings",
    keywords: ["api", "key", "install", "alerts", "slack", "email"],
  },
  {
    id: "billing",
    label: "Billing",
    hint: "Subscription, trial, customer portal",
    href: "/app/billing",
    group: "Settings",
    keywords: ["plan", "stripe", "card", "cancel", "trial"],
  },
  {
    id: "docs",
    label: "Docs",
    hint: "Setup guide, branch protection, free CI replay",
    href: "/docs",
    group: "External",
    keywords: ["guide", "help", "yaml", "install", "ci", "github action"],
  },
  {
    id: "status",
    label: "Status",
    hint: "Live system status, SLA, incidents",
    href: "/status",
    group: "External",
    keywords: ["health", "uptime", "latency", "p95"],
  },
  {
    id: "pricing",
    label: "Pricing",
    hint: "Plan comparison",
    href: "/pricing",
    group: "External",
    keywords: ["cost", "plan", "free", "trial"],
  },
];

export function CmdKPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Container ref so the focus trap can scope its focusable-element query
  // to elements inside the modal only.
  const panelRef = useRef<HTMLDivElement>(null);
  // Element that had focus right before the palette opened. We restore
  // focus here when the palette closes so the user lands where they were.
  const triggerRef = useRef<HTMLElement | null>(null);

  // Fuzzy(-ish) filter — substring across label, hint, group, keywords.
  // Good enough for ~10 destinations; we'll upgrade to true fuzzy ranking
  // if/when the destination list grows past 50.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter((d) => {
      const hay = [d.label, d.hint, d.group, ...(d.keywords ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  // Reset highlight to top of results whenever the filter changes.
  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Group filtered destinations for rendering.
  const grouped = useMemo(() => {
    const order: Destination["group"][] = ["App", "Settings", "External"];
    const out: Array<{ group: Destination["group"]; items: Destination[] }> = [];
    for (const g of order) {
      const items = filtered.filter((d) => d.group === g);
      if (items.length > 0) out.push({ group: g, items });
    }
    return out;
  }, [filtered]);

  // Flat index → destination, so arrow keys can walk the visual list.
  const flat = useMemo(
    () => grouped.flatMap((g) => g.items),
    [grouped],
  );

  const navigate = useCallback(
    (dest: Destination) => {
      setOpen(false);
      // External marketing routes can be plain href navigations — they're
      // still inside the Next app though, so router.push works.
      router.push(dest.href);
    },
    [router],
  );

  // Global keyboard handler
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmdK =
        e.key.toLowerCase() === "k" &&
        ((isMac && e.metaKey) || (!isMac && e.ctrlKey));

      if (cmdK) {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) =>
          flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length,
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const dest = flat[selectedIdx];
        if (dest) navigate(dest);
        return;
      }
      // Focus trap: cycle Tab / Shift+Tab among focusables inside the
      // panel, never escaping to the background page.
      if (e.key === "Tab") {
        const focusables = getFocusables(panelRef.current);
        if (focusables.length === 0) return;
        const active = document.activeElement as HTMLElement | null;
        const currentIdx = active ? focusables.indexOf(active) : -1;
        e.preventDefault();
        let nextIdx: number;
        if (e.shiftKey) {
          nextIdx = currentIdx <= 0 ? focusables.length - 1 : currentIdx - 1;
        } else {
          nextIdx = currentIdx === focusables.length - 1 ? 0 : currentIdx + 1;
        }
        focusables[nextIdx]?.focus();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, flat, selectedIdx, navigate]);

  // External-trigger custom event so the AppNav (or anywhere else) can
  // open the palette via click without needing to share state directly.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("safeship:cmdk-open", onOpen);
    return () => window.removeEventListener("safeship:cmdk-open", onOpen);
  }, []);

  // Focus input on open + reset state on close. Also save/restore the
  // pre-open focus target so the user lands back on whatever they were
  // focused on (typically the CmdKHint button in the nav).
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    setQuery("");
    setSelectedIdx(0);
    // Defer restore so the close-triggering click (if any) finishes first.
    const t = setTimeout(() => {
      triggerRef.current?.focus();
      triggerRef.current = null;
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  // Keep the highlighted row in view when arrow-navigating.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-cmdk-row="${selectedIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx, open]);

  const close = useCallback(() => setOpen(false), []);

  if (!open) return null;

  // Track running flat index across groups so each row knows its position
  // in the keyboard-walkable list.
  let flatIdx = -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[15vh]"
      onClick={close}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
        }}
      />

      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-line-strong shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #131316 0%, #0c0c0e 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 border-b border-line px-4 py-3"
          style={{ background: "rgba(255,255,255,0.015)" }}
        >
          <span aria-hidden="true" className="text-fg-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a page…"
            className="flex-1 bg-transparent text-[14.5px] text-fg outline-none placeholder:text-fg-4"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd
            className="inline-grid h-[20px] min-w-[20px] place-items-center rounded border border-line-strong bg-[rgba(255,255,255,0.04)] px-1 font-mono text-[10.5px] text-fg-3"
            title="Press Esc to close"
          >
            esc
          </kbd>
        </div>

        <div
          ref={listRef}
          className="max-h-[55vh] overflow-y-auto py-1"
          role="listbox"
          aria-label="Destinations"
        >
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-fg-4">
              No matches for{" "}
              <span className="font-mono text-fg-3">{query}</span>.
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.group} className="px-1 py-1">
                <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">
                  {g.group}
                </div>
                {g.items.map((d) => {
                  flatIdx += 1;
                  const selected = flatIdx === selectedIdx;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-cmdk-row={flatIdx}
                      onMouseEnter={(idx => () => setSelectedIdx(idx))(flatIdx)}
                      onClick={() => navigate(d)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                        selected
                          ? "bg-[rgba(194,249,112,0.10)]"
                          : "hover:bg-[rgba(255,255,255,0.03)]"
                      }`}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span
                          className={`truncate text-[13.5px] ${
                            selected ? "text-fg" : "text-fg-2"
                          }`}
                        >
                          {d.label}
                        </span>
                        {d.hint && (
                          <span className="truncate text-[11.5px] text-fg-4">
                            {d.hint}
                          </span>
                        )}
                      </div>
                      <span
                        className={`flex-none font-mono text-[10.5px] ${
                          selected ? "text-accent" : "text-fg-4"
                        }`}
                      >
                        {selected ? "↵ enter" : d.href}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Keyboard hints are noise on touch devices — hide < sm. */}
        <div
          className="hidden items-center justify-end gap-3 border-t border-line px-3 py-2 font-mono text-[10.5px] text-fg-4 sm:flex"
          style={{ background: "rgba(255,255,255,0.015)" }}
        >
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span>
            <Kbd>↵</Kbd> open
          </span>
          <span>
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1 inline-grid h-[16px] min-w-[16px] place-items-center rounded border border-line-strong bg-[rgba(255,255,255,0.04)] px-1 font-mono text-[10px] text-fg-3">
      {children}
    </kbd>
  );
}

// Returns all keyboard-focusable elements inside `root` in document order.
// Excludes elements that are disabled or have tabindex="-1". Used by the
// palette's focus trap to cycle Tab / Shift+Tab among input + result rows.
function getFocusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
  );
}
