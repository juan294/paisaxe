import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createDayPassCheckoutSession } from "@/lib/stripe";

async function getSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore in server component context
          }
        },
      },
    }
  );
}

/**
 * POST /api/checkout/day-pass
 *
 * Creates a Stripe Checkout Session for the Day Pass product.
 * Requires authentication. Returns the checkout URL.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Debug: Check env vars
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;
  const hasPriceId = !!process.env.STRIPE_DAY_PASS_PRICE_ID;

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create checkout session", details: errorMessage },
      { status: 500 }
    );
  }
}
