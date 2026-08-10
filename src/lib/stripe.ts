import "server-only";
import Stripe from "stripe";
import {
  getStripeDayPassPriceId,
  getStripeWeeklyPassPriceId,
  getStripeMonthlyPassPriceId,
  getStripeSecretKey,
  getStripeWebhookSecret,
} from "@/lib/env";

/**
 * Stripe integration for voice pass purchases.
 *
 * Products (#137 — revenue diversification):
 * - Day Pass (€1.99): 24 hours of unlimited voice conversations
 * - Weekly Pass (€4.99): 7 days
 * - Monthly Pass (€9.99): 30 days
 *
 * Live Stripe products/prices are created out-of-band; their price IDs are read
 * from env (STRIPE_DAY_PASS_PRICE_ID / STRIPE_WEEKLY_PRICE_ID / STRIPE_MONTHLY_PRICE_ID).
 */

/** The voice-pass tiers a visitor can buy. */
export type PurchaseType = "day_pass" | "weekly_pass" | "monthly_pass";

/** Duration of each pass tier, in milliseconds. */
const PASS_DURATIONS_MS: Record<PurchaseType, number> = {
  day_pass: 24 * 60 * 60 * 1000,
  weekly_pass: 7 * 24 * 60 * 60 * 1000,
  monthly_pass: 30 * 24 * 60 * 60 * 1000,
};

/** Resolve the configured Stripe price ID for a purchase tier (or null). */
export function getPriceIdForPurchaseType(
  purchaseType: PurchaseType
): string | null {
  switch (purchaseType) {
    case "day_pass":
      return getStripeDayPassPriceId() ?? null;
    case "weekly_pass":
      return getStripeWeeklyPassPriceId() ?? null;
    case "monthly_pass":
      return getStripeMonthlyPassPriceId() ?? null;
    default:
      return null;
  }
}


/**
 * SE-L3: Pinned Stripe API version.
 * Explicit pin prevents silent behavior changes when the SDK is upgraded.
 * Update this after reading the Stripe API changelog and testing locally.
 */
const STRIPE_API_VERSION = "2026-07-29.dahlia" as const;

/**
 * Get server-side Stripe client.
 * Only use in API routes - never on client side.
 */
export function getStripeClient(): Stripe {
  const secretKey = getStripeSecretKey();
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
interface StripeCheckoutOptions {
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  /** Which pass tier to buy. Defaults to the Day Pass for backwards compat. */
  purchaseType?: PurchaseType;
}

/** Human-readable env var name for a tier, for clear error messages. */
const PRICE_ENV_NAMES: Record<PurchaseType, string> = {
  day_pass: "STRIPE_DAY_PASS_PRICE_ID",
  weekly_pass: "STRIPE_WEEKLY_PRICE_ID",
  monthly_pass: "STRIPE_MONTHLY_PRICE_ID",
};

/** Resolve the price ID for a tier or throw a descriptive error. */
function requirePriceId(purchaseType: PurchaseType): string {
  const priceId = getPriceIdForPurchaseType(purchaseType);
  if (!priceId) {
    throw new Error(`${PRICE_ENV_NAMES[purchaseType]} not configured`);
  }
  return priceId;
}

/**
 * Create a Stripe Checkout Session for a voice pass.
 * Returns the checkout URL to redirect the user to.
 * The chosen tier is recorded in `metadata.purchase_type` so the webhook can
 * grant the correct access duration.
 */
export async function createDayPassCheckoutSession(
  options: StripeCheckoutOptions
): Promise<string> {
  const stripe = getStripeClient();
  const purchaseType = options.purchaseType ?? "day_pass";
  const priceId = requirePriceId(purchaseType);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: options.userEmail,
    metadata: { user_id: options.userId, purchase_type: purchaseType },
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
 * Options for creating a Stripe Embedded Checkout Session.
 */
interface StripeEmbeddedCheckoutOptions {
  userId: string;
  userEmail: string;
  returnUrl: string;
  /** Which pass tier to buy. Defaults to the Day Pass for backwards compat. */
  purchaseType?: PurchaseType;
}

/**
 * Create a Stripe Embedded Checkout Session for a voice pass.
 * Returns the client_secret for the embedded checkout form.
 */
export async function createEmbeddedCheckoutSession(
  options: StripeEmbeddedCheckoutOptions
): Promise<string> {
  const stripe = getStripeClient();
  const purchaseType = options.purchaseType ?? "day_pass";
  const priceId = requirePriceId(purchaseType);

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: options.userEmail,
    metadata: { user_id: options.userId, purchase_type: purchaseType },
    return_url: options.returnUrl,
  });

  if (!session.client_secret) {
    throw new Error(
      "Failed to create embedded checkout session - no client_secret returned"
    );
  }

  return session.client_secret;
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
  const secret = getStripeWebhookSecret();

  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  }

  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Check if Stripe is configured with all required environment variables.
 */
export function isStripeConfigured(): boolean {
  return !!(getStripeSecretKey() && getStripeDayPassPriceId());
}

/**
 * Calculate the access-expiry date for a given pass tier.
 * day_pass = 24h, weekly_pass = 7d, monthly_pass = 30d.
 */
export function calculateExpiryDate(purchaseType: PurchaseType): Date {
  const duration = PASS_DURATIONS_MS[purchaseType];
  if (duration === undefined) {
    throw new Error(`Unknown purchase type: ${purchaseType}`);
  }
  return new Date(Date.now() + duration);
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
