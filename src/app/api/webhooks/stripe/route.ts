import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { verifyWebhookSignature, calculateExpiryDate } from "@/lib/stripe";
import type Stripe from "stripe";

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed: Creates voice purchase record
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get signature from header
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.warn("[stripe-webhook] Missing signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // Verify signature and construct event
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      console.warn("[stripe-webhook] Invalid signature:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Only handle checkout.session.completed events
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    // Use payment_intent if available, otherwise fall back to session ID
    const paymentProviderId =
      (session.payment_intent as string) || session.id;

    // Validate user_id
    if (!userId) {
      console.error("[stripe-webhook] Missing user_id in metadata");
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    // Calculate expiry
    const expiresAt = calculateExpiryDate("day_pass");

    // Insert purchase record
    const supabase = createAdminClient();

    const { error: insertError } = await supabase
      .from("voice_purchases")
      .insert({
        user_id: userId,
        purchase_type: "day_pass",
        payment_provider_id: paymentProviderId,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      // Handle duplicate order (idempotency)
      if (insertError.code === "23505") {
        return NextResponse.json({ success: true, duplicate: true });
      }

      console.error("[stripe-webhook] Failed to insert purchase:", insertError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    console.info("[stripe-webhook] Purchase created", {
      userId,
      paymentProviderId,
      purchaseType: "day_pass",
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      purchaseType: "day_pass",
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[stripe-webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
