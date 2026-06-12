import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getAdminSnapshot, isAdmin, listAdminUsers, type ActivityItem } from "@/lib/admin";
import { hasAdminSession } from "@/lib/adminAuth";
import { UsersSection } from "@/components/admin/UsersSection";
import { PairedBars, StackedBars } from "@/components/admin/Charts";
import { deleteUserAction, deleteWaitlistAction, logoutAction } from "./actions";

export const dynamic = "force-dynamic";

// Owner-only command center. Two ways in: the standalone owner login at
// /admin/login (env credentials), or a signed-in Clerk session whose user
// id is in ADMIN_USER_IDS.
export default async function AdminPage() {
  if (!hasAdminSession()) {
    const { userId } = auth();
    if (!userId || !isAdmin(userId)) redirect("/admin/login");
  }

  const [s, users] = await Promise.all([getAdminSnapshot(), listAdminUsers()]);

  const funnelStages = [
    { label: "Signed up", value: s.funnel.signedUp },
    { label: "Created a project", value: s.funnel.createdProject },
    { label: "Sent first trace", value: s.funnel.sentFirstTrace },
    { label: "Got a suggestion", value: s.funnel.gotSuggestion },
    { label: "Accepted a test", value: s.funnel.acceptedTest },
  ];
  const funnelMax = Math.max(1, s.funnel.signedUp);
  // The stage with the worst conversion from its predecessor gets flagged.
  let worstIdx = -1;
  let worstDrop = 0;
  funnelStages.forEach((st, i) => {
    if (i === 0) return;
    const prev = funnelStages[i - 1].value;
    if (prev <= 0) return;
    const drop = (prev - st.value) / prev;
    if (drop > worstDrop) {
      worstDrop = drop;
      worstIdx = i;
    }
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      {/* header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Owner command center
          </span>
          <h1 className="text-[clamp(26px,3vw,34px)] font-semibold leading-[1.1] tracking-[-0.025em]">
            How SafeShip is doing
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/demo"
            className="rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[13px] text-fg-2 transition-colors hover:border-[rgba(255,255,255,0.25)] hover:text-fg"
          >
            Live demo
          </Link>
          <Link
            href="/app/dashboard"
            className="rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[13px] text-fg-2 transition-colors hover:border-[rgba(255,255,255,0.25)] hover:text-fg"
          >
            Open app
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-[13px] text-fg-3 transition-colors hover:border-[rgba(255,99,99,0.3)] hover:text-[#ff9c9c]"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* hero numbers */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <HeroStat
          label="MRR"
          value={`$${s.billing.mrr.toFixed(2)}`}
          sub={`${s.billing.active} paying · ${s.billing.trialing} on trial`}
          accent={s.billing.mrr > 0}
        />
        <HeroStat
          label="Registered users"
          value={s.users.total}
          sub={s.users.last7d > 0 ? `+${s.users.last7d} this week` : "none this week"}
        />
        <HeroStat
          label="Waitlist"
          value={s.waitlist.total}
          sub={s.waitlist.last7d > 0 ? `+${s.waitlist.last7d} this week` : "none this week"}
        />
        <HeroStat
          label="Runs / 7 days"
          value={s.runs.last7d}
          sub={`${s.runs.failures7d} failures · ${lastIngestLabel(s.runs.lastIngestAt)}`}
        />
      </section>

      {/* charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Traces ingested · last 14 days" sub="every agent run customers sent in; red = failed runs">
          <StackedBars
            days={s.charts.days}
            primary={s.charts.runs}
            secondary={s.charts.failures}
            primaryLabel="runs"
            secondaryLabel="failures"
          />
        </Card>
        <Card title="Signups · last 14 days" sub="registered users vs waitlist emails">
          <PairedBars
            days={s.charts.days}
            a={s.charts.signups}
            b={s.charts.waitlist}
            aLabel="users"
            bLabel="waitlist"
          />
        </Card>
      </section>

      {/* funnel + right rail */}
      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card
          title="Activation funnel"
          sub="how far each signup gets toward their first accepted test — fix the biggest drop first"
        >
          <ol className="flex flex-col gap-2.5">
            {funnelStages.map((stage, i) => {
              const prev = i === 0 ? null : funnelStages[i - 1].value;
              const dropoff =
                prev != null && prev > 0
                  ? Math.round(((prev - stage.value) / prev) * 100)
                  : null;
              const isWorst = i === worstIdx && worstDrop > 0;
              return (
                <li key={stage.label} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-[13px] text-fg-2">{stage.label}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-md bg-[rgba(255,255,255,0.04)]">
                    <div
                      className="h-full rounded-md"
                      style={{
                        width: `${(stage.value / funnelMax) * 100}%`,
                        background: isWorst
                          ? "linear-gradient(90deg, rgba(194,249,112,0.55), rgba(245,193,74,0.7))"
                          : "linear-gradient(90deg, rgba(194,249,112,0.75), rgba(194,249,112,0.45))",
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-[13px] tabular-nums text-fg">
                    {stage.value}
                  </span>
                  <span
                    className={`w-24 shrink-0 text-right font-mono text-[11px] ${
                      isWorst ? "text-[#f5c14a]" : "text-fg-4"
                    }`}
                  >
                    {dropoff != null && dropoff > 0
                      ? `−${dropoff}%${isWorst ? " ← worst" : ""}`
                      : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Suggest engine">
            <div className="flex flex-col gap-2.5 text-[13px]">
              <Row k="Status">
                <Dot ok={s.engine.configured} />
                {s.engine.configured ? "configured" : "no API key"}
              </Row>
              <Row k="Claude calls today">{s.engine.callsToday}</Row>
              <Row k="Accept rate">
                {s.engine.acceptRate != null ? `${s.engine.acceptRate}%` : "no decisions yet"}
              </Row>
              <Row k="Pending suggestions">{s.suggestions.pending}</Row>
              <Row k="Active tests (all)">{s.tests.active}</Row>
              <p className="mt-1 border-t border-line pt-2 text-[11.5px] leading-relaxed text-fg-4">
                Offline eval: 96.7% across hallucination, schema, silent-empty
                and tool-loop cases (June 12 baseline).
              </p>
            </div>
          </Card>

          <Card title="Integrations">
            <ul className="flex flex-col gap-2 text-[13px]">
              {s.integrations.map((it) => (
                <li key={it.name} className="flex items-center gap-2.5">
                  <Dot ok={it.ok} />
                  <span className="w-20 text-fg">{it.name}</span>
                  <span className="text-[12px] text-fg-4">{it.note}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* activity + people */}
      <section className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="Recent activity" sub="everything that happened, newest first">
          {s.activity.length === 0 ? (
            <p className="text-sm text-fg-3">Quiet so far.</p>
          ) : (
            <ol className="flex flex-col">
              {s.activity.map((a, i) => (
                <li
                  key={`${a.at}-${i}`}
                  className={`flex gap-2.5 py-2 ${i === 0 ? "" : "border-t border-line"}`}
                >
                  <ActivityIcon kind={a.kind} />
                  <div className="min-w-0">
                    <p className="break-words text-[12.5px] leading-snug text-fg-2">{a.text}</p>
                    <p className="font-mono text-[10.5px] text-fg-4">{timeAgo(a.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <UsersSection users={users} deleteUser={deleteUserAction} />

          <Card title="Latest waitlist signups">
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
                    className={`flex items-baseline gap-4 py-2 ${i === 0 ? "" : "border-t border-line"}`}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-fg">
                      {w.email}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-fg-4">
                      {new Date(w.created_at).toLocaleString()}
                    </span>
                    <form action={deleteWaitlistAction}>
                      <input type="hidden" name="email" value={w.email} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-[7px] border border-line-strong px-2 py-0.5 text-[11px] text-fg-3 transition-colors hover:border-[rgba(255,99,99,0.3)] hover:text-[#ff9c9c]"
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </main>
  );
}

function Card({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border border-line-strong p-5"
      style={{ background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)" }}
    >
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-4">{title}</h2>
      {sub && <p className="mt-0.5 text-[12px] text-fg-4">{sub}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function HeroStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
        borderColor: accent ? "rgba(194,249,112,0.35)" : undefined,
      }}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-4">{label}</div>
      <div className={`mt-2 text-[28px] font-semibold leading-none tabular-nums ${accent ? "text-accent" : "text-fg"}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12.5px] text-fg-3">{sub}</div>}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-3">{k}</span>
      <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] tabular-nums text-fg">
        {children}
      </span>
    </div>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? "bg-accent" : "bg-[#f5c14a]"}`}
    />
  );
}

function ActivityIcon({ kind }: { kind: ActivityItem["kind"] }) {
  const tone =
    kind === "failure"
      ? "bg-[rgba(255,99,99,0.85)]"
      : kind === "accepted"
        ? "bg-accent"
        : kind === "suggestion"
          ? "bg-[rgba(125,211,252,0.8)]"
          : "bg-[rgba(245,193,74,0.8)]";
  return <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${tone}`} />;
}

function lastIngestLabel(iso: string | null): string {
  if (!iso) return "no traces yet";
  return `last trace ${timeAgo(iso)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
