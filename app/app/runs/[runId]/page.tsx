import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { TraceDetailView } from "@/components/trace/TraceDetailView";
import { getRunForUser } from "@/lib/runs";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: { runId: string };
}) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const run = await getRunForUser(userId, params.runId);
  if (!run) notFound();

  return <TraceDetailView run={run} />;
}
