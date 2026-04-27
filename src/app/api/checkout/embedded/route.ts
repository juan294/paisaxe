import { NextRequest, NextResponse } from "next/server";
import { createEmbeddedCheckoutSession } from "@/lib/stripe";
import { getSupabaseClient } from "@/lib/supabase-auth";
import { checkoutBodySchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";

/** Validate returnTo slug: only allow alphanumeric, hyphens, underscores */
function isValidSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value) && value.length <= 100;
}

/**
 * POST /api/checkout/embedded
 *
 * Creates a Stripe Embedded Checkout Session for the Day Pass product.
 * Requires authentication. Returns the client secret for the embedded form.
 *
 * Body (optional):
 * - returnTo: story slug to redirect back to after successful payment
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check env vars
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY?.trim();
  const hasPriceId = !!process.env.STRIPE_DAY_PASS_PRICE_ID?.trim();

  if (!hasSecretKey || !hasPriceId) {
    logger.error("[checkout/embedded] Missing env vars:", { hasSecretKey, hasPriceId });
    return NextResponse.json(
      { error: "Stripe not configured", hasSecretKey, hasPriceId },
      { status: 500 }
    );
  }

  try {
    const supabase = await getSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin =
      request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

    // Parse optional returnTo slug from request body
    let returnTo: string | undefined;
    try {
      const rawBody = await request.json();
      const bodyParsed = checkoutBodySchema.safeParse(rawBody);
      if (bodyParsed.success && bodyParsed.data.returnTo && isValidSlug(bodyParsed.data.returnTo)) {
        returnTo = bodyParsed.data.returnTo;
      }
    } catch {
      // No body or invalid JSON — that's fine, returnTo stays undefined
    }

    const returnUrl = returnTo
      ? `${origin}/pricing/checkout/return?session_id={CHECKOUT_SESSION_ID}&returnTo=${returnTo}`
      : `${origin}/pricing/checkout/return?session_id={CHECKOUT_SESSION_ID}`;

    const clientSecret = await createEmbeddedCheckoutSession({
      userId: user.id,
      userEmail: user.email || "",
      returnUrl,
    });

    return NextResponse.json({ clientSecret });
  } catch (error) {
    logger.error("[checkout/embedded] Error:", { error: error instanceof Error ? error.message : String(error) });
    const body: { error: string; details?: string } = {
      error: "Failed to create checkout session",
    };
    if (process.env.NODE_ENV === "development") {
      body.details = error instanceof Error ? error.message : "Unknown error";
    }
    return NextResponse.json(body, { status: 500 });
  }
}
