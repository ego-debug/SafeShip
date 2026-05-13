import { getOrProvisionProject } from "@/lib/provision";
import { requireAccess } from "@/lib/access";
import { OnboardingView } from "./OnboardingView";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId } = await requireAccess();
  const project = await getOrProvisionProject(userId);

  return (
    <OnboardingView
      apiKey={project.api_key}
      projectId={project.id}
      firstTraceAt={project.first_trace_at}
    />
  );
}
