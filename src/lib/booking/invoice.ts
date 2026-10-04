/**
 * The balance invoice of a confirmed booking (PayPal hackathon plan, Phase 8a).
 *
 * - sendBalanceInvoice: one PayPal invoice per booking for the balance
 *   (total - deposit), to the email of the PayPal account that paid the
 *   deposit, due on the slot date. Idempotent by bookings.invoice_id, set
 *   once by a guarded UPDATE; PayPal-Request-Id derives from the booking id,
 *   so a retry after a lost answer reaches the same invoice.
 * - settleBalanceInvoice: what the INVOICING.INVOICE.PAID webhook (and a
 *   repeated send) does. PayPal fires that event for partial and pending
 *   payments too, so the balance is paid only after reading the invoice and
 *   verifying it PAID, with nothing due and the whole balance paid.
 *
 * - closeInvoiceAfterCancellation: when the visitor's cancellation is
 *   recorded, an unpaid invoice is cancelled at PayPal (the cancel path calls
 *   the never-throwing wrapper; reconciliation retries). A balance already
 *   paid is never refunded automatically (the refund policy covers the
 *   deposit only): once the cancellation is complete the booking is flagged
 *   needs_attention for the operator.
 * - markInvoiceCancelled: INVOICING.INVOICE.CANCELLED, idempotent.
 *
 * The payer's email is read from the captured order at PayPal and never
 * stored. The payer link reaches cards and the capability page only (F05).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  PaypalError,
  PaypalNotConfigured,
  cancelInvoice,
  createInvoice,
  getInvoice,
  getOrder,
  sendInvoice,
  type PaypalInvoice,
} from "@/lib/paypal";
import type { BalanceInvoiceStatus } from "@/types/booking-page";
import { guardedUpdate } from "./payment-state";
import { BookingError, madridDate, type Booking } from "./types";

export interface BalanceInvoice {
  invoiceId: string;
  status: BalanceInvoiceStatus;
  /** The payer's PayPal link; null while a draft. */
  url: string | null;
  /** This call created or sent the invoice (false: it already existed). */
  created: boolean;
}

interface InvoiceState {
  invoice_id: string | null;
  invoice_status: BalanceInvoiceStatus | null;
  invoice_url: string | null;
}

/** Statuses an unsettled payment may move between; paid is final. */
const UNSETTLED = ["sent", "payment_pending", "partially_paid"];
/** PayPal statuses with a payment that is not (yet) the whole balance, settled. */
const IN_PROGRESS: Record<string, BalanceInvoiceStatus> = {
  PAYMENT_PENDING: "payment_pending",
  PARTIALLY_PAID: "partially_paid",
};

async function loadState(client: SupabaseClient, bookingId: string): Promise<InvoiceState> {
  const { data, error } = await client.from("bookings").select("invoice_id, invoice_status, invoice_url").eq("id", bookingId).single();
  if (error) throw new Error(`Failed to load the booking invoice: ${error.message}`);
  return data as InvoiceState;
}

