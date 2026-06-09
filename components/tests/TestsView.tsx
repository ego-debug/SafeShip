"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TestRow, TestsSnapshot } from "@/lib/tests";
import { ErrorBanner } from "@/components/ErrorBanner";

export function TestsView({ snapshot }: { snapshot: TestsSnapshot }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "active" | "muted">("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Remember the last failed action so the Retry button on the banner
  // can re-fire the exact same request without the user re-opening the
  // kebab menu.
  const [lastFailed, setLastFailed] = useState<{
    test: TestRow;
    action: "mute" | "unmute" | "delete";
  } | null>(null);

  const filtered = snapshot.tests
    .filter((t) => (filter === "all" ? true : t.status === filter))
    .filter((t) =>
      search.trim()
        ? t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.plain_english ?? "").toLowerCase().includes(search.toLowerCase())
        : true,
    );

  async function callAction(test: TestRow, action: "mute" | "unmute" | "delete") {
    setBusyId(test.id);
    setErr(null);
    try {
      const r = await fetch(`/api/tests/${test.id}/${action}`, { method: "POST" });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        const code = data.error ?? `${action}_failed`;
        setErr(humanizeTestsError(code, action, test.name));
        setLastFailed({ test, action });
        return;
      }
      setLastFailed(null);
      router.refresh();
    } catch {
      setErr(
        `Network error while trying to ${action} "${test.name}". Check your connection and try again.`,
      );
      setLastFailed({ test, action });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
              <span
                className="h-1.5 w-1.5 rounded-full bg-accent"
              />
              Regression suite
            </span>
            <h1 className="text-[clamp(28px,3vw,36px)] font-semibold leading-[1.1] tracking-[-0.025em]">
              {snapshot.totals.active} active{" "}
              {snapshot.totals.active === 1 ? "test" : "tests"}
              {snapshot.totals.muted > 0 && (
                <span className="ml-3 font-mono text-base text-fg-3">
                  · {snapshot.totals.muted} muted
                </span>
              )}
            </h1>
          </div>
          {snapshot.totals.pendingSuggestions > 0 && (
            <Link
              href="/app/suggestions"
              className="inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.35),0_12px_24px_-12px_rgba(0,0,0,0.55)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
            >
              Review {snapshot.totals.pendingSuggestions} suggestion
              {snapshot.totals.pendingSuggestions === 1 ? "" : "s"} →
            </Link>
          )}
        </header>

        {!snapshot.hasExecutionHistory && (
          <div
            className="rounded-xl border px-4 py-3 text-[13px] text-fg-2"
            style={{
              background: "rgba(245,193,74,0.06)",
              borderColor: "rgba(245,193,74,0.25)",
            }}
          >
            <b className="text-fg">Heads up:</b> the in-app test runner ships in
            a follow-up. For now this page lists your accepted regression-test
            definitions; pass/fail history will appear once the runner lands.
            CI-side gating already works. See{" "}
            <Link
              href="https://github.com/ego-debug/SafeShip#cigithub-action"
              className="text-accent hover:text-[#d3ff85]"
            >
              the README
            </Link>{" "}
            for the GitHub Action.
          </div>
        )}

        <FilterBar
          filter={filter}
          onFilter={setFilter}
          search={search}
          onSearch={setSearch}
          counts={{
            all: snapshot.tests.length,
            active: snapshot.totals.active,
            muted: snapshot.totals.muted,
          }}
        />

        {err && (
          <ErrorBanner
            message={err}
            onRetry={
              lastFailed
                ? () => callAction(lastFailed.test, lastFailed.action)
                : undefined
            }
            onDismiss={() => {
              setErr(null);
              setLastFailed(null);
            }}
          />
        )}

        {filtered.length === 0 ? (
          <EmptyState hasAny={snapshot.tests.length > 0} />
        ) : (
          <TestsTable tests={filtered} busyId={busyId} onAction={callAction} />
        )}
      </div>

      <aside className="flex flex-col gap-4">
        <SideCard title="Suite health">
          <HealthDonut
            active={snapshot.totals.active}
            muted={snapshot.totals.muted}
          />
        </SideCard>

        <SideCard title="Coverage">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-fg">
              {snapshot.weeklyRuns.toLocaleString()}
            </span>
            <span className="text-sm text-fg-3">runs / 7 days</span>
          </div>
          <p className="mt-2 text-[12.5px] text-fg-3">
            {snapshot.lastRunAt
              ? `Last run ${timeAgo(snapshot.lastRunAt)}`
              : "No runs yet. Send a trace from the Setup page."}
          </p>
        </SideCard>

        <SideCard title="What lives here">
          <p className="text-[13px] leading-relaxed text-fg-2">
            Tests you accept from the{" "}
            <Link
              href="/app/suggestions"
              className="text-accent hover:text-[#d3ff85]"
            >
              suggestions queue
            </Link>{" "}
            land here as active regression assertions. Mute one to silence
            without deleting; delete to remove it from the suite entirely.
          </p>
        </SideCard>
      </aside>
    </main>
  );
}

