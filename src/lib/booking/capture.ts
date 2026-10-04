/**
 * The deposit's payment flow (PayPal hackathon plan, Phase 4).
 *
 * - ensurePaymentOrder: one PayPal order per booking, created or reused, for
 *   the create_payment_order tool and the booking page's pay button.
 * - captureApprovedOrder: THE only code that captures (F02). Called by the
 *   return page, the CHECKOUT.ORDER.APPROVED webhook and reconciliation.
 * - finalizeCaptured: hands the inventory from the hold to the booking.
 * - compensateCapturedPayment: refunds a captured payment whose booking cannot
 *   be fulfilled, with a fixed PayPal-Request-Id so retries refund once.
 *
 * Whether money has moved decides the branch (R2-01): an order that is
 * COMPLETED is never expired, it is confirmed or refunded. An unknown capture
 * outcome stays capture_pending until PayPal says otherwise (R2-02).
 *
 * Phase 8b: for a merchant in confirmation_mode 'phone' the order is created
 * with intent AUTHORIZE, and captureApprovedOrder hands an approval to
 * phone-confirmation.ts, which authorizes and never reaches captureOrder.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { getSiteUrl } from "@/lib/env";
import {
  PaypalError,
  PaypalNotConfigured,
  captureOrder,
  createOrder,
  getOrder,
  refundCapture,
  type PaypalCapture,
  type PaypalOrder,
} from "@/lib/paypal";
import type { CaptureOutcome, PaymentStartResponse } from "@/types/booking-page";
import { bookingLink } from "./links";
import { settleApprovedPhoneOrder } from "./phone-confirmation";
import { isPhoneMerchant, phoneConfirmationReadiness } from "./phone-config";
import {
  CAPTURABLE,
  COMPENSATING,
  RECORDABLE,
  flagNeedsAttention,
  guardedUpdate,
  holdIsLive,
  type Row,
} from "./payment-state";
import { BookingError, UNIQUE_VIOLATION } from "./types";
import { notifyBookingSync } from "./zapier";

export type CaptureSource = "return" | "webhook" | "reconcile";

export type { CaptureOutcome };

interface FlowState {
  booking: Row;
  payment: Row | null;
  hold: Row;
}

/** Payment statuses in which the buyer already approved: a second order would hide this one. */
const IN_PROGRESS = ["capture_pending", "captured", "authorized", "void_pending"];

