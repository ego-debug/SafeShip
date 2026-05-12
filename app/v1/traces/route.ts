import { NextResponse } from "next/server";
import { ingestRun, projectByApiKey, type IngestPayload } from "@/lib/ingestion";
import { checkTracesRateLimit } from "@/lib/rateLimit";

// POST /v1/traces
// Headers: Authorization: Bearer sk_live_xxx
// Body: { run: { trigger, model, score, status, duration_ms, started_at }, steps: [...] }
//
// Inserts a run + its trace steps for the project owning the API key,
// stamping projects.first_trace_at on first ingestion. Per-project rate
// limited so a leaked API key can't bloat the DB.

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(sk_live_[A-Za-z0-9_-]{8,})$/.exec(auth);
  if (!m) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 401 });
  }

  const project = await projectByApiKey(m[1]);
  if (!project) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  }

  // Rate-limit BEFORE parsing the body so a flood of bad bodies still
  // can't get past the cap.
  const rl = await checkTracesRateLimit(project.id);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: rl.reason,
        limit: rl.limit,
        window: rl.window,
        current: rl.current,
        retry_after_seconds: rl.retry_after_seconds,
      },
      {
        status: 429,
        headers: { "retry-after": String(rl.retry_after_seconds) },
      },
    );
  }

  let body: IngestPayload;
  try {
    body = (await req.json()) as IngestPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const result = await ingestRun(project.id, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ingest_failed";
    const validation = msg === "missing_steps" || msg === "too_many_steps";
    return NextResponse.json(
      { error: msg },
      { status: validation ? 400 : 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      service: "safeship",
      endpoint: "/v1/traces",
      method: "POST",
      auth: "Bearer sk_live_xxx",
    },
    { status: 200 },
  );
}
