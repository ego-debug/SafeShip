import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SuggestionsView } from "@/components/suggestions/SuggestionsView";
import { getOrProvisionProject } from "@/lib/provision";
import { getSuggestionsSummary } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  await getOrProvisionProject(userId);
  const snapshot = await getSuggestionsSummary(userId);
  if (!snapshot) redirect("/app/onboarding");

  return <SuggestionsView snapshot={snapshot} />;
}
