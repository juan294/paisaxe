/**
 * PayPal webhook events (PayPal hackathon plan, Phase 4, unit [webhook-cron]).
 *
 * - normalizePaypalEvent: the inbox row for a verified event. Its ids are read
 *   once, at receipt, so a replay needs nothing but the stored row (R2-04).
 * - processPaypalEvent: applies one inbox row to the payment it belongs to,
 *   reading only that row and PayPal. Transitions are forward only: PayPal
 *   delivers, and even creates, events out of order (Phase 0 findings 3 and
 *   4), so an event that would move a payment backwards changes nothing.
 * - processAndRecordPaypalEvent: the webhook route's and the cron drain's
 *   shared step. Marks the row processed only on success; a failure is
 *   recorded and the row stays unprocessed for redelivery or the drain (F03).
 *
 * Event names are the ones confirmed in the Phase 0 sandbox runs
 * (CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.REFUNDED)
 * plus PayPal's documented PAYMENT.CAPTURE.PENDING and PAYMENT.CAPTURE.DENIED,
 * which the sandbox runs did not produce, and (Phase 8a) PayPal's documented
 * INVOICING.INVOICE.PAID, which concerns a booking's balance invoice, not a
 * payment row. It also fires for partial and pending payments, so it only
 * triggers a read of the invoice (settleBalanceInvoice). INVOICING.INVOICE.CANCELLED
 * ("A merchant or customer cancels an invoice.") only marks an open invoice
 * cancelled.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { getCapture, valueToCents } from "@/lib/paypal";
import { captureApprovedOrder, compensateCapturedPayment, finalizeCaptured, type CaptureOutcome } from "./capture";
import { markInvoiceCancelled, settleBalanceInvoice } from "./invoice";
import {
  CAPTURABLE,
  RECORDABLE,
  flagNeedsAttention,
  guardedUpdate,
  markBookingRefunded,
  type Row,
} from "./payment-state";
import { isUuid } from "./types";

/** A row of public.paypal_webhook_events, as processing reads it. */
export interface PaypalInboxEvent {
  event_id: string;
  event_type: string;
  payload: Row;
  order_id: string | null;
  capture_id: string | null;
  refund_id: string | null;
  custom_id: string | null;
}

/** "unsettled": an invoice event whose invoice is not (yet) paid in full and settled; nothing to retry. */
export type EventOutcome = CaptureOutcome | "recorded" | "out_of_order" | "ignored" | "unsettled";

/** Prefix of an unmatched event's last_error; the reconciliation drain skips those rows. */
export const UNMATCHED_TAG = "[PAYPAL_WEBHOOK_UNMATCHED]";

/** The event resolves to no payment of ours. It stays unprocessed. */
export class PaypalWebhookUnmatched extends Error {
  constructor(eventId: string) {
    super(`${UNMATCHED_TAG} event ${eventId} matches no payment`);
    this.name = "PaypalWebhookUnmatched";
  }
}

const ORDER_APPROVED = "CHECKOUT.ORDER.APPROVED";
const CAPTURE_COMPLETED = "PAYMENT.CAPTURE.COMPLETED";
const CAPTURE_PENDING = "PAYMENT.CAPTURE.PENDING";
const CAPTURE_DENIED = "PAYMENT.CAPTURE.DENIED";
const CAPTURE_REFUNDED = "PAYMENT.CAPTURE.REFUNDED";
const INVOICE_PAID = "INVOICING.INVOICE.PAID";
const INVOICE_CANCELLED = "INVOICING.INVOICE.CANCELLED";

/** An approval can still lead to a capture (or confirms one already made). */
const APPROVAL_FROM = [...CAPTURABLE, "captured"];
/** Every status except refunded itself: a refund is the payment's last word. */
const REFUNDED_FROM = [...RECORDABLE, "refund_pending", "refund_failed"];

