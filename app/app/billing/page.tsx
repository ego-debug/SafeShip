import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BillingView } from "./BillingView";
import { getOrProvisionProject } from "@/lib/provision";
import { getSubscription, isOwner } from "@/lib/subscriptions";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  await getOrProvisionProject(userId);
  const subscription = await getSubscription(userId);

  return (
    <BillingView
      subscription={subscription}
      isOwner={isOwner(userId)}
      checkoutStatus={searchParams.status ?? null}
      stripeConfigured={isStripeConfigured()}
    />
  );
}
