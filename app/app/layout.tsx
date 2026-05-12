import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { getOrProvisionProject } from "@/lib/provision";
import { getSubscription, hasAccess } from "@/lib/subscriptions";
import { isStripeConfigured } from "@/lib/stripe";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  // Gate /app/* on an active subscription (or owner status). The /app/billing
  // page is exempt — that's where the user goes to fix it. We also exempt when
  // Stripe isn't configured (local dev / preview without keys) so the rest of
  // the app stays usable.
  const pathname = headers().get("x-pathname") ?? "";
  const isBillingPath = pathname.startsWith("/app/billing");
  if (!isBillingPath && isStripeConfigured()) {
    await getOrProvisionProject(userId);
    const sub = await getSubscription(userId);
    if (!hasAccess(userId, sub)) {
      redirect("/app/billing");
    }
  }

  return (
    <>
      <Background />
      <div className="relative z-[1] mx-auto max-w-shell px-8">
        <AppNav />
        {children}
      </div>
    </>
  );
}
