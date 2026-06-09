"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { maskApiKey } from "@/lib/apiKey";
import { ErrorBanner } from "@/components/ErrorBanner";

type Tab = "python" | "curl";
type Status = "waiting" | "success";

export function OnboardingView({
  apiKey,
  projectId,
  firstTraceAt,
  alertsEnabled,
  slackWebhookUrl,
}: {
  apiKey: string;
  projectId: string;
  firstTraceAt: string | null;
  alertsEnabled: boolean;
  slackWebhookUrl: string | null;
}) {
  const [tab, setTab] = useState<Tab>("python");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"ok" | "failed" | false>(false);
  const [status, setStatus] = useState<Status>(firstTraceAt ? "success" : "waiting");
  const [sending, setSending] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);

  const shownKey = revealed ? apiKey : maskApiKey(apiKey);

  const snippet = useMemo(() => buildSnippet(tab, apiKey), [tab, apiKey]);

  // Light polling so a trace landing from outside flips the screen to success.
  useEffect(() => {
    if (status === "success") return;
    const i = setInterval(async () => {
      // Skip the round-trip while the tab is hidden - the user can't see
      // the flip anyway, and the interval keeps running until they return.
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch(`/api/projects/${projectId}/status`, {
          cache: "no-store",
        });
        const data = (await r.json()) as { first_trace_at: string | null };
        if (data.first_trace_at) setStatus("success");
      } catch {
        // silent - keep polling
      }
    }, 4000);
    return () => clearInterval(i);
  }, [projectId, status]);

  async function copy() {
    // Clipboard access can be denied (browser privacy settings, insecure
    // context). Without the catch, the rejection is silent and the UI
    // would claim "copied" when nothing was.
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendTestTrace() {
    setSending(true);
    setSendErr(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/test-trace`, {
        method: "POST",
      });
      const data = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        run_id?: string;
        error?: string;
      };
      if (!r.ok) {
        // Don't silently flip to success if the trace insertion failed -
        // earlier code did that and customers got a false "success" state
        // with no actual trace on their dashboard.
        setSendErr(
          data.error
            ? `Couldn't send a test trace: ${data.error}. Try again, or send a real trace from your agent code.`
            : `Couldn't send a test trace (HTTP ${r.status}). Try again, or send a real trace from your agent code.`,
        );
        return;
      }
      if (data.run_id) setLastRunId(data.run_id);
      setStatus("success");
    } catch {
      setSendErr(
        "Network error sending a test trace. Check your connection and try again.",
      );
    } finally {
      setSending(false);
    }
  }

  const stepperStates: Array<"done" | "active" | "pending"> =
    status === "success" ? ["done", "done", "active"] : ["active", "pending", "pending"];

  return (
    <main className="grid grid-cols-1 gap-10 py-12 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-fg-3">
            <span
              className="h-1.5 w-1.5 rounded-full bg-accent"
            />
            Setup
          </span>
          <h1 className="text-[clamp(28px,3vw,38px)] font-semibold leading-[1.1] tracking-[-0.025em]">
            Get your first trace in 5 minutes.
          </h1>
        </header>

        <Stepper states={stepperStates} />

        <CodeBlock
          tab={tab}
          onTab={setTab}
          code={snippet}
          onCopy={copy}
          copied={copied}
        />

        <div className="flex flex-wrap items-center gap-3 text-[13px] text-fg-3">
          <span>Your API key:</span>
          <code className="rounded border border-line bg-black/40 px-2 py-1 font-mono text-[12.5px] text-fg">
            {shownKey}
          </code>
          <button
            onClick={() => setRevealed((r) => !r)}
            className="text-accent transition-colors hover:text-[#d3ff85]"
          >
            {revealed ? "Hide" : "Reveal full key →"}
          </button>
        </div>

        <StatusIndicator status={status} />

        {status === "success" && <SuggestionsTeaser />}

        <AlertsPanel
          projectId={projectId}
          initialEnabled={alertsEnabled}
          initialSlack={slackWebhookUrl}
        />

        {sendErr && (
          <ErrorBanner
            message={sendErr}
            onRetry={sendTestTrace}
            onDismiss={() => setSendErr(null)}
          />
        )}

        {status === "waiting" ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={sendTestTrace}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-4 py-2.5 text-sm text-fg transition-colors hover:border-[rgba(255,255,255,0.25)] disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send us a test trace"}
              <span className="text-fg-3">→</span>
            </button>
            <Link href="/app/dashboard" className="text-sm text-fg-3 hover:text-fg-2">
              Skip for now
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/app/dashboard"
              className="inline-flex items-center gap-2 rounded-[9px] bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-[0_0_0_1px_rgba(194,249,112,0.35),0_12px_24px_-12px_rgba(0,0,0,0.55)] transition hover:-translate-y-px hover:bg-[#d3ff85]"
            >
              View your dashboard →
            </Link>
            {lastRunId && (
              <Link
                href={`/app/runs/${lastRunId}`}
                className="text-sm text-fg-3 hover:text-fg-2"
              >
                or inspect this trace step-by-step →
              </Link>
            )}
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-6">
        <SideCard title="Need help?">
          <ul className="flex flex-col gap-3 text-sm">
            <SideLink
              href="/docs"
              label="Read the setup guide"
              sub="install · wrap · ship"
            />
            <SideLink
              href="mailto:founder@safeship.dev"
              label="Email founder@safeship.dev"
              sub="solo founder · usually same day"
            />
          </ul>
        </SideCard>
        <SideCard title="What happens next">
          <ol className="flex flex-col gap-3 text-[13.5px] text-fg-2">
            <li><b className="font-medium text-fg">1.</b> First trace lands → this page flips to success.</li>
            <li><b className="font-medium text-fg">2.</b> Every run is watched. Failures land on the dashboard within seconds.</li>
            <li><b className="font-medium text-fg">3.</b> As soon as a failure lands, SafeShip drafts a regression test from the trace. You accept in one tap. It lands in your suite and runs on every PR.</li>
          </ol>
        </SideCard>
      </aside>
    </main>
  );
}

