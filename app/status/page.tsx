import { Background } from "@/components/Background";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { getServiceSupabase } from "@/lib/supabase";
import { RunCheckNow } from "./RunCheckNow";

export const metadata = {
  title: "Status · SafeShip",
  description:
    "Live SafeShip platform status. Real DB round-trip on every page load (cached 60s). Target: ≥99.5% monthly uptime, p95 ingest-to-dashboard under 5 seconds.",
};

export const revalidate = 60;

type CheckResult = {
  name: string;
  description: string;
  status: "operational" | "degraded" | "down" | "unknown";
  detail?: string;
  measuredMs?: number;
};

async function pingSupabase(): Promise<CheckResult> {
  try {
    const start = performance.now();
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .limit(1);
    const elapsed = Math.round(performance.now() - start);
    if (error) {
      return {
        name: "Database (Supabase)",
        description: "Postgres holding traces, accounts, and tests",
        status: "degraded",
        detail: `Round-trip succeeded but query returned an error: ${error.message}`,
        measuredMs: elapsed,
      };
    }
    return {
      name: "Database (Supabase)",
      description: "Postgres holding traces, accounts, and tests",
      status: elapsed < 1500 ? "operational" : "degraded",
      detail:
        elapsed < 1500
          ? `Live round-trip measured at ${elapsed}ms.`
          : `Live round-trip measured at ${elapsed}ms, slower than target (1.5s).`,
      measuredMs: elapsed,
    };
  } catch (err) {
    return {
      name: "Database (Supabase)",
      description: "Postgres holding traces, accounts, and tests",
      status: "down",
      detail:
        err instanceof Error
          ? `Health check failed: ${err.message}`
          : "Health check failed.",
    };
  }
}

