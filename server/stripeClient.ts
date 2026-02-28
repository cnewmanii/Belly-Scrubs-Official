import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  return getStripeClient();
}

export async function getStripePublishableKey(): Promise<string> {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error("STRIPE_PUBLISHABLE_KEY not configured");
  }
  return key;
}

export async function getStripeSecretKey(): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return key;
}