function SuggestionsTeaser() {
  // Shown on the onboarding SUCCESS state, after the first trace lands.
  // The brief mandates pointing users at the suggestions queue here -
  // it's the moment they understand the value loop (failure → drafted
  // test → one-tap accept → guard on every PR). The preview uses a
  // realistic-but-sample suggestion so the empty queue at /app/suggestions
  // doesn't feel like a dead end on a brand-new project.
  return (
    <section
      className="flex flex-col gap-5 rounded-2xl border border-line-strong p-5"
      style={{
        background:
          "linear-gradient(180deg, rgba(194,249,112,0.04) 0%, rgba(255,255,255,0.015) 100%)",
      }}
    >
      <header className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-accent">
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent"
          />
          Next
        </span>
        <h3 className="text-[18px] font-semibold leading-snug tracking-[-0.01em] text-fg">
          Regression tests build themselves from your failures.
        </h3>
        <p className="text-[13.5px] leading-relaxed text-fg-2">
          When your agent fails in production, SafeShip drafts a YAML
          regression test from the trace. You accept in one tap; it lands
          in your suite and blocks the next PR that reintroduces the bug.
        </p>
      </header>

      <div
        className="rounded-xl border border-line bg-black/30 p-4"
        aria-label="Sample suggested test preview"
      >
        <div className="mb-2.5 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em]"
            style={{
              background: "rgba(244,114,114,0.10)",
              borderColor: "rgba(244,114,114,0.30)",
              color: "#f47272",
            }}
          >
            <span className="h-1 w-1 rounded-full bg-[#f47272]" />
            High severity
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-4">
            sample · what one looks like
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.1fr]">
          <p className="text-[13px] leading-relaxed text-fg-2">
            If the agent calls{" "}
            <code className="rounded border border-line bg-black/40 px-1 py-0.5 font-mono text-[11px] text-fg">
              send_email
            </code>{" "}
            with an empty subject line, fail the run before it reaches the
            customer.
          </p>
          <pre className="overflow-x-auto rounded-md border border-line bg-black/40 px-3 py-2 font-mono text-[11.5px] leading-[1.55] text-fg">
            <code>{`test: empty_subject_blocks_send
when: tool == 'send_email'
assert: input.subject != ''`}</code>
          </pre>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/app/suggestions"
          className="inline-flex items-center gap-2 rounded-[9px] border border-line-strong bg-[rgba(255,255,255,0.02)] px-4 py-2.5 text-sm text-fg transition-colors hover:border-[rgba(255,255,255,0.25)]"
        >
          See the suggestions queue
          <span className="text-fg-3">→</span>
        </Link>
        <span className="text-[12.5px] text-fg-3">
          Empty until your first failure lands. That&apos;s by design.
        </span>
      </div>
    </section>
  );
}

