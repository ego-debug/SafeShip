import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getSubscription } from "@/lib/subscriptions";

// POST /api/billing/portal
// Creates a Stripe Customer Portal session so the user can update payment
// method, cancel, or see invoices. Returns the portal URL to redirect to.

export async function POST(req: Request) {
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
  if (!sub.stripe_customer_id) {
    return NextResponse.json(
      { error: "no_customer" },
      { status: 404 },
    );
  }

  const stripe = getStripe();
  const origin = new URL(req.url).origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/app/billing`,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
