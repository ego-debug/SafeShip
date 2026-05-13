import { redirect } from "next/navigation";
import { SuggestionsView } from "@/components/suggestions/SuggestionsView";
import { requireAccess } from "@/lib/access";
import { getSuggestionsSummary } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const { userId } = await requireAccess();
  const snapshot = await getSuggestionsSummary(userId);
  if (!snapshot) redirect("/app/onboarding");

  return <SuggestionsView snapshot={snapshot} />;
}
