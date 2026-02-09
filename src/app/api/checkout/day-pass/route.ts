import { NextRequest, NextResponse } from "next/server";
import { createDayPassCheckoutSession } from "@/lib/stripe";
import { getSupabaseClient } from "@/lib/supabase-auth";

/**
 * POST /api/checkout/day-pass
 *
 * Creates a Stripe Checkout Session for the Day Pass product.
 * Requires authentication. Returns the checkout URL.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Debug: Check env vars
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY?.trim();
  const hasPriceId = !!process.env.STRIPE_DAY_PASS_PRICE_ID?.trim();

  if (!hasSecretKey || !hasPriceId) {
    console.error("[checkout/day-pass] Missing env vars:", { hasSecretKey, hasPriceId });
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

    const checkoutUrl = await createDayPassCheckoutSession({
      userId: user.id,
      userEmail: user.email || "",
      successUrl: `${origin}/pricing/success`,
      cancelUrl: `${origin}/pricing`,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (error) {
    console.error("[checkout/day-pass] Error:", error);
    const body: { error: string; details?: string } = {
      error: "Failed to create checkout session",
    };
    if (process.env.NODE_ENV === "development") {
      body.details = error instanceof Error ? error.message : "Unknown error";
    }
    return NextResponse.json(body, { status: 500 });
  }
}
