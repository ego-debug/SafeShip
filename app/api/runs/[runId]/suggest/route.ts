import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { suggestFromRunId } from "@/lib/suggestions";
import { RateLimitError } from "@/lib/rateLimit";

export async function POST(
  _req: Request,
  { params }: { params: { runId: string } },
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await suggestFromRunId(userId, params.runId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: e.message,
          limit: e.limit,
          window: e.window,
          current: e.current,
          retry_after_seconds: e.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "retry-after": String(e.retryAfterSeconds) },
        },
      );
    }
    const msg = e instanceof Error ? e.message : "suggest_failed";
    if (msg === "not_found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "engine_not_configured") {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
