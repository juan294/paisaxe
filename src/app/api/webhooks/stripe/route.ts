import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { verifyWebhookSignature, calculateExpiryDate } from "@/lib/stripe";
import type { PurchaseType } from "@/lib/stripe";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";

const VALID_PURCHASE_TYPES = new Set<string>(["day_pass", "weekly_pass", "monthly_pass"]);
const RPC_TIMEOUT_MS = 10_000;

// BE-M5/SE-M2: checkout.session.completed fires even for delayed-settlement
// payment methods (SEPA, Bizum, Klarna) before funds actually clear — Stripe
// reports payment_status "unpaid" at that point and follows up with
// checkout.session.async_payment_succeeded once payment_status flips to
// "paid". Card payments (the only method enabled today) settle synchronously,
// so payment_status is already "paid" on checkout.session.completed and this
// is a no-op for the existing path.
const GRANTING_EVENT_TYPES = new Set<string>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

function resolvePurchaseType(raw: string | undefined): PurchaseType {
  if (raw && VALID_PURCHASE_TYPES.has(raw)) {
    return raw as PurchaseType;
  }
  return "day_pass";
}

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
 * - checkout.session.completed: Creates voice purchase record atomically,
 *   but only when session.payment_status is already "paid" (synchronous
 *   payment methods, e.g. card).
 * - checkout.session.async_payment_succeeded: Same grant path, for delayed-
 *   settlement payment methods where payment_status flips to "paid" after
 *   checkout.session.completed already fired with "unpaid".
 *
 * Idempotency and grant creation are wrapped in a single Postgres RPC keyed
 * on the Stripe event id, so the webhook never records the dedup row without
 * also granting access. checkout.session.completed and
 * checkout.session.async_payment_succeeded carry distinct event ids for the
 * same purchase, but at most one of them ever has payment_status "paid" for
 * a given checkout session — so exactly one grant call is ever made per
 * purchase regardless of which event triggers it.
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

    // Only handle events that can result in a grant.
    if (!GRANTING_EVENT_TYPES.has(event.type)) {
      return NextResponse.json({ received: true });
    }
    const session = event.data.object as Stripe.Checkout.Session;

    // BE-M5/SE-M2: never grant before Stripe confirms payment actually
    // settled. See GRANTING_EVENT_TYPES comment above for why both event
    // types are handled here with the same guard.
    if (session.payment_status !== "paid") {
      logger.info("[STRIPE_WEBHOOK_PAYMENT_NOT_SETTLED]", {
        eventId: event.id,
        eventType: event.type,
        paymentStatus: session.payment_status,
      });
      return NextResponse.json(
        { received: true, status: "payment_not_settled" },
        { status: 200 }
      );
    }

    const userId = session.metadata?.user_id;

    if (!userId) {
      return unrecoverableResponse(event.id, "missing_user_id");
    }

    const paymentProviderId = session.payment_intent as string | null;
    if (!paymentProviderId) {
      return unrecoverableResponse(event.id, "missing_payment_intent");
    }

    const purchaseType = resolvePurchaseType(session.metadata?.purchase_type ?? undefined);
    const expiresAt = calculateExpiryDate(purchaseType);
    const amountPaid = session.amount_total ?? 0;
    const supabase = createAdminClient();

    // BE-L2: wrap in a client-side timeout so Stripe retries if the DB is slow.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("RPC_TIMEOUT")), RPC_TIMEOUT_MS)
    );

    let data: string | null;
    let error: { message: string } | null;
    try {
      const result = await Promise.race([
        supabase.rpc("grant_day_pass_idempotent", {
          p_event_id: event.id,
          p_event_type: event.type,
          p_user_id: userId,
          p_payment_provider_id: paymentProviderId,
          p_expires_at: expiresAt.toISOString(),
          p_amount_paid: amountPaid,
          p_purchase_type: purchaseType,
        }),
        timeoutPromise,
      ]);
      data = result.data as string | null;
      error = result.error as { message: string } | null;
    } catch (raceErr) {
      const isTimeout =
        raceErr instanceof Error && raceErr.message === "RPC_TIMEOUT";
      if (isTimeout) {
        logger.error("[STRIPE_RPC_TIMEOUT]", {
          eventId: event.id,
          purchaseType,
        });
        return NextResponse.json({ error: "Database timeout" }, { status: 500 });
      }
      throw raceErr;
    }

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
      purchaseType,
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
