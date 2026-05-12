import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { unmuteTest } from "@/lib/tests";

export async function POST(
  _req: Request,
  { params }: { params: { testId: string } },
) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await unmuteTest(userId, params.testId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unmute_failed";
    if (msg === "not_found") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "invalid_transition") return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
