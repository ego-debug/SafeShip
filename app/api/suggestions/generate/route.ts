import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateSuggestionsForUser } from "@/lib/suggestions";

export async function POST() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await generateSuggestionsForUser(userId);
    if (result.reason === "engine_not_configured") {
      return NextResponse.json(
        { error: "engine_not_configured" },
        { status: 503 },
      );
    }

    // If we generated zero AND every candidate was rate-limited away, return
    // a 429 so the UI can surface a real "slow down" message instead of a
    // success-with-zero-results state.
    if (result.generated === 0 && result.rateLimited > 0) {
      return NextResponse.json(
        { error: "rate_limited", ...result },
        {
          status: 429,
          headers: result.retry_after_seconds
            ? { "retry-after": String(result.retry_after_seconds) }
            : undefined,
        },
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generate_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
