import "server-only";
import { getServiceSupabase } from "./supabase";

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type Subscription = {
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

/**
 * True if this Clerk userId is configured as an owner (bypasses Stripe gating
 * entirely). Configure via the SAFESHIP_OWNER_CLERK_IDS env var as a
 * comma-separated list of Clerk user ids: SAFESHIP_OWNER_CLERK_IDS=user_abc,user_xyz
 */
export function isOwner(userId: string): boolean {
  const raw = process.env.SAFESHIP_OWNER_CLERK_IDS ?? "";
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}

/**
 * The single source of truth for "is this user allowed to use /app/*".
 * Owners always pass. Otherwise the user must have status in
 * {trialing, active} — past_due/canceled/none get bounced to /app/billing.
 */
export function hasAccess(
  userId: string,
  sub: Pick<Subscription, "status">,
): boolean {
  if (isOwner(userId)) return true;
  return sub.status === "trialing" || sub.status === "active";
}

export async function getSubscription(userId: string): Promise<Subscription> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("users")
    .select(
      "subscription_status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      status: "none",
      trial_ends_at: null,
      current_period_end: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
    };
  }

  return {
    status: (data.subscription_status as SubscriptionStatus) ?? "none",
    trial_ends_at: data.trial_ends_at as string | null,
    current_period_end: data.current_period_end as string | null,
    stripe_customer_id: data.stripe_customer_id as string | null,
    stripe_subscription_id: data.stripe_subscription_id as string | null,
  };
}

export async function setSubscriptionFromStripe(
  userId: string,
  patch: Partial<{
    status: SubscriptionStatus;
    trial_ends_at: string | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  }>,
): Promise<void> {
  const supabase = getServiceSupabase();
  const dbPatch: Record<string, unknown> = {};
  if (patch.status !== undefined) dbPatch.subscription_status = patch.status;
  if (patch.trial_ends_at !== undefined)
    dbPatch.trial_ends_at = patch.trial_ends_at;
  if (patch.current_period_end !== undefined)
    dbPatch.current_period_end = patch.current_period_end;
  if (patch.stripe_customer_id !== undefined)
    dbPatch.stripe_customer_id = patch.stripe_customer_id;
  if (patch.stripe_subscription_id !== undefined)
    dbPatch.stripe_subscription_id = patch.stripe_subscription_id;
  if (Object.keys(dbPatch).length === 0) return;

  await supabase.from("users").update(dbPatch).eq("id", userId);
}

export async function findUserByStripeCustomerId(
  customerId: string,
): Promise<{ id: string } | null> {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}
