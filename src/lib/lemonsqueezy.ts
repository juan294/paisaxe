import { timingSafeEqual } from "crypto";

/**
 * Lemon Squeezy integration for voice pass purchases.
 *
 * Products:
 * - Day Pass (€1.99): 24 hours of unlimited voice conversations
 */

export interface LemonSqueezyCheckoutOptions {
  userId: string;
  userEmail: string;
  /** URL to redirect after successful purchase */
  successUrl?: string;
}

export interface LemonSqueezyOrderWebhook {
  meta: {
    event_name: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data: {
    id: string;
    type: string;
    attributes: {
      first_order_item: {
        variant_id: number;
        product_id: number;
        product_name: string;
        variant_name: string;
      };
      status: string;
      total: number;
      currency: string;
      user_email: string;
      user_name: string;
      created_at: string;
    };
  };
}

/**
 * Generate a Lemon Squeezy checkout URL for the Day Pass product.
 */
export function createDayPassCheckoutUrl(
  options: LemonSqueezyCheckoutOptions
): string {
  const storeId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID;
  const testMode = process.env.NEXT_PUBLIC_LEMONSQUEEZY_TEST_MODE === "true";

  if (!storeId || !variantId) {
    throw new Error("Lemon Squeezy configuration missing");
  }

  const baseUrl = `https://${storeId}.lemonsqueezy.com/checkout/buy/${variantId}`;

  const params = new URLSearchParams();

  // Enable test mode if configured
  if (testMode) {
    params.set("test_mode", "true");
  }

  // Pre-fill email
  params.set("checkout[email]", options.userEmail);

  // Custom data to identify the user in webhooks
  params.set("checkout[custom][user_id]", options.userId);

  // Redirect URL after successful purchase
  if (options.successUrl) {
    params.set("checkout[redirect_url]", options.successUrl);
  }

  // Disable marketing opt-in by default
  params.set("checkout[marketing_consent]", "false");

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Verify Lemon Squeezy webhook signature.
 * Uses HMAC SHA-256 with constant-time comparison.
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[lemonsqueezy] LEMONSQUEEZY_WEBHOOK_SECRET not configured");
    return false;
  }

  if (!signature) {
    return false;
  }

  try {
    // Import crypto for HMAC
    const crypto = await import("crypto");

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const computedSignature = hmac.digest("hex");

    // Constant-time comparison to prevent timing attacks
    if (signature.length !== computedSignature.length) {
      return false;
    }

    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  } catch (error) {
    console.error("[lemonsqueezy] Error verifying signature:", error);
    return false;
  }
}

/**
 * Parse and validate a Lemon Squeezy order webhook payload.
 */
export function parseOrderWebhook(
  body: unknown
): LemonSqueezyOrderWebhook | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const payload = body as Record<string, unknown>;

  // Validate meta
  if (typeof payload.meta !== "object" || payload.meta === null) {
    return null;
  }

  const meta = payload.meta as Record<string, unknown>;

  if (typeof meta.event_name !== "string") {
    return null;
  }

  // Validate data
  if (typeof payload.data !== "object" || payload.data === null) {
    return null;
  }

  const data = payload.data as Record<string, unknown>;

  if (typeof data.id !== "string" || typeof data.type !== "string") {
    return null;
  }

  if (typeof data.attributes !== "object" || data.attributes === null) {
    return null;
  }

  return body as LemonSqueezyOrderWebhook;
}

/**
 * Get the purchase type from a Lemon Squeezy variant ID.
 */
export function getPurchaseTypeFromVariant(
  variantId: number
): "day_pass" | null {
  const dayPassVariantId = process.env.NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID;

  if (dayPassVariantId && variantId === parseInt(dayPassVariantId, 10)) {
    return "day_pass";
  }

  return null;
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

/**
 * Check if Lemon Squeezy is configured.
 */
export function isLemonSqueezyConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID &&
    process.env.NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID
  );
}
