import "server-only";
import { ALERT_FROM, getResend } from "./resend";
import { getServiceSupabase } from "./supabase";

// Throttling rules — designed so a flapping agent can't flood the inbox
// or Slack channel, while still surfacing real outages quickly enough to
// matter (first failure in 10 minutes still alerts).
const BURST_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const DAILY_CAP = 10;

type Channel = "email" | "slack";

type AlertContext = {
  projectId: string;
  runId: string;
  // Run summary used for the body of the alert
  runStatus: "fail" | "warn";
  durationMs: number | null;
  triggeredAt: string;
};

type ProjectInfo = {
  id: string;
  name: string;
  user_id: string;
  alerts_enabled: boolean;
  slack_webhook_url: string | null;
  user_email: string | null;
};

/**
 * Fire-and-forget entry point called from the ingestion path immediately
 * after a failed run is persisted. Never throws — any error is logged and
 * swallowed so a misconfigured alert provider can't break trace ingest.
 */
export async function alertOnFailedRun(ctx: AlertContext): Promise<void> {
  try {
    const project = await loadProject(ctx.projectId);
    if (!project) return;
    if (!project.alerts_enabled) return;

    // Email and Slack are independent: each is throttled and dispatched
    // separately so a user with only one channel configured still gets it.
    await Promise.allSettled([
      maybeSendEmail(project, ctx),
      maybeSendSlack(project, ctx),
    ]);
  } catch (err) {
    // Last-resort guard — must never propagate.
    console.error("[alerts] unexpected failure:", err);
  }
}

async function loadProject(projectId: string): Promise<ProjectInfo | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, user_id, alerts_enabled, slack_webhook_url, users:users!projects_user_id_fkey(email)"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return null;
  // Supabase returns the joined `users` either as an array or single
  // object depending on the relationship; normalize.
  const usersField = (data as { users?: unknown }).users;
  let email: string | null = null;
  if (Array.isArray(usersField) && usersField[0] && typeof usersField[0] === "object") {
    const first = usersField[0] as { email?: unknown };
    email = typeof first.email === "string" ? first.email : null;
  } else if (usersField && typeof usersField === "object") {
    const u = usersField as { email?: unknown };
    email = typeof u.email === "string" ? u.email : null;
  }
  return {
    id: data.id as string,
    name: data.name as string,
    user_id: data.user_id as string,
    alerts_enabled: Boolean(data.alerts_enabled),
    slack_webhook_url: (data.slack_webhook_url as string | null) ?? null,
    user_email: email,
  };
}

async function isThrottled(
  projectId: string,
  channel: Channel,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  const now = Date.now();
  const burstFloor = new Date(now - BURST_WINDOW_MS).toISOString();
  const dailyFloor = new Date(now - DAILY_WINDOW_MS).toISOString();

  // Burst check: any alert in the last 10 minutes blocks new ones.
  const { count: recentCount, error: recentErr } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("channel", channel)
    .gte("sent_at", burstFloor);
  if (recentErr) {
    console.warn("[alerts] burst-check query failed:", recentErr);
    // Fail-closed on query error: don't send a possibly-redundant alert.
    return true;
  }
  if ((recentCount ?? 0) > 0) return true;

  // Daily cap.
  const { count: dailyCount, error: dailyErr } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("channel", channel)
    .gte("sent_at", dailyFloor);
  if (dailyErr) {
    console.warn("[alerts] daily-check query failed:", dailyErr);
    return true;
  }
  if ((dailyCount ?? 0) >= DAILY_CAP) return true;

  return false;
}

async function logSend(
  projectId: string,
  channel: Channel,
  runId: string,
): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase.from("notification_log").insert({
    project_id: projectId,
    channel,
    kind: "failure_alert",
    run_id: runId,
  });
  if (error) {
    console.warn("[alerts] notification_log insert failed:", error);
  }
}

async function maybeSendEmail(
  project: ProjectInfo,
  ctx: AlertContext,
): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  if (!project.user_email) return;
  if (await isThrottled(project.id, "email")) return;

  const traceUrl = `https://www.safeship.dev/app/runs/${ctx.runId}`;
  const suggestUrl = `https://www.safeship.dev/app/runs/${ctx.runId}#suggest`;
  const durationText =
    ctx.durationMs != null ? `${ctx.durationMs}ms` : "unknown duration";

  try {
    await resend.emails.send({
      from: ALERT_FROM,
      to: project.user_email,
      subject: `[SafeShip] Run failed in ${project.name}`,
      html: renderEmail({
        projectName: project.name,
        triggeredAt: ctx.triggeredAt,
        durationText,
        traceUrl,
        suggestUrl,
      }),
    });
    await logSend(project.id, "email", ctx.runId);
  } catch (err) {
    console.warn("[alerts] resend.emails.send failed:", err);
  }
}

async function maybeSendSlack(
  project: ProjectInfo,
  ctx: AlertContext,
): Promise<void> {
  if (!project.slack_webhook_url) return;
  if (!project.slack_webhook_url.startsWith("https://hooks.slack.com/")) return;
  if (await isThrottled(project.id, "slack")) return;

  const traceUrl = `https://www.safeship.dev/app/runs/${ctx.runId}`;
  const body = {
    text: `:rotating_light: Run failed in *${project.name}*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:rotating_light: *Run failed in ${project.name}*\nStatus: \`${ctx.runStatus}\`  •  Started: ${ctx.triggeredAt}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View trace" },
            url: traceUrl,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Suggest a regression test" },
            url: `${traceUrl}#suggest`,
          },
        ],
      },
    ],
  };

  try {
    const resp = await fetch(project.slack_webhook_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.warn(
        "[alerts] slack webhook returned non-2xx:",
        resp.status,
        await resp.text().catch(() => ""),
      );
      return;
    }
    await logSend(project.id, "slack", ctx.runId);
  } catch (err) {
    console.warn("[alerts] slack fetch failed:", err);
  }
}

function renderEmail(args: {
  projectName: string;
  triggeredAt: string;
  durationText: string;
  traceUrl: string;
  suggestUrl: string;
}): string {
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0a0a0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8ea;">
    <div style="max-width:560px;margin:0 auto;background:#111114;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#c2f970;">
        SafeShip alert
      </p>
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">
        Run failed in <span style="color:#c2f970">${escapeHtml(args.projectName)}</span>
      </h1>
      <p style="margin:0 0 6px;font-size:14px;color:#bcbcc2;">
        Started <span style="color:#e8e8ea">${escapeHtml(args.triggeredAt)}</span>
      </p>
      <p style="margin:0 0 22px;font-size:14px;color:#bcbcc2;">
        Duration <span style="color:#e8e8ea">${escapeHtml(args.durationText)}</span>
      </p>
      <p style="margin:0 0 16px;">
        <a href="${args.traceUrl}"
           style="display:inline-block;background:#c2f970;color:#0a0a0c;padding:10px 16px;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px;">
          View trace
        </a>
        &nbsp;
        <a href="${args.suggestUrl}"
           style="display:inline-block;background:transparent;color:#e8e8ea;padding:10px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);font-weight:600;text-decoration:none;font-size:14px;">
          Suggest a regression test
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#8a8a92;line-height:1.5;">
        You're receiving this because alerts are enabled for this project.
        Disable them on the Setup page if these emails aren't useful.
        Throttled to one alert per 10 minutes; max 10 per day.
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
