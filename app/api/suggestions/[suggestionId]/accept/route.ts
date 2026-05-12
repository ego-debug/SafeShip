import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { acceptSuggestion } from "@/lib/suggestions";

export async function POST(
  _req: Request,
  { params }: { params: { suggestionId: string } },
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await acceptSuggestion(userId, params.suggestionId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "accept_failed";
    if (msg === "not_found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "not_pending") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
