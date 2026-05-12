import "server-only";
import Stripe from "stripe";

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY missing in environment");
  }
  // Use the SDK's default API version so the TypeScript types stay aligned
  // with the runtime behavior we're actually getting. Bumping `stripe` in
  // package.json is the right way to move to a newer API version.
  _client = new Stripe(key);
  return _client;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.STRIPE_WEBHOOK_SECRET,
  );
}

export const TRIAL_DAYS = 7;
export const PRICE_PER_MONTH = "$29";