function AlertsPanel({
  projectId,
  initialEnabled,
  initialSlack,
}: {
  projectId: string;
  initialEnabled: boolean;
  initialSlack: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [slack, setSlack] = useState(initialSlack ?? "");
  const [savedSlack, setSavedSlack] = useState(initialSlack ?? "");
  const [saving, setSaving] = useState<"toggle" | "slack" | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // Track the last failed PATCH body so the banner's Retry button can
  // re-fire the same request.
  const [lastFailedBody, setLastFailedBody] = useState<{
    body: Record<string, unknown>;
    kind: "toggle" | "slack";
  } | null>(null);

  async function patch(body: Record<string, unknown>, kind: "toggle" | "slack") {
    setSaving(kind);
    setOkMsg(null);
    setErrMsg(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/alerts`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!r.ok) {
        setErrMsg(
          data.detail ||
            data.error ||
            `Couldn't save alert settings (HTTP ${r.status}). Try again.`,
        );
        setLastFailedBody({ body, kind });
        return false;
      }
      setLastFailedBody(null);
      setOkMsg("Saved.");
      setTimeout(() => setOkMsg(null), 1500);
      return true;
    } catch (err) {
      setErrMsg(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "Network error. Check your connection and try again.",
      );
      setLastFailedBody({ body, kind });
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function onToggle() {
    const next = !enabled;
    setEnabled(next);
    const ok = await patch({ alerts_enabled: next }, "toggle");
    if (!ok) setEnabled(!next); // revert on failure
  }

  async function onSaveSlack() {
    const trimmed = slack.trim();
    if (trimmed && !trimmed.startsWith("https://hooks.slack.com/")) {
      // Client-side validation - not a network failure, no retry needed.
      setErrMsg("Slack webhook URL must start with https://hooks.slack.com/");
      setLastFailedBody(null);
      return;
    }
    const ok = await patch({ slack_webhook_url: trimmed || null }, "slack");
    if (ok) setSavedSlack(trimmed);
  }

  const slackDirty = slack.trim() !== (savedSlack ?? "");

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line bg-[rgba(255,255,255,0.015)] p-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-fg">Failure alerts</h3>
          <p className="mt-1 text-[12.5px] text-fg-3">
            Throttled to one alert per 10 minutes, max 10 per day. We send
            on any run with <code className="rounded border border-line bg-black/40 px-1 py-0.5 font-mono text-[11px]">status=fail</code>.
          </p>
        </div>
        <label className="flex flex-shrink-0 cursor-pointer items-center gap-2.5">
          <span className="text-[13px] text-fg-2">
            {enabled ? "On" : "Off"}
          </span>
          <button
            type="button"
            onClick={onToggle}
            disabled={saving === "toggle"}
            aria-pressed={enabled}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
              enabled ? "bg-accent" : "bg-[#2a2a2e]"
            } disabled:opacity-60`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-[18px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </label>
      </header>

      <div className="grid gap-2">
        <label className="text-[12px] font-medium uppercase tracking-[0.12em] text-fg-4">
          Slack incoming webhook URL (optional)
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={slack}
            onChange={(e) => setSlack(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="min-w-[260px] flex-1 rounded-md border border-line bg-black/40 px-3 py-2 font-mono text-[12.5px] text-fg placeholder:text-fg-4 focus:border-line-strong focus:outline-none"
          />
          <button
            type="button"
            disabled={saving === "slack" || !slackDirty}
            onClick={onSaveSlack}
            className="rounded-md border border-line-strong px-3 py-2 text-[12.5px] font-medium text-fg transition-colors hover:border-[rgba(255,255,255,0.25)] disabled:opacity-50"
          >
            {saving === "slack" ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="text-[11.5px] text-fg-4">
          Create one at <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-[#d3ff85]">api.slack.com/messaging/webhooks</a>. Leave blank to disable Slack alerts.
        </p>
      </div>

      {okMsg && <p className="text-[12px] text-accent">{okMsg}</p>}
      {errMsg && (
        <ErrorBanner
          message={errMsg}
          onRetry={
            lastFailedBody
              ? async () => {
                  await patch(lastFailedBody.body, lastFailedBody.kind);
                }
              : undefined
          }
          onDismiss={() => {
            setErrMsg(null);
            setLastFailedBody(null);
          }}
        />
      )}
    </section>
  );
}

function Stepper({ states }: { states: Array<"done" | "active" | "pending"> }) {
  const labels = ["Install SDK", "Run your agent", "See first trace"];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {states.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <StepCircle state={s} n={i + 1} />
          <span
            className={
              s === "pending"
                ? "text-fg-4"
                : s === "active"
                ? "text-fg"
                : "text-fg-2"
            }
          >
            {labels[i]}
          </span>
          {i < states.length - 1 && (
            <span className="mx-2 h-px w-8 bg-line" />
          )}
        </div>
      ))}
    </div>
  );
}

function StepCircle({
  state,
  n,
}: {
  state: "done" | "active" | "pending";
  n: number;
}) {
  if (state === "done") {
    return (
      <span
        className="grid h-6 w-6 place-items-center rounded-full border border-accent text-accent"
        style={{ background: "rgba(194,249,112,0.12)" }}
      >
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
          <polyline points="2 6 5 9 10 3" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        className="grid h-6 w-6 place-items-center rounded-full border border-accent text-[11px] font-semibold text-accent"
        style={{ background: "rgba(194,249,112,0.12)" }}
      >
        {n}
      </span>
    );
  }
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full border border-line text-[11px] text-fg-4">
      {n}
    </span>
  );
}

function CodeBlock({
  tab,
  onTab,
  code,
  onCopy,
  copied,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  code: string;
  onCopy: () => void;
  copied: "ok" | "failed" | false;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-line-strong"
      style={{
        background: "linear-gradient(180deg, #111114 0%, #0c0c0e 100%)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -28px rgba(0,0,0,0.6)",
      }}
    >
      <div
        className="flex items-center gap-1.5 border-b border-line px-3 py-2"
        style={{ background: "rgba(255,255,255,0.015)" }}
      >
        {(["python", "curl"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => onTab(t)}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] tracking-wide transition-colors ${
              tab === t
                ? "bg-[rgba(255,255,255,0.06)] text-fg"
                : "text-fg-3 hover:text-fg-2"
            }`}
          >
            {labelForTab(t)}
          </button>
        ))}
        <button
          onClick={onCopy}
          className="ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] text-fg-3 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-fg"
        >
          {copied === "ok"
            ? "✓ copied"
            : copied === "failed"
            ? "Copy blocked. Select the code manually"
            : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-[1.7] text-fg">
        <code>{code}</code>
      </pre>
      <p className="border-t border-line px-5 py-2.5 font-mono text-[11px] text-fg-3">
        Your API key has been pre-filled in this snippet.
      </p>
    </div>
  );
}