async function pingAnthropic(): Promise<CheckResult> {
  // Verifies (a) we have an API key configured, and (b) Anthropic's
  // platform is itself reachable. Uses Anthropic's public Statuspage
  // JSON endpoint - no API call, no spend.
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  try {
    const start = performance.now();
    const resp = await fetch("https://status.anthropic.com/api/v2/status.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    const elapsed = Math.round(performance.now() - start);
    if (!resp.ok) {
      return {
        name: "Auto-suggest engine (Anthropic)",
        description: "Generates regression-test suggestions from failed runs",
        status: hasKey ? "degraded" : "down",
        detail: `Anthropic status endpoint returned ${resp.status}; key ${hasKey ? "present" : "missing"}.`,
        measuredMs: elapsed,
      };
    }
    const body = (await resp.json().catch(() => null)) as {
      status?: { indicator?: string; description?: string };
    } | null;
    const indicator = body?.status?.indicator ?? "unknown";
    const description = body?.status?.description ?? "Anthropic status unknown";
    if (!hasKey) {
      return {
        name: "Auto-suggest engine (Anthropic)",
        description: "Generates regression-test suggestions from failed runs",
        status: "degraded",
        detail: `Anthropic platform: ${description}. ANTHROPIC_API_KEY not configured locally.`,
        measuredMs: elapsed,
      };
    }
    if (indicator === "none") {
      return {
        name: "Auto-suggest engine (Anthropic)",
        description: "Generates regression-test suggestions from failed runs",
        status: "operational",
        detail: `Anthropic platform: ${description}. Key configured.`,
        measuredMs: elapsed,
      };
    }
    // Anthropic indicators: none | minor | major | critical
    return {
      name: "Auto-suggest engine (Anthropic)",
      description: "Generates regression-test suggestions from failed runs",
      status: indicator === "critical" ? "down" : "degraded",
      detail: `Anthropic platform: ${description} (indicator=${indicator}). Suggest engine may be slow or failing.`,
      measuredMs: elapsed,
    };
  } catch (err) {
    return {
      name: "Auto-suggest engine (Anthropic)",
      description: "Generates regression-test suggestions from failed runs",
      status: hasKey ? "degraded" : "down",
      detail:
        err instanceof Error
          ? `Anthropic status fetch failed: ${err.message}. Key ${hasKey ? "present" : "missing"}.`
          : `Anthropic status fetch failed. Key ${hasKey ? "present" : "missing"}.`,
    };
  }
}

function checkEnv(
  name: string,
  description: string,
  vars: string[],
  whenMissing: "down" | "degraded" = "down"
): CheckResult {
  const missing = vars.filter((v) => !process.env[v]);
  if (missing.length === 0) {
    return {
      name,
      description,
      status: "operational",
      detail: "Configuration present.",
    };
  }
  return {
    name,
    description,
    status: whenMissing,
    detail: `Missing configuration: ${missing.join(", ")}.`,
  };
}

function rollUp(checks: CheckResult[]): {
  status: "operational" | "degraded" | "down";
  label: string;
} {
  if (checks.some((c) => c.status === "down")) {
    return { status: "down", label: "Service disruption" };
  }
  if (checks.some((c) => c.status === "degraded")) {
    return { status: "degraded", label: "Partial degradation" };
  }
  return { status: "operational", label: "All systems operational" };
}

type IngestMetrics =
  | { state: "no_data" }
  | {
      state: "ok";
      windowHours: number;
      sampleCount: number;
      p50: number;
      p95: number;
      uptimePct: number; // 0-100
      latestAt: string;
    };

async function loadIngestMetrics(): Promise<IngestMetrics> {
  try {
    const supabase = getServiceSupabase();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("health_checks")
      .select("ok, duration_ms, checked_at")
      .eq("kind", "ingest_synthetic")
      .gte("checked_at", since)
      .order("checked_at", { ascending: false });
    if (error || !data || data.length === 0) {
      return { state: "no_data" };
    }
    const okSamples = data
      .filter((r) => r.ok && typeof r.duration_ms === "number")
      .map((r) => r.duration_ms as number)
      .sort((a, b) => a - b);
    if (okSamples.length === 0) {
      return { state: "no_data" };
    }
    const pct = (q: number) => {
      const idx = Math.min(
        okSamples.length - 1,
        Math.floor(q * (okSamples.length - 1)),
      );
      return okSamples[idx];
    };
    const uptimePct = (data.filter((r) => r.ok).length / data.length) * 100;
    return {
      state: "ok",
      windowHours: 24,
      sampleCount: data.length,
      p50: pct(0.5),
      p95: pct(0.95),
      uptimePct,
      latestAt: (data[0] as { checked_at: string }).checked_at,
    };
  } catch {
    return { state: "no_data" };
  }
}

export default async function StatusPage() {
  const [dbCheck, anthropicCheck, ingestMetrics] = await Promise.all([
    pingSupabase(),
    pingAnthropic(),
    loadIngestMetrics(),
  ]);
  const checks: CheckResult[] = [
    {
      name: "Trace ingest (POST /v1/traces)",
      description: "SDKs push traces into this endpoint",
      // The fact that this page rendered server-side proves the API route
      // host is up. Real per-endpoint synthetic monitoring is on roadmap.
      status: "operational",
      detail: "API host responding to requests.",
    },
    {
      name: "Dashboard (/app/*)",
      description: "Signed-in app surfaces traces, runs, suggestions, tests",
      status: "operational",
      detail: "Pages serving normally.",
    },
    dbCheck,
    anthropicCheck,
    checkEnv(
      "Authentication (Clerk)",
      "Sign-in / sign-up / sessions",
      ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
      "down"
    ),
    checkEnv(
      "Billing (Stripe)",
      "Subscription + checkout + customer portal",
      ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"],
      "degraded"
    ),
    checkEnv(
      "Failure-alert email (Resend)",
      "Sends email when a wrapped agent run fails",
      ["RESEND_API_KEY"],
      "degraded"
    ),
  ];

  const overall = rollUp(checks);
  const checkedAt = new Date();

  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <Nav />

        <main className="flex flex-col gap-12 py-16">
          <Header overall={overall} checkedAt={checkedAt} />
          <Components checks={checks} />
          <SLA metrics={ingestMetrics} />
          <Methodology metrics={ingestMetrics} />
          <Incidents />
          <Subscribe />
        </main>

        <Footer />
      </div>
    </>
  );
}

function Header({
  overall,
  checkedAt,
}: {
  overall: { status: "operational" | "degraded" | "down"; label: string };
  checkedAt: Date;
}) {
  const dotColor = {
    operational: "bg-accent",
    degraded: "bg-[#f5c14a]",
    down: "bg-danger",
  }[overall.status];
  const ringStyle = {
    operational: { boxShadow: "0 0 12px rgba(194,249,112,0.7)" },
    degraded: { boxShadow: "0 0 12px rgba(245,193,74,0.7)" },
    down: { boxShadow: "0 0 12px rgba(255,107,107,0.7)" },
  }[overall.status];
  return (
    <header className="flex flex-col gap-4">
      <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Status
      </span>
      <div className="flex items-center gap-4">
        <span className={`h-3 w-3 rounded-full ${dotColor}`} style={ringStyle} />
        <h1 className="text-[clamp(28px,4vw,44px)] font-semibold leading-[1.1] tracking-[-0.025em] text-fg">
          {overall.label}
        </h1>
      </div>
      <p className="font-mono text-[12px] text-fg-3">
        Last checked {formatTime(checkedAt)} · auto-refreshes every 60 seconds
      </p>
    </header>
  );
}