/** The email of the PayPal account that paid the deposit, from the captured order. */
async function payerEmail(client: SupabaseClient, booking: Booking): Promise<string> {
  const { data, error } = await client
    .from("payments")
    .select("order_id")
    .eq("booking_id", booking.id)
    .eq("status", "captured")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load the captured payment: ${error.message}`);
  const orderId = (data?.order_id as string | null | undefined) ?? null;
  if (!orderId) throw new BookingError("invalid_state", "no captured deposit to take the payer from");

  const order = await getOrder(orderId);
  if (!order.payerEmail) {
    logger.error("[PAYPAL_INVOICE_NO_PAYER]", { bookingId: booking.id, orderId });
    throw new BookingError("invalid_state", "PayPal did not report the payer's email");
  }
  return order.payerEmail;
}

/** Creates the draft and claims it for the booking; a lost claim continues the stored invoice. */
async function createAndClaim(client: SupabaseClient, booking: Booking): Promise<InvoiceState> {
  const invoice = await createInvoice({
    idempotencyKey: booking.id,
    reference: booking.reference,
    recipientEmail: await payerEmail(client, booking),
    amountCents: booking.balanceCents,
    currency: "EUR",
    dueDate: booking.slotDate,
    itemName: `Resto de la reserva ${booking.reference} (demo)`,
  });
  const claim = await client
    .from("bookings")
    .update({ invoice_id: invoice.id, invoice_status: "draft" })
    .eq("id", booking.id)
    .is("invoice_id", null)
    .select("id");
  if (claim.error) throw new Error(`Failed to store the invoice: ${claim.error.message}`);
  if ((claim.data?.length ?? 0) > 0) return { invoice_id: invoice.id, invoice_status: "draft", invoice_url: null };

  const stored = await loadState(client, booking.id);
  if (stored.invoice_id !== invoice.id) {
    logger.error("[PAYPAL_INVOICE_DUPLICATE]", { bookingId: booking.id, kept: stored.invoice_id, orphan: invoice.id });
  }
  return stored;
}

/** Sends a draft. A refused send of an invoice that already left draft (an earlier send's answer was lost) counts as sent. */
async function sendDraft(client: SupabaseClient, booking: Booking, invoiceId: string): Promise<string | null> {
  let url: string | null;
  try {
    url = (await sendInvoice(invoiceId, booking.id)).recipientViewUrl;
  } catch (error) {
    const current = await getInvoice(invoiceId);
    if (current.status === "DRAFT") throw error;
    url = current.recipientViewUrl;
  }
  url ??= (await getInvoice(invoiceId)).recipientViewUrl;

  const { error } = await client
    .from("bookings")
    .update({ invoice_status: "sent", invoice_url: url })
    .eq("id", booking.id)
    .eq("invoice_status", "draft");
  if (error) throw new Error(`Failed to store the invoice: ${error.message}`);
  return url;
}

/** An existing invoice is never sent again; it is re-read so the answer reflects a payment made since. */
async function existingInvoice(client: SupabaseClient, booking: Booking, state: InvoiceState): Promise<BalanceInvoice> {
  const invoiceId = state.invoice_id as string;
  let status = state.invoice_status as BalanceInvoiceStatus;
  if (status !== "paid") {
    try {
      status = (await settleBalanceInvoice(client, invoiceId)) ?? status;
    } catch (error) {
      if (!(error instanceof PaypalError || error instanceof PaypalNotConfigured)) throw error;
      logger.warn("[PAYPAL_INVOICE_REFRESH_FAILED]", { bookingId: booking.id, invoiceId, error: error.message });
    }
  }
  return { invoiceId, status, url: state.invoice_url, created: false };
}

/**
 * Invoices the balance of a confirmed booking through PayPal, or returns the
 * invoice it already has. The caller has checked ownership.
 */
export async function sendBalanceInvoice(client: SupabaseClient, booking: Booking, now = new Date()): Promise<BalanceInvoice> {
  if (booking.status !== "confirmed") throw new BookingError("invalid_state", "only a confirmed booking has a balance to invoice");
  if (booking.balanceCents <= 0) throw new BookingError("invalid_state", "this booking has no balance to invoice");

  try {
    let state = await loadState(client, booking.id);
    if (state.invoice_id && state.invoice_status !== "draft") return await existingInvoice(client, booking, state);

    if (!state.invoice_id) {
      if (booking.slotDate < madridDate(now)) throw new BookingError("invalid_state", "the activity date has passed");
      state = await createAndClaim(client, booking);
      // A concurrent call won the claim and already sent it.
      if (state.invoice_status !== "draft") {
        return { invoiceId: state.invoice_id as string, status: state.invoice_status as BalanceInvoiceStatus, url: state.invoice_url, created: false };
      }
    }

    const invoiceId = state.invoice_id as string;
    const url = await sendDraft(client, booking, invoiceId);
    return { invoiceId, status: "sent", url, created: true };
  } catch (error) {
    if (error instanceof PaypalError || error instanceof PaypalNotConfigured) {
      logger.error("[PAYPAL_INVOICE_FAILED]", { bookingId: booking.id, error: error.message });
      // PayPal's message stays in the log; the model sees only the code.
      throw new BookingError("payment_unavailable");
    }
    throw error;
  }
}

/** Settled: PayPal says PAID, nothing is due, and exactly this booking's balance was paid in its currency. */
function isSettled(invoice: PaypalInvoice, balanceCents: number, currency: string): boolean {
  return (
    invoice.status === "PAID" &&
    invoice.dueAmountCents === 0 &&
    invoice.amountCents === balanceCents &&
    invoice.paidAmountCents === balanceCents &&
    invoice.currency === currency
  );
}

/**
 * Reads the invoice from PayPal and records what it says about the booking's
 * balance. Returns the booking's invoice status afterwards, or null when no
 * booking has this invoice. PayPal failures propagate (the webhook answers
 * 500 and PayPal redelivers).
 */
export async function settleBalanceInvoice(client: SupabaseClient, invoiceId: string): Promise<BalanceInvoiceStatus | null> {
  const { data: row, error } = await client
    .from("bookings")
    .select("id, status, total_cents, deposit_cents, currency, invoice_status, balance_paid_at")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load the invoiced booking: ${error.message}`);
  if (!row) return null;
  if (row.balance_paid_at) return "paid";

  const invoice = await getInvoice(invoiceId);
  const balanceCents = (row.total_cents as number) - (row.deposit_cents as number);

  if (isSettled(invoice, balanceCents, row.currency as string)) {
    const paid = await client
      .from("bookings")
      .update({ invoice_status: "paid", balance_paid_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("invoice_id", invoiceId)
      .is("balance_paid_at", null)
      .select("id");
    if (paid.error) throw new Error(`Failed to record the balance payment: ${paid.error.message}`);
    logger.info("[PAYPAL_INVOICE_PAID]", { bookingId: row.id, invoiceId });
    if (row.status !== "confirmed") {
      logger.warn("[PAYPAL_INVOICE_PAID_INACTIVE]", { bookingId: row.id, invoiceId, status: row.status });
    }
    return "paid";
  }

  if (invoice.status === "PAID") {
    logger.error("[PAYPAL_INVOICE_MISMATCH]", {
      bookingId: row.id,
      invoiceId,
      balanceCents,
      amountCents: invoice.amountCents,
      paidAmountCents: invoice.paidAmountCents,
      dueAmountCents: invoice.dueAmountCents,
      currency: invoice.currency,
    });
  }
  const current = row.invoice_status as BalanceInvoiceStatus;
  const next = IN_PROGRESS[invoice.status];
  if (!next || next === current) return current;

  const write = await client.from("bookings").update({ invoice_status: next }).eq("id", row.id).in("invoice_status", UNSETTLED);
  if (write.error) throw new Error(`Failed to record the invoice status: ${write.error.message}`);
  logger.warn("[PAYPAL_INVOICE_UNSETTLED]", { bookingId: row.id, invoiceId, invoiceStatus: invoice.status, dueAmountCents: invoice.dueAmountCents });
  return next;
}

/** Open at PayPal: cancelling the booking cancels these. */
const CANCELLABLE = ["draft", "sent", "payment_pending"];
/** Some of the balance has been paid: never refunded automatically. */
const MONEY_MOVED = ["paid", "partially_paid"];
/** A cancellation is complete once its booking reaches one of these. */
const CANCELLATION_COMPLETE = ["cancelled", "refunded"];
/** PayPal statuses of an invoice nobody can pay any more. */
const CANCELLED_AT_PAYPAL = ["CANCELLED", "AUTO_CANCELLED"];

export type InvoiceCancellationOutcome = "none" | "cancelled" | "flagged" | "awaiting_completion";

async function storeInvoiceStatus(query: PromiseLike<{ error: { message: string } | null }>): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(`Failed to store the invoice: ${error.message}`);
}

