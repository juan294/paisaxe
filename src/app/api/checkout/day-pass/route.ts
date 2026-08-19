import { NextRequest, NextResponse } from "next/server";
import { createDayPassCheckoutSession, type PurchaseType } from "@/lib/stripe";
import { getSupabaseClient } from "@/lib/supabase-auth";
import { checkoutBodySchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";
import { getSiteUrl } from "@/lib/env";

/** Voice-pass tiers accepted by checkout (#137). */
const VALID_PURCHASE_TYPES: readonly PurchaseType[] = [
  "day_pass",
  "weekly_pass",
  "monthly_pass",
];

/** Parse an optional pass tier from a request body, defaulting to day_pass. */
function parsePurchaseType(raw: unknown): PurchaseType {
  if (
    raw &&
    typeof raw === "object" &&
    "purchaseType" in raw &&
    VALID_PURCHASE_TYPES.includes((raw as { purchaseType: PurchaseType }).purchaseType)
  ) {
    return (raw as { purchaseType: PurchaseType }).purchaseType;
  }
  return "day_pass";
}

const ALLOWED_ORIGINS = [
  getSiteUrl(),
  "https://paisaxe.es",
  "https://paisaxe.com",
  "https://www.paisaxe.es",
  "https://www.paisaxe.com",
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : null,
].filter(Boolean) as string[];

/** Validate returnTo slug: only allow alphanumeric, hyphens, underscores */
function isValidSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value) && value.length <= 100;
}

/**
 * POST /api/checkout/day-pass
 *
 * Creates a Stripe Checkout Session for the Day Pass product.
 * Requires authentication. Returns the checkout URL.
 *
 * Body (optional):
 * - returnTo: story slug to redirect back to after successful payment
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await getSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasSecretKey = !!process.env.STRIPE_SECRET_KEY?.trim();
    const hasPriceId = !!process.env.STRIPE_DAY_PASS_PRICE_ID?.trim();

    if (!hasSecretKey || !hasPriceId) {
      logger.error("[checkout/day-pass] Missing Stripe env vars");
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const rawOrigin = request.headers.get("origin");
    const origin =
      rawOrigin && ALLOWED_ORIGINS.includes(rawOrigin)
        ? rawOrigin
        : (getSiteUrl() ?? "https://paisaxe.es");

    // Parse optional returnTo slug + pass tier from request body
    let returnTo: string | undefined;
    let purchaseType: PurchaseType = "day_pass";
    try {
      const rawBody = await request.json();
      const bodyParsed = checkoutBodySchema.safeParse(rawBody);
      if (bodyParsed.success && bodyParsed.data.returnTo && isValidSlug(bodyParsed.data.returnTo)) {
        returnTo = bodyParsed.data.returnTo;
      }
      purchaseType = parsePurchaseType(rawBody);
    } catch {
      // No body or invalid JSON — that's fine, returnTo stays undefined
    }

    const successUrl = returnTo
      ? `${origin}/pricing/success?returnTo=${returnTo}`
      : `${origin}/pricing/success`;

    const checkoutUrl = await createDayPassCheckoutSession({
      userId: user.id,
      userEmail: user.email || "",
      successUrl,
      cancelUrl: `${origin}/pricing`,
      purchaseType,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    logger.error("[checkout/day-pass] Error:", { error: error instanceof Error ? error.message : String(error) });
    const body: { error: string; details?: string } = {
      error: "Failed to create checkout session",
    };
    if (process.env.NODE_ENV === "development") {
      body.details = error instanceof Error ? error.message : "Unknown error";
    }
    return NextResponse.json(body, { status: 500 });
  }
}