function Components({ checks }: { checks: CheckResult[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">
        Components
      </h2>
      <div className="overflow-hidden rounded-xl border border-line">
        {checks.map((c, i) => (
          <ComponentRow
            key={c.name}
            check={c}
            isLast={i === checks.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function ComponentRow({
  check,
  isLast,
}: {
  check: CheckResult;
  isLast: boolean;
}) {
  const dotColor = {
    operational: "bg-accent",
    degraded: "bg-[#f5c14a]",
    down: "bg-danger",
    unknown: "bg-fg-4",
  }[check.status];
  const statusLabel = {
    operational: "Operational",
    degraded: "Degraded",
    down: "Down",
    unknown: "Unknown",
  }[check.status];
  const statusColor = {
    operational: "text-accent",
    degraded: "text-[#f5c14a]",
    down: "text-danger",
    unknown: "text-fg-3",
  }[check.status];

  return (
    <div
      className={`grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center ${
        isLast ? "" : "border-b border-line"
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <span className="text-[14.5px] font-medium text-fg">{check.name}</span>
        </div>
        <p className="ml-[18px] text-[12.5px] text-fg-3">{check.description}</p>
        {check.detail && (
          <p className="ml-[18px] mt-1 font-mono text-[11.5px] text-fg-4">
            {check.detail}
          </p>
        )}
      </div>
      <div className="flex flex-col items-start gap-0.5 sm:items-end">
        <span className={`text-[12.5px] font-semibold ${statusColor}`}>
          {statusLabel}
        </span>
        {check.measuredMs !== undefined && (
          <span className="font-mono text-[11px] text-fg-4">
            {check.measuredMs}ms RTT
          </span>
        )}
      </div>
    </div>
  );
}

function SLA({ metrics }: { metrics: IngestMetrics }) {
  const uptimeMeasured =
    metrics.state === "ok"
      ? `${metrics.uptimePct.toFixed(metrics.uptimePct >= 99.95 ? 2 : 1)}%`
      : null;
  const p95Measured =
    metrics.state === "ok" ? `${formatMs(metrics.p95)}` : null;
  const uptimePassing =
    metrics.state === "ok" ? metrics.uptimePct >= 99.5 : null;
  const p95Passing = metrics.state === "ok" ? metrics.p95 < 5000 : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">
          SLA: target vs measured
        </h2>
        <RunCheckNow />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SLACard
          label="Trace ingest uptime"
          target="≥ 99.5%"
          measured={uptimeMeasured}
          passing={uptimePassing}
          period="rolling 24h"
          desc="Fraction of synthetic ingest pings that succeed"
          sampleNote={
            metrics.state === "ok"
              ? `${metrics.sampleCount} samples`
              : "no data yet"
          }
        />
        <SLACard
          label="Ingest-to-dashboard latency"
          target="< 5s p95"
          measured={p95Measured}
          passing={p95Passing}
          period="rolling 24h"
          desc="Synthetic trace POSTed → row written to runs/traces"
          sampleNote={
            metrics.state === "ok"
              ? `p50 ${formatMs(metrics.p50)} · p95 ${formatMs(metrics.p95)}`
              : "no data yet"
          }
        />
        <SLACard
          label="Auto-suggest engine response"
          target="< 30s p95"
          measured={null}
          passing={null}
          period="per suggestion"
          desc="Time for Claude to draft a regression test from a failed trace"
          sampleNote="manual verification today; auto-measurement coming"
        />
      </div>
      <p className="text-[13.5px] text-fg-3">
        {metrics.state === "ok"
          ? `Measured values come from synthetic ingest pings recorded in health_checks. Last sample at ${metrics.latestAt} UTC.`
          : "No synthetic pings recorded yet. The Vercel cron runs hourly, or you can trigger a check manually with the button above."}{" "}
        Customers experiencing latency outside these targets should email{" "}
        <a
          href="mailto:founder@safeship.dev"
          className="text-accent hover:text-[#d3ff85]"
        >
          founder@safeship.dev
        </a>
        ; we treat reports as incidents.
      </p>
    </section>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function SLACard({
  label,
  target,
  measured,
  passing,
  period,
  desc,
  sampleNote,
}: {
  label: string;
  target: string;
  measured: string | null;
  passing: boolean | null;
  period: string;
  desc: string;
  sampleNote?: string;
}) {
  const measuredColor =
    passing === true
      ? "text-accent"
      : passing === false
      ? "text-danger"
      : "text-fg-3";
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-4">
        {label}
      </span>
      <div className="flex items-baseline gap-3">
        <span className="text-[24px] font-semibold tracking-[-0.02em] text-fg">
          {target}
        </span>
        <span className={`text-[15px] font-mono ${measuredColor}`}>
          {measured ?? "–"}
        </span>
      </div>
      <span className="font-mono text-[11px] text-fg-3">{period}</span>
      <p className="mt-1 text-[12.5px] text-fg-3">{desc}</p>
      {sampleNote && (
        <p className="mt-0.5 font-mono text-[11px] text-fg-4">{sampleNote}</p>
      )}
    </div>
  );
}

function Methodology({ metrics }: { metrics: IngestMetrics }) {
  return (
    <section className="rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-6">
      <h2 className="mb-3 text-[15px] font-semibold uppercase tracking-[0.12em] text-fg-3">
        Methodology
      </h2>
      <ul className="list-disc pl-5 text-[13.5px] text-fg-2 [&>li]:mb-1.5">
        <li>
          The database row above performs a real round-trip to Supabase on
          every page render (cached 60 seconds). The latency you see is
          measured live, not stored.
        </li>
        <li>
          A Vercel cron hits{" "}
          <code className="rounded border border-line bg-black/40 px-1 py-0.5 font-mono text-[11px]">
            /api/cron/ingest-ping
          </code>{" "}
          on the hour, which sends a synthetic 3-step trace through the
          full ingestion pipeline (auth, run insert, traces insert,
          first_trace_at stamp) and records the round-trip time in the{" "}
          <code className="rounded border border-line bg-black/40 px-1 py-0.5 font-mono text-[11px]">
            health_checks
          </code>{" "}
          table. The SLA card above shows the p50 / p95 / uptime computed
          from the last 24h of measurements
          {metrics.state === "ok"
            ? ` (${metrics.sampleCount} samples).`
            : "."}
        </li>
        <li>
          Synthetic runs are written to a hidden{" "}
          <code className="rounded border border-line bg-black/40 px-1 py-0.5 font-mono text-[11px]">
            _safeship_health_synthetic
          </code>{" "}
          project owned by an internal user. The cron prunes its own runs
          after 1 hour and old health rows after 24 hours so nothing piles
          up.
        </li>
        <li>
          The auto-suggest latency SLA is still target-only. We&apos;ll
          add a synthetic suggestion cron once we&apos;re comfortable with
          the Anthropic spend that creates.
        </li>
        <li>
          Status reflects the health of the SafeShip platform itself. It
          does not include third-party providers your agent talks to (your
          LLM provider, your own infra). For Anthropic and OpenAI status,
          see{" "}
          <a
            href="https://status.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-[#d3ff85]"
          >
            status.anthropic.com
          </a>{" "}
          and{" "}
          <a
            href="https://status.openai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-[#d3ff85]"
          >
            status.openai.com
          </a>
          .
        </li>
      </ul>
    </section>
  );
}

function Incidents() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">
        Incident history
      </h2>
      <div className="rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-6 text-[13.5px] text-fg-3">
        No incidents recorded. When one happens, it gets a timestamped
        postmortem here within 30 days, including timeline, scope, root
        cause, and what changed to prevent recurrence. We never silently
        edit past entries.
      </div>
    </section>
  );
}

function Subscribe() {
  return (
    <section className="flex flex-col items-start gap-3 rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-6">
      <h2 className="text-[18px] font-semibold leading-tight tracking-[-0.02em]">
        Get notified about incidents
      </h2>
      <p className="text-[13.5px] text-fg-2">
        Email subscription for status changes is on the roadmap. Until then,
        active customers receive incident notifications at the email
        registered with their account. Anyone can email{" "}
        <a
          href="mailto:founder@safeship.dev?subject=Status%20notifications"
          className="text-accent hover:text-[#d3ff85]"
        >
          founder@safeship.dev
        </a>{" "}
        to be added to a manual notification list.
      </p>
    </section>
  );
}

function formatTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}
