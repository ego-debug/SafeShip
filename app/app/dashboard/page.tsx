import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboardSnapshot } from "@/lib/projects";
import { requireAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await requireAccess();

  const snapshot = await getDashboardSnapshot(userId);
  if (!snapshot) redirect("/app/onboarding");

  return <DashboardView snapshot={snapshot} />;
}
