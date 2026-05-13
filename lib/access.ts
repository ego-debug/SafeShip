import "server-only";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrProvisionProject } from "./provision";
import { getSubscription, hasAccess, type Subscription } from "./subscriptions";
import { isStripeConfigured } from "./stripe";

/**
 * Call from the top of any server-rendered /app/* page that should be gated
 * behind an active subscription (or owner status). Performs auth check,
 * provisions the user row if needed, then redirects to /app/billing if the
 * user doesn't have access.
 *
 * Skip this on /app/billing itself — that's the page users get redirected
 * TO, not from.
 *
 * Returns the userId + subscription so the caller can use them directly
 * without re-querying.
 *
 * Why we gate per-page instead of in the shared layout: Next.js App Router
 * layouts persist across sibling page navigations by design, so a gating
 * check in app/app/layout.tsx only fires on initial route load, not when
 * the user clicks from /app/billing to /app/dashboard. Per-page is
 * defense-in-depth and matches how Clerk recommends gating in App Router.
 */
export async function requireAccess(): Promise<{
  userId: string;
  subscription: Subscription;
}> {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  // If Stripe isn't configured (local dev / preview without keys), let the
  // user through so the rest of the app stays usable. Mirrors layout
  // behavior.
  if (!isStripeConfigured()) {
    await getOrProvisionProject(userId);
    const subscription = await getSubscription(userId);
    return { userId, subscription };
  }

  await getOrProvisionProject(userId);
  const subscription = await getSubscription(userId);
  if (!hasAccess(userId, subscription)) {
    redirect("/app/billing");
  }
  return { userId, subscription };
}