function FilterBar({
  filter,
  onFilter,
  search,
  onSearch,
  counts,
}: {
  filter: "all" | "active" | "muted";
  onFilter: (f: "all" | "active" | "muted") => void;
  search: string;
  onSearch: (s: string) => void;
  counts: { all: number; active: number; muted: number };
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-1.5">
        <Chip on={filter === "all"} onClick={() => onFilter("all")}>
          All <Count>{counts.all}</Count>
        </Chip>
        <Chip on={filter === "active"} onClick={() => onFilter("active")}>
          Active <Count>{counts.active}</Count>
        </Chip>
        <Chip on={filter === "muted"} onClick={() => onFilter("muted")}>
          Muted <Count>{counts.muted}</Count>
        </Chip>
      </div>
      <div className="relative">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by name or rule…"
          className="w-64 rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-sm text-fg outline-none transition-colors placeholder:text-fg-4 focus:border-[rgba(255,255,255,0.25)]"
        />
      </div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-[7px] border px-2.5 py-1 text-[12.5px] transition-colors ${
        on
          ? "border-[rgba(194,249,112,0.35)] bg-[rgba(194,249,112,0.10)] text-fg"
          : "border-line-strong bg-[rgba(255,255,255,0.02)] text-fg-3 hover:text-fg-2"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 font-mono text-[10.5px] text-fg-4">{children}</span>
  );
}

function TestsTable({
  tests,
  busyId,
  onAction,
}: {
  tests: TestRow[];
  busyId: string | null;
  onAction: (test: TestRow, action: "mute" | "unmute" | "delete") => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-line-strong"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
      }}
    >
      {/* Coverage column intentionally absent - it showed a dash for every
          row until the in-app test runner ships. Re-add it when there's
          real pass/fail history to put in it. */}
      <div
        className="grid items-center gap-4 border-b border-line px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-wide text-fg-4"
        style={{ gridTemplateColumns: "20px 1fr 80px 110px 32px" }}
      >
        <span></span>
        <span>Test</span>
        <span className="text-right">Status</span>
        <span className="text-right">Added</span>
        <span></span>
      </div>
      <ul className="flex flex-col">
        {tests.map((t, i) => (
          <li
            key={t.id}
            className={`${i === 0 ? "" : "border-t border-line"} ${
              t.status === "muted" ? "opacity-60" : ""
            }`}
          >
            <div
              className="grid items-center gap-4 px-4 py-3"
              style={{ gridTemplateColumns: "20px 1fr 80px 110px 32px" }}
            >
              <StatusDot status={t.status} />
              <div className="min-w-0">
                <div className="truncate font-mono text-[13px] text-fg">
                  {t.name}
                </div>
                {t.plain_english && (
                  <div className="truncate text-[12px] text-fg-3">
                    {t.plain_english}
                  </div>
                )}
                <ReplayBadges test={t} />
              </div>
              <span className="text-right font-mono text-[11px] text-fg-3">
                {t.status}
              </span>
              <span className="text-right font-mono text-[11px] text-fg-4">
                {timeAgo(t.created_at)}
              </span>
              <KebabMenu
                test={t}
                busy={busyId === t.id}
                onAction={(a) => onAction(t, a)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReplayBadges({ test }: { test: TestRow }) {
  const hasReplay = test.replay_input != null;
  const cachedCount = test.cached_llm_calls_count;
  const hasCache = cachedCount > 0;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {hasReplay ? (
        <Badge tone="ok" title="This test has a captured replay fixture and can run in CI.">
          <Dot tone="ok" />
          CI ready
        </Badge>
      ) : (
        <Link
          href="/app/suggestions"
          title="This test was accepted before the Phase-2 replay fixture shipped. Re-accept a fresh suggestion from the same run to enable CI replay."
          className="inline-flex items-center gap-1 rounded-full border border-[rgba(245,193,74,0.3)] bg-[rgba(245,193,74,0.08)] px-2 py-[2px] text-[10.5px] font-medium text-[#f5c14a] transition-colors hover:bg-[rgba(245,193,74,0.14)]"
        >
          <Dot tone="warn" />
          Re-accept to enable CI
        </Link>
      )}

      {hasCache && (
        <Badge
          tone="accent"
          title={`${cachedCount} cached LLM ${
            cachedCount === 1 ? "call" : "calls"
          }. This test replays for free in CI.`}
        >
          <Dot tone="accent" />
          LLM cached ({cachedCount})
        </Badge>
      )}

      {test.origin_run_id && (
        <Link
          href={`/app/runs/${test.origin_run_id}`}
          title="Open the failing run that produced this test."
          className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-[rgba(255,255,255,0.02)] px-2 py-[2px] text-[10.5px] font-medium text-fg-3 transition-colors hover:border-[rgba(255,255,255,0.2)] hover:text-fg-2"
        >
          Origin run
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

function Badge({
  tone,
  title,
  children,
}: {
  tone: "ok" | "warn" | "accent";
  title?: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.025)] text-fg-2"
      : tone === "accent"
      ? "border-[rgba(194,249,112,0.3)] bg-[rgba(194,249,112,0.08)] text-accent"
      : "border-[rgba(245,193,74,0.3)] bg-[rgba(245,193,74,0.08)] text-[#f5c14a]";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function Dot({ tone }: { tone: "ok" | "warn" | "accent" }) {
  const c =
    tone === "ok"
      ? "bg-fg-3"
      : tone === "accent"
      ? "bg-accent"
      : "bg-[#f5c14a]";
  return <span className={`h-1.5 w-1.5 rounded-full ${c}`} />;
}

function StatusDot({ status }: { status: TestRow["status"] }) {
  const color =
    status === "active"
      ? "bg-accent"
      : status === "muted"
      ? "bg-[#f5c14a]"
      : "bg-danger";
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

function KebabMenu({
  test,
  busy,
  onAction,
}: {
  test: TestRow;
  busy: boolean;
  onAction: (a: "mute" | "unmute" | "delete") => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="grid h-6 w-6 place-items-center rounded text-fg-3 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-fg disabled:opacity-40"
        aria-label="More actions"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-7 z-20 flex w-36 flex-col rounded-md border border-line-strong py-1 shadow-2xl"
            style={{ background: "#1a1a1d" }}
          >
            {test.status === "active" ? (
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onAction("mute");
                }}
              >
                Mute
              </MenuItem>
            ) : test.status === "muted" ? (
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onAction("unmute");
                }}
              >
                Unmute
              </MenuItem>
            ) : null}
            <MenuItem
              danger
              onClick={() => {
                if (confirm(`Delete "${test.name}"? This can't be undone.`)) {
                  setOpen(false);
                  onAction("delete");
                }
              }}
            >
              Delete
            </MenuItem>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[rgba(255,255,255,0.05)] ${
        danger ? "text-danger" : "text-fg-2"
      }`}
    >
      {children}
    </button>
  );
}

function HealthDonut({ active, muted }: { active: number; muted: number }) {
  const total = active + muted;
  if (total === 0) {
    return <p className="text-sm text-fg-3">No tests yet.</p>;
  }
  const activeAngle = (active / total) * 360;
  const r = 36;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#c2f970"
          strokeWidth="10"
          strokeDasharray={`${(activeAngle / 360) * c} ${c}`}
          transform="rotate(-90 50 50)"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col gap-1 text-[12px]">
        <span className="text-fg">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-accent" />
          {active} active
        </span>
        {muted > 0 && (
          <span className="text-fg-3">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#f5c14a]" />
            {muted} muted
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <section
      className="grid place-items-center rounded-2xl border border-dashed border-line-strong py-12 text-center"
      style={{ background: "rgba(255,255,255,0.015)" }}
    >
      <div className="flex max-w-md flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {hasAny ? "Nothing matches that filter." : "No tests yet."}
        </h2>
        <p className="text-fg-2">
          {hasAny
            ? "Try a different filter or clear the search."
            : "Accept your first suggestion from the queue and it'll land here."}
        </p>
        {!hasAny && (
          <Link
            href="/app/suggestions"
            className="mx-auto mt-2 inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.4)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
          >
            Review suggestions →
          </Link>
        )}
      </div>
    </section>
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

function humanizeTestsError(
  code: string,
  action: "mute" | "unmute" | "delete",
  name: string,
): string {
  const verbing =
    action === "mute" ? "muting" : action === "unmute" ? "unmuting" : "deleting";
  switch (code) {
    case "not_found":
      return `Couldn't find "${name}". It may have been deleted from another tab. Refresh and try again.`;
    case "invalid_transition":
      return `Can't ${action} "${name}" from its current state. Refresh and try again.`;
    case "unauthorized":
      return `You don't have permission to ${action} this test.`;
    default:
      return `Something went wrong ${verbing} "${name}". Try again, or refresh the page.`;
  }
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
