import { NextRequest, NextResponse } from "next/server";
import { createDayPassCheckoutSession } from "@/lib/stripe";
import { getSupabaseClient } from "@/lib/supabase-auth";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL,
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
      console.error("[checkout/day-pass] Missing Stripe env vars");
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const rawOrigin = request.headers.get("origin");
    const origin =
      rawOrigin && ALLOWED_ORIGINS.includes(rawOrigin)
        ? rawOrigin
        : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://paisaxe.es");

    // Parse optional returnTo slug from request body
    let returnTo: string | undefined;
    try {
      const body = await request.json();
      if (typeof body.returnTo === "string" && isValidSlug(body.returnTo)) {
        returnTo = body.returnTo;
      }
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
