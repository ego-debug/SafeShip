import { notFound } from "next/navigation";
import { TraceDetailView } from "@/components/trace/TraceDetailView";
import { requireAccess } from "@/lib/access";
import { getRunForUser } from "@/lib/runs";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: { runId: string };
}) {
  const { userId } = await requireAccess();

  const run = await getRunForUser(userId, params.runId);
  if (!run) notFound();

  return <TraceDetailView run={run} />;
}
