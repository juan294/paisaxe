import Stripe from "stripe";

/**
 * Stripe integration for voice pass purchases.
 *
 * Products:
 * - Day Pass (€1.99): 24 hours of unlimited voice conversations
 */

// Stripe API version - using the latest stable version
const STRIPE_API_VERSION = "2026-01-28.clover" as const;

/**
 * Get server-side Stripe client.
 * Only use in API routes - never on client side.
 */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    timeout: 30000, // 30 second timeout
    maxNetworkRetries: 3,
  });
}

/**
 * Options for creating a Stripe Checkout Session.
 */
export interface StripeCheckoutOptions {
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout Session for the Day Pass product.
 * Returns the checkout URL to redirect the user to.
 */
export async function createDayPassCheckoutSession(
  options: StripeCheckoutOptions
): Promise<string> {
  const stripe = getStripeClient();
  const priceId = process.env.STRIPE_DAY_PASS_PRICE_ID;

  if (!priceId) {
    throw new Error("STRIPE_DAY_PASS_PRICE_ID not configured");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: options.userEmail,
    metadata: { user_id: options.userId },
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    // Note: automatic_tax requires Stripe Tax to be configured in dashboard
    // automatic_tax: { enabled: true },
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session - no URL returned");
  }

  return session.url;
}

/**
 * Verify Stripe webhook signature and construct the event.
 * Throws an error if verification fails.
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  }

  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Check if Stripe is configured with all required environment variables.
 */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_DAY_PASS_PRICE_ID
  );
}

/**
 * Calculate expiry date based on purchase type.
 */
export function calculateExpiryDate(purchaseType: "day_pass"): Date {
  const now = new Date();

  switch (purchaseType) {
    case "day_pass":
      // 24 hours from now
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    default:
      throw new Error(`Unknown purchase type: ${purchaseType}`);
  }
}

/**
 * Format price for display.
 */
export function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}
