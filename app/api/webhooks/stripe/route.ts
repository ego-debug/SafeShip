import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  findUserByStripeCustomerId,
  setSubscriptionFromStripe,
  type SubscriptionStatus,
} from "@/lib/subscriptions";

// POST /api/webhooks/stripe
// Stripe-signed webhook. Configure the endpoint in the Stripe dashboard
// under Developers -> Webhooks -> Add endpoint pointing at:
//   https://www.safeship.dev/api/webhooks/stripe
// Subscribe to:
//   - checkout.session.completed
//   - customer.subscription.updated
//   - customer.subscription.deleted
//   - invoice.payment_succeeded
//   - invoice.payment_failed
// Copy the signing secret into STRIPE_WEBHOOK_SECRET in .env.local + Vercel.
//
// The handler is idempotent — Stripe retries failed deliveries and may also
// fire the same event twice (e.g. invoice.payment_succeeded right after
// checkout.session.completed); we always overwrite with the latest values
// from Stripe's view of the world.

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 500 },
    );
  }

  const sig = headers().get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.created":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Ignore other events we didn't subscribe to
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "handler_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  // The Clerk user id we set as client_reference_id at session creation
  const userId =
    session.client_reference_id ??
    (session.metadata?.clerk_user_id as string | undefined) ??
    null;
  if (!userId) return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  await setSubscriptionFromStripe(userId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status: "trialing",
  });

  // Pull the full subscription to get trial_end + current_period_end
  if (subscriptionId) {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    await persistSubscriptionState(userId, sub);
  }
}

async function handleSubscriptionChange(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) return;
  // Re-fetch through the SDK so the Subscription shape is whatever our pinned
  // SDK version expects, regardless of the webhook endpoint's configured API
  // version. Accounts created after Dahlia (2026-04-22) default to that API
  // version, which moved `current_period_end` off the top-level Subscription
  // and onto SubscriptionItem; re-fetching normalizes that.
  const fresh = await getStripe().subscriptions.retrieve(sub.id);
  await persistSubscriptionState(user.id, fresh);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) return;

  // Pull the latest subscription state — for trial-to-active, this is where
  // we transition.
  const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription })
    .subscription;
  const subscriptionId =
    typeof subRef === "string"
      ? subRef
      : (subRef as Stripe.Subscription | undefined)?.id ?? null;
  if (!subscriptionId) return;
  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  await persistSubscriptionState(user.id, sub);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;
  if (!customerId) return;
  const user = await findUserByStripeCustomerId(customerId);
  if (!user) return;
  await setSubscriptionFromStripe(user.id, { status: "past_due" });
}

async function persistSubscriptionState(
  userId: string,
  sub: Stripe.Subscription,
): Promise<void> {
  const status = mapStatus(sub.status);
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  await setSubscriptionFromStripe(userId, {
    status,
    trial_ends_at: trialEnd,
    current_period_end: periodEnd,
    stripe_subscription_id: sub.id,
    stripe_customer_id:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end),
  });
}

function mapStatus(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      // Customer started checkout but card was declined — treat as none until
      // they retry. Don't block them out of /app/billing.
      return "none";
    default:
      return "none";
  }
}
