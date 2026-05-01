import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { verifyWebhookSignature, calculateExpiryDate } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";

type StripeUnrecoverableReason = "missing_user_id" | "missing_payment_intent";

function unrecoverableResponse(eventId: string, reason: StripeUnrecoverableReason) {
  logger.error("[STRIPE_UNRECOVERABLE]", {
    eventId,
    reason,
  });
  return NextResponse.json(
    { status: "unrecoverable", reason },
    { status: 200 }
  );
}

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events:
 * - checkout.session.completed: Creates voice purchase record atomically
 *
 * Idempotency and grant creation are wrapped in a single Postgres RPC so the
 * webhook never records the dedup row without also granting access.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get signature from header
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      logger.warn("[STRIPE_WEBHOOK_INVALID_REQUEST]", {
        reason: "missing_signature",
      });
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // Verify signature and construct event
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.warn("[STRIPE_WEBHOOK_INVALID_REQUEST]", {
        reason: "invalid_signature",
        error: error.message,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // BE-L2: Audit trail — insert into stripe_webhook_events after signature verification.
    // On duplicate event_id (unique constraint 23505), return 200 immediately (idempotent).
    // Other insert errors are logged but do not block event processing.
    const { error: auditError } = await supabase
      .from("stripe_webhook_events")
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event.data as unknown as Record<string, unknown>,
      });

    if (auditError) {
      const pgCode = (auditError as { code?: string }).code;
      if (pgCode === "23505") {
        // Duplicate event — already processed. Return 200 idempotently.
        return NextResponse.json({ received: true }, { status: 200 });
      }
      logger.error("[STRIPE_WEBHOOK_AUDIT_FAILED]", {
        eventId: event.id,
        code: pgCode,
        error: auditError.message,
      });
      // Continue processing despite audit failure.
    }

    // Only handle checkout.session.completed events
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;

    if (!userId) {
      return unrecoverableResponse(event.id, "missing_user_id");
    }

    const paymentProviderId = session.payment_intent as string | null;
    if (!paymentProviderId) {
      return unrecoverableResponse(event.id, "missing_payment_intent");
    }

    const expiresAt = calculateExpiryDate("day_pass");
    const amountPaid = session.amount_total ?? 0;
    const { data, error } = await supabase.rpc("grant_day_pass_idempotent", {
      p_event_id: event.id,
      p_user_id: userId,
      p_payment_provider_id: paymentProviderId,
      p_expires_at: expiresAt.toISOString(),
      p_amount_paid: amountPaid,
    });

    if (error) {
      logger.error("[STRIPE_RPC_FAILURE]", {
        eventId: event.id,
        error: error.message,
      });
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    logger.info("[STRIPE_WEBHOOK_PROCESSED]", {
      eventId: event.id,
      status: data,
      paymentProviderId,
      expiresAt: expiresAt.toISOString(),
      amountPaid,
    });

    return NextResponse.json({ status: data }, { status: 200 });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("[STRIPE_WEBHOOK_FAILURE]", {
      error: err.message,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
