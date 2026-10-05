/**
 * The payment and booking transitions shared by the capture path, the
 * webhook and reconciliation (PayPal hackathon plan, Phase 4). Every write is
 * a guarded UPDATE that applies only from the listed statuses, so a lost race
 * is a no-op the caller can see, and states only move forward.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { notifyBookingSync } from "./zapier";

export type Row = Record<string, unknown>;

/** Payment statuses from which a capture may still be attempted (no capture is known yet). */
export const CAPTURABLE = ["created", "approved", "capture_pending"];
/** Payment statuses in which the refund is the outcome (never re-confirm). */
export const COMPENSATING = ["refund_pending", "refunded", "refund_failed"];
/** Every status but the refund ones: a capture that happened is recorded over them, because money moved (R2-01). */
export const RECORDABLE = [...CAPTURABLE, "captured", "expired", "capture_failed"];
/** Booking statuses a refunded payment turns into refunded. */
export const BOOKING_REFUNDED_FROM = ["pending_payment", "confirmed", "needs_attention", "expired", "cancel_pending", "refund_pending"];

/**
 * One guarded UPDATE: applies `fields` only while the row is in one of
 * `fromStatuses`. Returns whether a row changed, so a lost race is visible.
 */
export async function guardedUpdate(
  client: SupabaseClient,
  table: "payments" | "bookings",
  id: unknown,
  fields: Row,
  fromStatuses: string[]
): Promise<boolean> {
  const { data, error } = await client.from(table).update(fields).eq("id", id).in("status", fromStatuses).select("id");
  if (error) throw new Error(`Failed to update ${table}: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** A booking whose payment needs a human (declined, mismatched, refund failed) unless it moved on. */
export function flagNeedsAttention(client: SupabaseClient, bookingId: unknown, from = ["pending_payment", "expired"]): Promise<boolean> {
  return guardedUpdate(client, "bookings", bookingId, { status: "needs_attention" }, from);
}

/** After a payment is refunded: the booking is refunded, except for a duplicate capture, whose booking stays confirmed by its other payment. */
export async function markBookingRefunded(client: SupabaseClient, payment: Row, bookingId: unknown): Promise<void> {
  if (payment.compensation_reason === "duplicate_capture") return;
  // BOOKING_REFUNDED_FROM excludes refunded: only the write that changed the row notifies (Phase 8c).
  if (await guardedUpdate(client, "bookings", bookingId, { status: "refunded" }, BOOKING_REFUNDED_FROM)) {
    notifyBookingSync(client, bookingId as string, "booking.refunded");
  }
}

/** Booking statuses a failed refund flags for attention. */
const REFUND_FAILED_FLAGS = ["pending_payment", "needs_attention", "expired", "cancel_pending", "refund_pending"];

/**
 * Moves a refund_pending payment, and its booking, to PayPal's final refund
 * status. Returns the payment's new status, or null when nothing changed
 * (PayPal still pending, or another caller got there first).
 */
export async function applyRefundStatus(
  client: SupabaseClient,
  payment: Row,
  bookingId: unknown,
  refundStatus: string
): Promise<"refunded" | "refund_failed" | null> {
  if (refundStatus === "COMPLETED") {
    if (!(await guardedUpdate(client, "payments", payment.id, { status: "refunded", refunded_at: new Date().toISOString() }, ["refund_pending"]))) return null;
    await markBookingRefunded(client, payment, bookingId);
    return "refunded";
  }
  if (refundStatus === "FAILED" || refundStatus === "CANCELLED") {
    if (!(await guardedUpdate(client, "payments", payment.id, { status: "refund_failed" }, ["refund_pending"]))) return null;
    await flagNeedsAttention(client, bookingId, REFUND_FAILED_FLAGS);
    logger.error("[PAYPAL_REFUND_FAILED]", { bookingId, paymentId: payment.id, refundStatus });
    return "refund_failed";
  }
  return null;
}

export function holdIsLive(hold: Row): boolean {
  return !hold.consumed_at && !hold.released_at && new Date(hold.expires_at as string) > new Date();
}