const CAPTURE_LINK_RE = /\/v2\/payments\/captures\/([^/?#]+)/;

function asRow(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function relatedOrderId(resource: Row): string | null {
  return text(asRow(asRow(resource.supplementary_data)?.related_ids)?.order_id);
}

/** A refund names its capture only through its rel=up link. */
function captureIdFromLinks(resource: Row): string | null {
  const links = Array.isArray(resource.links) ? resource.links : [];
  const up = links.map(asRow).find((link) => link?.rel === "up");
  return text(up?.href)?.match(CAPTURE_LINK_RE)?.[1] ?? null;
}

/** The inbox row for a verified event, or null when it has no id or type. */
export function normalizePaypalEvent(payload: unknown): PaypalInboxEvent | null {
  const event = asRow(payload);
  const eventId = text(event?.id);
  const eventType = text(event?.event_type);
  if (!event || !eventId || !eventType) return null;

  const resource = asRow(event.resource) ?? {};
  const row: PaypalInboxEvent = {
    event_id: eventId,
    event_type: eventType,
    payload: event,
    order_id: null,
    capture_id: null,
    refund_id: null,
    custom_id: null,
  };

  if (eventType.startsWith("CHECKOUT.ORDER.")) {
    const units = Array.isArray(resource.purchase_units) ? resource.purchase_units : [];
    row.order_id = text(resource.id);
    row.custom_id = text(asRow(units[0])?.custom_id);
  } else if (eventType === CAPTURE_REFUNDED) {
    row.refund_id = text(resource.id);
    row.capture_id = captureIdFromLinks(resource);
    row.order_id = relatedOrderId(resource);
    row.custom_id = text(resource.custom_id);
  } else if (eventType.startsWith("PAYMENT.CAPTURE.")) {
    row.capture_id = text(resource.id);
    row.order_id = relatedOrderId(resource);
    row.custom_id = text(resource.custom_id);
  }
  return row;
}

async function paymentWhere(client: SupabaseClient, column: string, value: string): Promise<Row | null> {
  const { data, error } = await client
    .from("payments")
    .select("*")
    .eq(column, value)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load payment: ${error.message}`);
  return data;
}

/** Order id, then custom_id (the booking id), then the capture, then PayPal's view of the capture. */
async function resolvePayment(client: SupabaseClient, event: PaypalInboxEvent): Promise<{ payment: Row; booking: Row }> {
  let payment = event.order_id ? await paymentWhere(client, "order_id", event.order_id) : null;
  if (!payment && event.custom_id && isUuid(event.custom_id)) {
    payment = await paymentWhere(client, "booking_id", event.custom_id);
  }
  if (!payment && event.capture_id) payment = await paymentWhere(client, "capture_id", event.capture_id);
  if (!payment && event.capture_id) {
    const capture = await getCapture(event.capture_id);
    if (capture.orderId) payment = await paymentWhere(client, "order_id", capture.orderId);
  }
  if (!payment) {
    logger.error("[PAYPAL_WEBHOOK_UNMATCHED]", {
      eventId: event.event_id,
      eventType: event.event_type,
      orderId: event.order_id,
      captureId: event.capture_id,
    });
    throw new PaypalWebhookUnmatched(event.event_id);
  }

  const { data: booking, error } = await client.from("bookings").select("*").eq("id", payment.booking_id).single();
  if (error) throw new Error(`Failed to load booking: ${error.message}`);
  return { payment, booking };
}

function outOfOrder(event: PaypalInboxEvent, payment: Row): EventOutcome {
  logger.warn("[PAYPAL_WEBHOOK_OUT_OF_ORDER]", {
    eventId: event.event_id,
    eventType: event.event_type,
    bookingId: payment.booking_id,
    paymentId: payment.id,
    paymentStatus: payment.status,
  });
  return "out_of_order";
}

/** Amount, currency and custom_id of the event's capture must be this booking's deposit. */
function captureMatchesBooking(event: PaypalInboxEvent, booking: Row): boolean {
  const amount = asRow(asRow(event.payload.resource)?.amount);
  const value = text(amount?.value);
  let cents: number | null = null;
  try {
    cents = value ? valueToCents(value) : null;
  } catch {
    // An unreadable amount cannot match.
  }
  return cents === booking.deposit_cents && amount?.currency_code === booking.currency && event.custom_id === booking.id;
}

async function onOrderApproved(client: SupabaseClient, event: PaypalInboxEvent, payment: Row, booking: Row): Promise<EventOutcome> {
  // An expired or failed payment is never captured on a late approval.
  if (!APPROVAL_FROM.includes(payment.status as string)) return outOfOrder(event, payment);
  await guardedUpdate(client, "payments", payment.id, { status: "approved" }, ["created"]);
  return captureApprovedOrder(client, booking.id as string, "webhook");
}

/** May be the first evidence of a capture whose response was lost: persist it, then finalize. */
async function onCaptureCompleted(client: SupabaseClient, event: PaypalInboxEvent, payment: Row, booking: Row): Promise<EventOutcome> {
  const conflictingCapture = payment.capture_id && payment.capture_id !== event.capture_id;
  if (!event.capture_id || conflictingCapture || !RECORDABLE.includes(payment.status as string)) {
    return outOfOrder(event, payment);
  }

  if (!captureMatchesBooking(event, booking)) {
    // One write records the capture and the refund intent: a mismatched capture is never "captured".
    logger.error("[PAYPAL_CAPTURE_MISMATCH]", { bookingId: booking.id, eventId: event.event_id, source: "webhook", captured: true });
    return compensateCapturedPayment(client, booking, { ...payment, capture_id: event.capture_id }, "order_mismatch");
  }

  const fields = { status: "captured", capture_id: event.capture_id, captured_at: payment.captured_at ?? new Date().toISOString() };
  if (!(await guardedUpdate(client, "payments", payment.id, fields, RECORDABLE))) return outOfOrder(event, payment);
  return finalizeCaptured(client, booking, { ...payment, ...fields });
}

async function onCapturePending(client: SupabaseClient, event: PaypalInboxEvent, payment: Row): Promise<EventOutcome> {
  const fields: Row = { status: "capture_pending" };
  if (!payment.capture_id && event.capture_id) fields.capture_id = event.capture_id;
  if (!(await guardedUpdate(client, "payments", payment.id, fields, CAPTURABLE))) return outOfOrder(event, payment);
  return "recorded";
}

async function onCaptureDenied(client: SupabaseClient, event: PaypalInboxEvent, payment: Row, booking: Row): Promise<EventOutcome> {
  const fields = { status: "capture_failed", capture_id: payment.capture_id ?? event.capture_id };
  if (!(await guardedUpdate(client, "payments", payment.id, fields, CAPTURABLE))) return outOfOrder(event, payment);
  await flagNeedsAttention(client, booking.id);
  logger.error("[PAYPAL_CAPTURE_DENIED]", { bookingId: booking.id, paymentId: payment.id, eventId: event.event_id });
  return "failed";
}

async function onCaptureRefunded(client: SupabaseClient, event: PaypalInboxEvent, payment: Row, booking: Row): Promise<EventOutcome> {
  const fields = {
    status: "refunded",
    refunded_at: new Date().toISOString(),
    capture_id: payment.capture_id ?? event.capture_id,
    refund_id: payment.refund_id ?? event.refund_id,
  };
  if (!(await guardedUpdate(client, "payments", payment.id, fields, REFUNDED_FROM))) return outOfOrder(event, payment);
  await markBookingRefunded(client, payment, booking.id);
  return "recorded";
}

/**
 * A balance invoice event. The invoice id is read from the stored payload
 * (resource.invoice.id, or resource.id when the resource is the invoice), so
 * a replay needs only the inbox row. Throws PaypalWebhookUnmatched when no
 * booking has the invoice.
 */
async function onInvoiceEvent(client: SupabaseClient, event: PaypalInboxEvent): Promise<EventOutcome> {
  const resource = asRow(event.payload.resource) ?? {};
  const invoiceId = text(asRow(resource.invoice)?.id) ?? text(resource.id);
  const cancelled = event.event_type === INVOICE_CANCELLED;
  let status: string | null = null;
  if (invoiceId) status = cancelled ? await markInvoiceCancelled(client, invoiceId) : await settleBalanceInvoice(client, invoiceId);
  if (!status) {
    logger.error("[PAYPAL_WEBHOOK_UNMATCHED]", { eventId: event.event_id, eventType: event.event_type, invoiceId });
    throw new PaypalWebhookUnmatched(event.event_id);
  }
  if (!cancelled) return status === "paid" ? "recorded" : "unsettled";
  if (status === "cancelled") return "recorded";
  logger.warn("[PAYPAL_WEBHOOK_OUT_OF_ORDER]", { eventId: event.event_id, eventType: event.event_type, invoiceId, invoiceStatus: status });
  return "out_of_order";
}

/**
 * Applies one inbox row. Reads only the row and PayPal (R2-04), so the cron
 * drain can replay it long after the request that stored it has ended.
 * Throws when the row matches no payment; it then stays unprocessed.
 */
export async function processPaypalEvent(client: SupabaseClient, event: PaypalInboxEvent): Promise<EventOutcome> {
  if (event.event_type === INVOICE_PAID || event.event_type === INVOICE_CANCELLED) return onInvoiceEvent(client, event);
  const handlers: Record<string, typeof onCaptureCompleted> = {
    [ORDER_APPROVED]: onOrderApproved,
    [CAPTURE_COMPLETED]: onCaptureCompleted,
    [CAPTURE_PENDING]: onCapturePending,
    [CAPTURE_DENIED]: onCaptureDenied,
    [CAPTURE_REFUNDED]: onCaptureRefunded,
  };
  const handler = handlers[event.event_type];
  if (!handler) return "ignored";

  const { payment, booking } = await resolvePayment(client, event);
  return handler(client, event, payment, booking);
}

/**
 * Processes a row and marks it processed. On failure the error is recorded on
 * the row, which stays unprocessed, and rethrown so the caller can answer 500
 * (PayPal redelivers) or count it (the cron drain retries next run).
 */
export async function processAndRecordPaypalEvent(client: SupabaseClient, event: PaypalInboxEvent): Promise<EventOutcome> {
  let outcome: EventOutcome;
  try {
    outcome = await processPaypalEvent(client, event);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { error: markError } = await client.rpc("mark_paypal_event_failed", { p_event_id: event.event_id, p_error: message });
    if (markError) logger.error("[PAYPAL_WEBHOOK_MARK_FAILED]", { eventId: event.event_id, error: markError.message });
    throw error;
  }

  const { error } = await client.rpc("mark_paypal_event_processed", { p_event_id: event.event_id });
  if (error) throw new Error(`Failed to mark PayPal event processed: ${error.message}`);
  return outcome;
}
