import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrProvisionProject } from "@/lib/provision";
import { OnboardingView } from "./OnboardingView";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const project = await getOrProvisionProject(userId);

  return (
    <OnboardingView
      apiKey={project.api_key}
      projectId={project.id}
      firstTraceAt={project.first_trace_at}
    />
  );
}
