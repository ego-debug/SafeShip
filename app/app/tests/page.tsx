import { redirect } from "next/navigation";
import { TestsView } from "@/components/tests/TestsView";
import { requireAccess } from "@/lib/access";
import { getTestsSnapshot } from "@/lib/tests";

export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const { userId } = await requireAccess();
  const snapshot = await getTestsSnapshot(userId);
  if (!snapshot) redirect("/app/onboarding");

  return <TestsView snapshot={snapshot} />;
}