/**
 * Settles the balance invoice of a booking whose cancellation was confirmed:
 * an open invoice is cancelled at PayPal (a draft only here, it was never
 * sent); a balance with money paid is flagged for the operator once the
 * cancellation is complete. PayPal failures propagate.
 */
export async function closeInvoiceAfterCancellation(client: SupabaseClient, bookingId: string): Promise<InvoiceCancellationOutcome> {
  const { data: row, error } = await client
    .from("bookings")
    .select("id, status, cancellation_confirmed_at, invoice_id, invoice_status")
    .eq("id", bookingId)
    .single();
  if (error) throw new Error(`Failed to load the booking invoice: ${error.message}`);
  if (!row?.cancellation_confirmed_at || !row.invoice_id) return "none";
  const invoiceId = row.invoice_id as string;
  const status = row.invoice_status as BalanceInvoiceStatus;

  if (MONEY_MOVED.includes(status)) {
    if (!CANCELLATION_COMPLETE.includes(row.status as string)) return "awaiting_completion";
    if (!(await guardedUpdate(client, "bookings", bookingId, { status: "needs_attention" }, CANCELLATION_COMPLETE))) return "none";
    logger.error("[BOOKING_BALANCE_PAID_ON_CANCEL]", { bookingId, invoiceId, invoiceStatus: status });
    return "flagged";
  }
  if (!CANCELLABLE.includes(status)) return "none";

  if (status === "draft") {
    await storeInvoiceStatus(client.from("bookings").update({ invoice_status: "cancelled" }).eq("id", bookingId).eq("invoice_status", "draft"));
    return "cancelled";
  }

  try {
    await cancelInvoice(invoiceId);
  } catch (cancelError) {
    // No PayPal-Request-Id exists for cancel: what PayPal holds now decides.
    const current = await getInvoice(invoiceId);
    if (current.status === "PAID") {
      await settleBalanceInvoice(client, invoiceId);
      return closeInvoiceAfterCancellation(client, bookingId);
    }
    if (!CANCELLED_AT_PAYPAL.includes(current.status)) throw cancelError;
  }
  await storeInvoiceStatus(
    client.from("bookings").update({ invoice_status: "cancelled" }).eq("id", bookingId).in("invoice_status", ["sent", "payment_pending"])
  );
  logger.info("[PAYPAL_INVOICE_CANCELLED]", { bookingId, invoiceId });
  return "cancelled";
}

