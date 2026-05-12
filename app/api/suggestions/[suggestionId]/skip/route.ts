import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { skipSuggestion } from "@/lib/suggestions";

export async function POST(
  _req: Request,
  { params }: { params: { suggestionId: string } },
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await skipSuggestion(userId, params.suggestionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "skip_failed";
    if (msg === "not_found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "not_pending") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
