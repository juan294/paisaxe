import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { verifyWebhookSignature, calculateExpiryDate } from "@/lib/stripe";
import type Stripe from "stripe";

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed: Creates voice purchase record
 *
 * Idempotency: deduplicates via event.id stored in stripe_webhook_events table.
 * If payment_intent is absent, the event is acknowledged but no grant is issued.
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

    const supabase = createAdminClient();

    // Idempotency check: deduplicate by Stripe event.id
    const { data: existingEvent } = await supabase
      .from("stripe_webhook_events")
      .select("id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json(
        { received: true, status: "duplicate" },
        { status: 200 }
      );
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    // Validate user_id
    if (!userId) {
      console.error("[stripe-webhook] Missing user_id in metadata");
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    // Require payment_intent — do not fall back to session.id
    const paymentProviderId = session.payment_intent as string | null;
    if (!paymentProviderId) {
      console.error(
        "[stripe-webhook] Missing payment_intent — cannot grant day pass",
        { eventId: event.id, sessionId: session.id }
      );
      return NextResponse.json({ received: true, status: "no_payment_intent" });
    }

    // Record deduplication entry BEFORE granting the day pass
    const { error: dedupError } = await supabase
      .from("stripe_webhook_events")
      .insert({ event_id: event.id });

    if (dedupError) {
      // Another concurrent request already inserted this event.id (race condition)
      if (dedupError.code === "23505") {
        return NextResponse.json(
          { received: true, status: "duplicate" },
          { status: 200 }
        );
      }
      console.error("[stripe-webhook] Failed to record event:", dedupError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Calculate expiry
    const expiresAt = calculateExpiryDate("day_pass");

    // Insert purchase record
    const { error: insertError } = await supabase
      .from("voice_purchases")
      .insert({
        user_id: userId,
        purchase_type: "day_pass",
        payment_provider_id: paymentProviderId,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
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
