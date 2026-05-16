import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceSupabase } from "@/lib/supabase";

const Body = z.object({
  alerts_enabled: z.boolean().optional(),
  slack_webhook_url: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_body", detail: err instanceof Error ? err.message : "bad input" },
      { status: 400 },
    );
  }

  // Slack webhook URLs must be on hooks.slack.com — anything else is a
  // likely user-error and could leak the trace summary off-platform.
  if (parsed.slack_webhook_url) {
    const url = parsed.slack_webhook_url.trim();
    if (url && !url.startsWith("https://hooks.slack.com/")) {
      return NextResponse.json(
        { error: "invalid_slack_url", detail: "URL must start with https://hooks.slack.com/" },
        { status: 400 },
      );
    }
  }

  const supabase = getServiceSupabase();

  // Verify project ownership before mutating.
  const { data: project, error: lookupErr } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", params.projectId)
    .maybeSingle();
  if (lookupErr || !project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (project.user_id !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.alerts_enabled !== undefined) patch.alerts_enabled = parsed.alerts_enabled;
  if (parsed.slack_webhook_url !== undefined) {
    const v = (parsed.slack_webhook_url ?? "").trim();
    patch.slack_webhook_url = v === "" ? null : v;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, updated: false });
  }

  const { error: updateErr } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", params.projectId);
  if (updateErr) {
    return NextResponse.json(
      { error: "update_failed", detail: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, updated: true });
}
