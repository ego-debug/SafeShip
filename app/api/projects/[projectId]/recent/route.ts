// Lightweight polling endpoint for the realtime dashboard. Returns the
// same shape the server-rendered dashboard pulls (recent runs, recent
// failures, total runs in last 7 days) — just the bits that change
// often enough to need live updates.
//
// The dashboard's client island calls this every ~2s. Returns 401 if not
// signed in, 404 if the project doesn't belong to this user.

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/projects";

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string } },
) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snapshot = await getDashboardSnapshot(userId);
  if (!snapshot || snapshot.project.id !== params.projectId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // No-cache headers so polled responses always reflect the latest DB state.
  return NextResponse.json(
    {
      runs: snapshot.runs,
      failures: snapshot.failures,
      totalRuns: snapshot.totalRuns,
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
