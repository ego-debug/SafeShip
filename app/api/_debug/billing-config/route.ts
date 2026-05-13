import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/stripe";
import { getSubscription, isOwner, hasAccess } from "@/lib/subscriptions";

// GET /api/_debug/billing-config
// Returns booleans about Stripe env var presence and the current user's
// subscription state. NEVER leaks secret values — only presence + last 4
// chars of price id (which is non-sensitive). Gated to signed-in users so
// random scrapers can't probe. Delete this route once billing is verified.

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ownersRaw = process.env.SAFESHIP_OWNER_CLERK_IDS ?? "";
  const ownerIds = ownersRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const sub = await getSubscription(userId);

  return NextResponse.json({
    runtime_env: {
      has_stripe_secret: Boolean(process.env.STRIPE_SECRET_KEY),
      has_stripe_price: Boolean(process.env.STRIPE_PRICE_ID),
      has_stripe_webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      stripe_configured: isStripeConfigured(),
      owner_ids_set: ownersRaw.length > 0,
      owner_ids_count: ownerIds.length,
      // Last 6 chars of each owner id (e.g. "...ABC123") for matching
      // without leaking the full id.
      owner_ids_suffix: ownerIds.map((id) => `...${id.slice(-6)}`),
    },
    current_user: {
      clerk_user_id_suffix: `...${userId.slice(-6)}`,
      is_owner: isOwner(userId),
      subscription_status: sub.status,
      has_access: hasAccess(userId, sub),
      stripe_customer_id: sub.stripe_customer_id ? "set" : "null",
      stripe_subscription_id: sub.stripe_subscription_id ? "set" : "null",
    },
    expected_behavior: hasAccess(userId, sub)
      ? "should LOAD /app/* routes (owner or trialing/active)"
      : "should REDIRECT /app/* to /app/billing",
  });
}