/** The booking (with its hold, experience title and merchant's confirmation mode) and its latest payment, in one round trip. */
async function loadState(client: SupabaseClient, bookingId: string): Promise<FlowState & { experienceTitle: string; phone: boolean }> {
  const [booking, payment] = await Promise.all([
    client
      .from("bookings")
      .select("*, hold:holds(*), experience:experiences(title, merchant:merchants(confirmation_mode))")
      .eq("id", bookingId)
      .maybeSingle(),
    client.from("payments").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (booking.error) throw new Error(`Failed to load booking: ${booking.error.message}`);
  if (!booking.data) throw new BookingError("not_found");
  if (payment.error) throw new Error(`Failed to load payment: ${payment.error.message}`);

  const { hold, experience, ...row } = booking.data as Row & { hold: Row; experience: { title: string } | null };
  return { booking: row, payment: payment.data, hold, experienceTitle: experience?.title ?? "", phone: isPhoneMerchant(experience) };
}

/** One open payment per booking (migration 121): a concurrent insert loses and continues the winner's row. */
async function insertPayment(client: SupabaseClient, booking: Row): Promise<Row> {
  const inserted = await client
    .from("payments")
    .insert({ booking_id: booking.id, amount_cents: booking.deposit_cents, currency: booking.currency })
    .select("*")
    .single();
  if (!inserted.error) return inserted.data;
  if (inserted.error.code !== UNIQUE_VIOLATION) throw new Error(`Failed to create payment: ${inserted.error.message}`);

  const open = await client.from("payments").select("*").eq("booking_id", booking.id).eq("status", "created").maybeSingle();
  if (open.error || !open.data) throw new BookingError("payment_in_progress");
  return open.data;
}

/** Amount, currency and custom_id of the order must be this booking's deposit. */
function matchesBooking(order: PaypalOrder, booking: Row): boolean {
  return order.amountCents === booking.deposit_cents && order.currency === booking.currency && order.customId === booking.id;
}


/**
 * One PayPal order per booking: reuses an open one, else creates it.
 * Requires a pending_payment booking with a live hold (the quote was accepted,
 * since a booking exists only after accept_quote).
 */
export async function ensurePaymentOrder(client: SupabaseClient, bookingId: string): Promise<PaymentStartResponse> {
  const { booking, payment, hold, experienceTitle, phone } = await loadState(client, bookingId);
  if (booking.status !== "pending_payment") throw new BookingError("invalid_state");
  if (!holdIsLive(hold)) throw new BookingError("hold_expired");
  if (phone) {
    // Never take an authorization for a confirmation call that cannot be made (Phase 8b).
    const readiness = await phoneConfirmationReadiness();
    if (!readiness.ready) {
      logger.warn("[PHONE_CONFIRMATION_NOT_CONFIGURED]", { bookingId, reason: readiness.reason });
      throw new BookingError("payment_unavailable");
    }
  }

  // expiresAt is the hold's expiry: the buyer must approve before it.
  const result = (approveUrl: string): PaymentStartResponse => ({
    approveUrl,
    amountCents: booking.deposit_cents as number,
    currency: booking.currency as string,
    expiresAt: hold.expires_at as string,
  });

  // The buyer already approved: a second order would hide this one from reconciliation.
  if (payment && IN_PROGRESS.includes(payment.status as string)) {
    throw new BookingError("payment_in_progress");
  }
  if (payment?.order_id && payment.approve_url && ["created", "approved"].includes(payment.status as string)) {
    return result(payment.approve_url as string);
  }

  // A payment whose order was never created (PayPal failed, or a concurrent
  // call is creating it) is continued with its own key: PayPal-Request-Id
  // makes the second createOrder return the same order.
  const row: Row = payment?.status === "created" && !payment.order_id ? payment : await insertPayment(client, booking);

  const link = `${getSiteUrl()}${bookingLink({ id: booking.id as string, linkVersion: booking.link_version as number })}`;
  try {
    const order = await createOrder({
      bookingId: booking.id as string,
      amountCents: booking.deposit_cents as number,
      currency: "EUR",
      description: `${experienceTitle} (demo)`,
      returnUrl: `${link}/return`,
      cancelUrl: `${link}?cancelled=1`,
      operationKey: row.operation_key as string,
      ...(phone ? { intent: "AUTHORIZE" as const } : {}),
    });
    const stored = await client.from("payments").update({ order_id: order.orderId, approve_url: order.approveUrl }).eq("id", row.id);
    if (stored.error) throw new Error(`Failed to store the order: ${stored.error.message}`);
    return result(order.approveUrl);
  } catch (error) {
    if (error instanceof PaypalNotConfigured || error instanceof PaypalError) {
      logger.error("[PAYPAL_CREATE_ORDER_FAILED]", { bookingId, error: error.message });
      // PayPal's message stays in the log; the model sees only the code.
      throw new BookingError("payment_unavailable");
    }
    throw error;
  }
}

/**
 * Records what PayPal says about a capture. A completed one is persisted
 * before anything else (R2-01), then finalized; a declined one is the only
 * route to capture_failed; anything else stays capture_pending for
 * reconciliation (R2-02).
 */
async function settleCapture(client: SupabaseClient, state: FlowState, capture: PaypalCapture): Promise<CaptureOutcome> {
  const { booking } = state;
  const payment = state.payment as Row;

  if (capture.status === "COMPLETED") {
    await guardedUpdate(client, "payments", payment.id, { status: "captured", capture_id: capture.id, captured_at: new Date().toISOString() }, RECORDABLE);
    return finalizeCaptured(client, booking, { ...payment, capture_id: capture.id, status: "captured" });
  }
  if (capture.status === "DECLINED" || capture.status === "FAILED") {
    await guardedUpdate(client, "payments", payment.id, { status: "capture_failed", capture_id: capture.id }, CAPTURABLE);
    await flagNeedsAttention(client, booking.id);
    return "failed";
  }
  await guardedUpdate(client, "payments", payment.id, { status: "capture_pending", capture_id: capture.id }, CAPTURABLE);
  return "pending";
}

/**
 * The single capture path. Validates the order against the booking on every
 * call, captures only an APPROVED order, and never expires a payment whose
 * money has moved.
 */
export async function captureApprovedOrder(
  client: SupabaseClient,
  bookingId: string,
  source: CaptureSource,
  /** The return page's order (PayPal's `token`): a stale or foreign one never captures this booking's order. */
  expectedOrderId?: string
): Promise<CaptureOutcome> {
  const state = await loadState(client, bookingId);
  const { booking, payment, hold } = state;

  if (expectedOrderId !== undefined && payment?.order_id !== expectedOrderId) return "mismatch";

  if (booking.status === "confirmed") return "confirmed";
  if (!payment?.order_id) return "awaiting_approval";
  if (COMPENSATING.includes(payment.status as string)) return "compensating";
  if (payment.status === "captured" && payment.capture_id) {
    return finalizeCaptured(client, booking, payment);
  }
  // Phone-confirmed merchant: authorize, never capture here (Phase 8b).
  if (state.phone) return settleApprovedPhoneOrder(client, { booking, payment, hold }, source);

  const order = await getOrder(payment.order_id as string);

  if (order.status === "COMPLETED" && order.capture) {
    if (!matchesBooking(order, booking)) {
      logger.error("[PAYPAL_CAPTURE_MISMATCH]", { bookingId, orderId: order.id, source, captured: true });
      return compensateCapturedPayment(client, booking, { ...payment, capture_id: order.capture.id }, "order_mismatch");
    }
    return settleCapture(client, state, order.capture);
  }

  if (order.status !== "APPROVED") {
    // VOIDED is authoritative for an order PayPal will never capture.
    if (order.status === "VOIDED" && payment.status === "capture_pending") {
      await guardedUpdate(client, "payments", payment.id, { status: "capture_failed" }, ["capture_pending"]);
      await flagNeedsAttention(client, booking.id);
      return "failed";
    }
    return "awaiting_approval";
  }

  // A late approval of a payment that already ended is never captured.
  if (!CAPTURABLE.includes(payment.status as string)) {
    return payment.status === "capture_failed" ? "failed" : "slot_gone";
  }

  if (!matchesBooking(order, booking)) {
    logger.error("[PAYPAL_CAPTURE_MISMATCH]", { bookingId, orderId: order.id, source, captured: false });
    await flagNeedsAttention(client, booking.id);
    return "mismatch";
  }

  await guardedUpdate(client, "payments", payment.id, { status: "approved" }, ["created"]);

  if (!holdIsLive(hold)) {
    const { data: reacquired, error } = await client.rpc("reacquire_hold", { p_booking_id: booking.id });
    if (error) throw new Error(`Failed to re-acquire hold: ${error.message}`);
    if (!reacquired) {
      // A capture may already be in flight (R2-02): APPROVED is not proof that
      // it did not happen, so keep reconciling; COMPLETED will be refunded.
      if (payment.status === "capture_pending") return "pending";
      // Never captured, so expiring is truthful (R2-01); the order lapses at PayPal.
      if (await guardedUpdate(client, "payments", payment.id, { status: "expired" }, ["created", "approved"])) {
        await guardedUpdate(client, "bookings", booking.id, { status: "expired" }, ["pending_payment"]);
      }
      return "slot_gone";
    }
  }

  await guardedUpdate(client, "payments", payment.id, { status: "capture_pending" }, ["approved", "capture_pending"]);
  let captured: PaypalOrder;
  try {
    captured = await captureOrder(payment.order_id as string, payment.operation_key as string);
  } catch (error) {
    // Timeout or a non-definitive reply: the outcome is unknown (R2-02).
    logger.warn("[PAYPAL_CAPTURE_PENDING]", {
      bookingId,
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return "pending";
  }

  return captured.capture ? settleCapture(client, state, captured.capture) : "pending";
}

/**
 * Confirms a booking whose payment is captured: the hold becomes the booking.
 * If the hold lapsed it is re-acquired once; if the slot is gone, the payment
 * is refunded. A second capture for an already confirmed booking is refunded.
 */
export async function finalizeCaptured(client: SupabaseClient, booking: Row, payment: Row): Promise<CaptureOutcome> {
  const confirm = () =>
    client.rpc("consume_hold_and_confirm", { p_booking_id: booking.id, p_capture_id: payment.capture_id });

  let result = await confirm();
  if (result.error?.message === "hold_not_live") {
    const { data: reacquired, error } = await client.rpc("reacquire_hold", { p_booking_id: booking.id });
    if (error && error.message !== "invalid_state") throw new Error(`Failed to re-acquire hold: ${error.message}`);
    if (!reacquired) return compensateCapturedPayment(client, booking, payment, "slot_gone");
    result = await confirm();
  }
  if (!result.error) {
    // Only this call's own 'confirmed' is the transition; 'already_confirmed' is a repeat (Phase 8c).
    if (result.data === "confirmed") notifyBookingSync(client, booking.id as string, "booking.confirmed");
    return "confirmed";
  }

  switch (result.error.message) {
    case "invalid_state":
      return "compensating";
    case "capture_mismatch":
      return compensateCapturedPayment(client, booking, payment, "duplicate_capture");
    case "hold_not_live":
      return compensateCapturedPayment(client, booking, payment, "slot_gone");
    default:
      throw new Error(`Failed to confirm booking: ${result.error.message}`);
  }
}

/**
 * Records the capture and the refund intent in one write, then refunds with
 * the payment's fixed operation key. A failed refund call leaves refund_pending for
 * reconciliation, which retries with the same key: at most one refund.
 */
export async function compensateCapturedPayment(client: SupabaseClient, booking: Row, payment: Row, reason: string): Promise<CaptureOutcome> {
  await guardedUpdate(client, "payments",
    payment.id,
    { status: "refund_pending", capture_id: payment.capture_id, compensation_reason: reason },
    RECORDABLE
  );
  // A duplicate capture leaves the booking confirmed by its other payment.
  await flagNeedsAttention(client, booking.id, ["pending_payment", "expired", "needs_attention"]);
  logger.error("[PAYPAL_COMPENSATING]", { bookingId: booking.id, paymentId: payment.id, reason });

  try {
    const refund = await refundCapture(payment.capture_id as string, payment.amount_cents as number, payment.operation_key as string);
    await guardedUpdate(client, "payments", payment.id, { refund_id: refund.id }, ["refund_pending"]);
  } catch (error) {
    logger.error("[PAYPAL_REFUND_FAILED]", {
      bookingId: booking.id,
      paymentId: payment.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return "compensating";
}
