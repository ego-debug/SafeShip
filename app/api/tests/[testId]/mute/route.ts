import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { muteTest } from "@/lib/tests";

export async function POST(
  _req: Request,
  { params }: { params: { testId: string } },
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await muteTest(userId, params.testId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "mute_failed";
    if (msg === "not_found") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "invalid_transition") return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