/** For the visitor's cancellation: never throws, so the invoice can never fail or block it. Reconciliation retries. */
export async function closeInvoiceAfterCancellationSafely(
  client: SupabaseClient,
  bookingId: string
): Promise<InvoiceCancellationOutcome | "failed"> {
  try {
    return await closeInvoiceAfterCancellation(client, bookingId);
  } catch (error) {
    logger.error("[PAYPAL_INVOICE_CANCEL_FAILED]", { bookingId, error: error instanceof Error ? error.message : String(error) });
    return "failed";
  }
}

/**
 * INVOICING.INVOICE.CANCELLED: records an open invoice cancelled and nothing
 * else. Returns the invoice status afterwards, or null when no booking has it.
 */
export async function markInvoiceCancelled(client: SupabaseClient, invoiceId: string): Promise<BalanceInvoiceStatus | null> {
  const write = await client
    .from("bookings")
    .update({ invoice_status: "cancelled" })
    .eq("invoice_id", invoiceId)
    .in("invoice_status", CANCELLABLE)
    .select("id");
  if (write.error) throw new Error(`Failed to store the invoice: ${write.error.message}`);
  if (write.data?.length) return "cancelled";

  const { data, error } = await client.from("bookings").select("invoice_status").eq("invoice_id", invoiceId).maybeSingle();
  if (error) throw new Error(`Failed to load the invoiced booking: ${error.message}`);
  return (data?.invoice_status as BalanceInvoiceStatus | undefined) ?? null;
}
