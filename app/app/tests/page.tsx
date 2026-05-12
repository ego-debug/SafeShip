import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { TestsView } from "@/components/tests/TestsView";
import { getOrProvisionProject } from "@/lib/provision";
import { getTestsSnapshot } from "@/lib/tests";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  await getOrProvisionProject(userId);
  const snapshot = await getTestsSnapshot(userId);
  if (!snapshot) redirect("/app/onboarding");

  return <TestsView snapshot={snapshot} />;
}
