import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAdminSnapshot, isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Owner-only metrics page. Not linked from any nav — go to /app/admin
// directly. Non-admin users get a 404 so the route stays invisible.
// Deliberately skips requireAccess(): the owner shouldn't be bounced to
// billing to read their own numbers.
export default async function AdminPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");
  if (!isAdmin(userId)) notFound();

  const s = await getAdminSnapshot();

  return (
    <main className="flex flex-col gap-8 py-10">
      <header className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Owner metrics
        </span>
        <h1 className="text-[clamp(28px,3vw,36px)] font-semibold leading-[1.1] tracking-[-0.025em]">
          How SafeShip is doing
        </h1>
        <p className="text-sm text-fg-3">
          Live counts across every account. Only you can see this page.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Waitlist signups" value={s.waitlist.total} sub={`${s.waitlist.last7d} this week`} />
        <Stat label="Registered users" value={s.users.total} sub={`${s.users.last7d} this week`} />
        <Stat label="Projects activated" value={s.projects.activated} sub={`of ${s.projects.total} created`} />
        <Stat label="Active tests" value={s.tests.active} sub="across all customers" />
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Runs / 24h" value={s.runs.last24h} sub={lastIngestLabel(s.runs.lastIngestAt)} />
        <Stat label="Runs / 7d" value={s.runs.last7d} sub={`${s.runs.failures7d} failures`} />
        <Stat label="Suggestions pending" value={s.suggestions.pending} sub="awaiting review" />
        <Stat
          label="Suggestion accept rate"
          value={acceptRate(s.suggestions.accepted, s.suggestions.skipped)}
          sub={`${s.suggestions.accepted} accepted · ${s.suggestions.skipped} skipped`}
        />
      </section>

      <section
        className="rounded-2xl border border-line-strong p-5"
        style={{ background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)" }}
      >
        <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-4">
          Latest waitlist signups
        </h2>
        {s.waitlist.recent.length === 0 ? (
          <p className="text-sm text-fg-3">
            No signups yet. The landing-page form writes here the moment
            someone joins.
          </p>
        ) : (
          <ul className="flex flex-col">
            {s.waitlist.recent.map((w, i) => (
              <li
                key={`${w.email}-${w.created_at}`}
                className={`flex items-baseline justify-between gap-4 py-2 ${i === 0 ? "" : "border-t border-line"}`}
              >
                <span className="truncate font-mono text-[13px] text-fg">{w.email}</span>
                <span className="shrink-0 font-mono text-[11px] text-fg-4">
                  {new Date(w.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div
      className="rounded-2xl border border-line-strong p-5"
      style={{ background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)" }}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-4">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-fg">{value}</div>
      {sub && <div className="mt-1 text-[12.5px] text-fg-3">{sub}</div>}
    </div>
  );
}

function acceptRate(accepted: number, skipped: number): string {
  const total = accepted + skipped;
  if (total === 0) return "–";
  return `${Math.round((accepted / total) * 100)}%`;
}

function lastIngestLabel(iso: string | null): string {
  if (!iso) return "no traces yet";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "last trace just now";
  if (mins < 60) return `last trace ${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `last trace ${h}h ago`;
  return `last trace ${Math.floor(h / 24)}d ago`;
}