function StatusIndicator({ status }: { status: Status }) {
  if (status === "waiting") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-fg-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 animate-pulse-dot rounded-full bg-accent opacity-80" />
          <span className="relative h-2 w-2 rounded-full bg-accent" />
        </span>
        Waiting for first trace…
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-fg-2"
      style={{
        background: "rgba(194,249,112,0.06)",
        borderColor: "rgba(194,249,112,0.25)",
      }}
    >
      <span
        className="grid h-5 w-5 place-items-center rounded-full text-accent"
        style={{ background: "rgba(194,249,112,0.15)" }}
      >
        ✓
      </span>
      Connected. Your first trace just landed. It&apos;s live on your dashboard.
    </div>
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

function SideLink({
  href,
  label,
  sub,
}: {
  href: string;
  label: string;
  sub: string;
}) {
  const isExternal = href.startsWith("http") || href.startsWith("mailto:");
  return (
    <li>
      <a
        href={href}
        target={isExternal && href.startsWith("http") ? "_blank" : undefined}
        rel={isExternal && href.startsWith("http") ? "noopener noreferrer" : undefined}
        className="group flex flex-col gap-0.5 rounded-md transition-colors"
      >
        <span className="text-fg-2 group-hover:text-fg">{label} →</span>
        <span className="font-mono text-[11px] text-fg-4">{sub}</span>
      </a>
    </li>
  );
}

function labelForTab(t: Tab) {
  if (t === "python") return "python";
  return "curl (any language)";
}

// The Python snippet installs from GitHub because the PyPI package isn't
// published yet; a "pip install safeship" that fails on the user's very
// first command is the fastest way to lose a trial. The curl tab gives
// TypeScript / n8n / everything-else users a real, working path on day
// one instead of an npm package that doesn't exist.
function buildSnippet(tab: Tab, apiKey: string): string {
  if (tab === "python") {
    return [
      'pip install "git+https://github.com/ego-debug/SafeShip.git#subdirectory=sdks/python"',
      "",
      "import safeship",
      `safeship.init(api_key="${apiKey}")`,
      "agent = safeship.wrap(my_agent)",
    ].join("\n");
  }
  return [
    "# Send a trace from any language with one HTTP call.",
    "curl -X POST https://www.safeship.dev/v1/traces \\",
    `  -H "Authorization: Bearer ${apiKey}" \\`,
    '  -H "Content-Type: application/json" \\',
    "  -d '{",
    '    "run":   { "status": "ok", "duration_ms": 1200 },',
    '    "steps": [{ "tool_name": "my_agent", "kind": "llm",',
    '                "input": "user message", "output": "agent reply",',
    '                "status": "ok" }]',
    "  }'",
  ].join("\n");
}
