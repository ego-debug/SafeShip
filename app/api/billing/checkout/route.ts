import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe, TRIAL_DAYS, isStripeConfigured } from "@/lib/stripe";
import { getSubscription, setSubscriptionFromStripe } from "@/lib/subscriptions";

// POST /api/billing/checkout
// Creates a Stripe Checkout session for the current Clerk user. Returns the
// session URL the client should redirect to. The session is configured for a
// 7-day free trial with card-required-upfront so the customer's card is
// captured and auto-charged on day 7.

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "billing_not_configured" },
        { status: 503 },
      );
    }

    const sub = await getSubscription(userId);
    if (sub.status === "trialing" || sub.status === "active") {
      return NextResponse.json(
        { error: "already_subscribed" },
        { status: 409 },
      );
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    if (!email) {
      return NextResponse.json({ error: "no_email_on_clerk_user" }, { status: 400 });
    }

    const stripe = getStripe();
    const origin = new URL(req.url).origin;

    // Reuse the existing Stripe customer if we have one — otherwise create a new
    // one keyed by Clerk userId so we can map back from webhook events.
    let customerId = sub.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { clerk_user_id: userId },
      });
      customerId = customer.id;
      await setSubscriptionFromStripe(userId, { stripe_customer_id: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        trial_settings: {
          // If the customer never adds a card during checkout this can't
          // actually fire (Checkout collects the card up front), but Stripe
          // requires us to declare a behavior. Cancel cleanly if we ever
          // somehow end up trial-without-card.
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: { clerk_user_id: userId },
      },
      payment_method_collection: "always",
      allow_promotion_codes: true,
      client_reference_id: userId,
      success_url: `${origin}/app/billing?status=success`,
      cancel_url: `${origin}/app/billing?status=canceled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "no_checkout_url" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    const type =
      e && typeof e === "object" && "type" in e
        ? String((e as { type: unknown }).type)
        : undefined;
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: unknown }).code)
        : undefined;
    // Log full error to Vercel function logs for debugging
    console.error("checkout_failed", { msg, type, code, error: e });
    return NextResponse.json(
      { error: "checkout_failed", detail: msg, type, code },
      { status: 500 },
    );
  }
}
