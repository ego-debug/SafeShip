import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboardSnapshot } from "@/lib/projects";
import { getOrProvisionProject } from "@/lib/provision";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  // Ensure the user has a project, then load the snapshot
  await getOrProvisionProject(userId);
  const snapshot = await getDashboardSnapshot(userId);

  if (!snapshot) {
    redirect("/app/onboarding");
  }

  return <DashboardView snapshot={snapshot} />;
}
