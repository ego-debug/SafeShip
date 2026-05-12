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
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generate_failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
