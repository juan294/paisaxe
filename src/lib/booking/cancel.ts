/**
 * Visitor cancellation (PayPal hackathon plan, Phase 5), in two steps (F01):
 *
 * - cancellationPreview: read-only. The refund the policy gives now (the
 *   deposit before slot start minus the cancellation window, else nothing).
 *   The preview_cancellation tool and the booking page show it.
 * - confirmCancellation: the only authorization. The visitor's button sends
 *   the refund they were shown; confirm_cancellation (migration 123)
 *   recomputes it at that instant and refuses with the fresh terms if it
 *   differs (R2-05). Otherwise the refund is requested with the payment's
 *   operation key, so a retry here or in reconciliation refunds once.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { PaypalError, refundCapture, type PaypalRefund } from "@/lib/paypal";
import type { CancellationTerms } from "@/types/booking-page";
import { applyRefundStatus, flagNeedsAttention, guardedUpdate, type Row } from "./payment-state";
import { BookingError, type Booking } from "./types";


/** Booking statuses a repeated confirm reports as they are (idempotent replies). */
const CANCELLATION_FLOW = ["cancel_pending", "refund_pending", "refunded", "cancelled"];

export type CancellationResult =
  | { outcome: "cancelled" | "unchanged"; status: string; refundCents: number | null }
  | { outcome: "terms_changed"; terms: CancellationTerms };

function terms(booking: Booking, row: { refund_cents: number; slot_start: string; refund_until: string }): CancellationTerms {
  return {
    refundCents: row.refund_cents,
    depositCents: booking.depositCents,
    currency: booking.currency,
    cancellationWindowHours: booking.cancellationWindowHours,
    slotStart: new Date(row.slot_start).toISOString(),
    termsValidUntil: row.refund_cents > 0 ? new Date(row.refund_until).toISOString() : null,
  };
}

/** `now` exists for tests at the cutoff; callers in the app never pass it. */
export async function cancellationPreview(client: SupabaseClient, booking: Booking, now?: Date): Promise<CancellationTerms> {
  if (booking.status !== "confirmed") throw new BookingError("invalid_state");
  const { data, error } = await client
    .rpc("cancellation_terms", { p_booking_id: booking.id, p_now: now?.toISOString() ?? null })
    .single();
  if (error) throw new Error(`Failed to compute cancellation terms: ${error.message}`);
  return terms(booking, data as { refund_cents: number; slot_start: string; refund_until: string });
}

/** HTTP statuses with which PayPal refuses a refund for good: retrying with the same request changes nothing. */
const REFUND_REFUSED_STATUSES = new Set([400, 403, 404, 422]);
/** 422 issues that are not a refusal: PayPal asks to wait and retry (developer.paypal.com/api/rest/responses). */
const RETRYABLE_ISSUES = new Set(["PREVIOUS_REQUEST_IN_PROGRESS"]);

function refusedForGood(error: unknown): error is PaypalError {
  return (
    error instanceof PaypalError &&
    error.status !== null &&
    REFUND_REFUSED_STATUSES.has(error.status) &&
    !(error.issue && RETRYABLE_ISSUES.has(error.issue))
  );
}

/**
 * Requests the refund of a confirmed cancellation with "refund:" + the
 * payment's operation key, then moves the payment and booking to
 * refund_pending (and on, if PayPal already finished it). Also used by
 * reconciliation to retry one whose first request failed. A definitive
 * refusal (4xx) is not retried: the payment becomes refund_failed and the
 * booking needs_attention for a person, and null is returned. Other errors are rethrown for a retry.
 */
export async function requestCancellationRefund(client: SupabaseClient, booking: Row, payment: Row): Promise<PaypalRefund | null> {
  const amount = booking.refund_cents;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`No refund amount for booking ${booking.id}`);
  }
  let refund: PaypalRefund;
  try {
    refund = await refundCapture(payment.capture_id as string, amount, payment.operation_key as string);
  } catch (error) {
    if (!refusedForGood(error)) throw error;
    // The plan's "refund failed at PayPal" state; a captured payment would be picked up by reconciliation step 5.
    if (await guardedUpdate(client, "payments", payment.id, { status: "refund_failed" }, ["captured"])) {
      await flagNeedsAttention(client, booking.id, ["cancel_pending"]);
    }
    logger.error("[PAYPAL_REFUND_REFUSED]", { bookingId: booking.id, paymentId: payment.id, status: error.status, issue: error.issue });
    return null;
  }
  if (!(await guardedUpdate(client, "payments", payment.id, { status: "refund_pending", refund_id: refund.id }, ["captured"]))) return null;
  await guardedUpdate(client, "bookings", booking.id, { status: "refund_pending" }, ["cancel_pending"]);
  await applyRefundStatus(client, payment, booking.id, refund.status);
  return refund;
}

export async function confirmCancellation(
  client: SupabaseClient,
  booking: Booking,
  expectedRefundCents: number,
  now?: Date
): Promise<CancellationResult> {
  const { data, error } = await client.rpc("confirm_cancellation", {
    p_booking_id: booking.id,
    p_expected_refund_cents: expectedRefundCents,
    p_now: now?.toISOString() ?? null,
  });
  if (error) throw new Error(`Failed to confirm the cancellation: ${error.message}`);
  const result = data as {
    outcome: string;
    status: string;
    refund_cents: number | null;
    cancellation_confirmed?: boolean;
    slot_start?: string;
    refund_until?: string;
  };

  if (result.outcome === "terms_changed") {
    return { outcome: "terms_changed", terms: terms(booking, result as { refund_cents: number; slot_start: string; refund_until: string }) };
  }
  // Not confirmed and never cancelled (unpaid, expired, flagged): nothing to cancel, never "cancelled".
  // A cancelled booking flagged after a refused refund reports its status, as a repeated click should.
  if (result.outcome === "unchanged" && !CANCELLATION_FLOW.includes(result.status) && !result.cancellation_confirmed) {
    throw new BookingError("invalid_state");
  }
  if (result.outcome !== "cancelled" || result.status !== "cancel_pending") {
    return { outcome: result.outcome as "cancelled" | "unchanged", status: result.status, refundCents: result.refund_cents };
  }

  // The cancellation is recorded from here on: any failure is "refund retried
  // automatically" (reconciliation, same key), never "could not cancel".
  try {
    const payment = await client
      .from("payments")
      .select("*")
      .eq("booking_id", booking.id)
      .eq("status", "captured")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (payment.error) throw new Error(`Failed to load the captured payment: ${payment.error.message}`);

    await requestCancellationRefund(client, { id: booking.id, refund_cents: result.refund_cents }, payment.data);

    const { data: current, error: reloadError } = await client.from("bookings").select("status").eq("id", booking.id).single();
    if (reloadError) throw new Error(`Failed to reload the booking: ${reloadError.message}`);
    return { outcome: "cancelled", status: current.status as string, refundCents: result.refund_cents };
  } catch (refundError) {
    logger.error("[BOOKING_CANCEL_REFUND_FAILED]", {
      bookingId: booking.id,
      error: refundError instanceof Error ? refundError.message : String(refundError),
    });
    throw new BookingError("refund_unavailable");
  }
}
