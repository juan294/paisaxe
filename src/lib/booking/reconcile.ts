/**
 * Booking reconciliation (PayPal hackathon plan, Phase 4, unit [webhook-cron]):
 * resolves every uncertain payment with nobody present. Run every 5 minutes
 * by /api/cron/reconcile-bookings, under a lease.
 *
 *   1. expire_holds(); abandon drafts idle for a day
 *   2. replay inbox events left unprocessed for 2 minutes (R2-04)
 *   3. created|approved payments -> the capture path: confirms approved
 *      orders; an order still awaiting approval after its hold died expires
 *   4. capture_pending payments -> the capture path; only PayPal's
 *      authoritative answer ends the state. Every inconclusive pass is counted;
 *      from the third the booking needs attention, and the payment stays
 *      capture_pending and keeps being reconciled every run (R2-02)
 *   5. captured payments whose booking is not confirmed -> finalizeCaptured
 *   6. refund_pending payments -> request the refund with the payment's fixed
 *      key if it has no refund id yet, else follow it to refunded or refund_failed
 *   7. confirmed cancellations (Phase 5) whose refund was never created -> request it
 *   8. needs_attention bookings older than 15 minutes -> [CRON_RECONCILE_ATTENTION]
 *
 * Only the shared capture path captures, and only buyer-approved orders.
 * PayPal unreachable aborts the run and leaves every state as it was (the route
 * answers 500). Any other failure is per item: logged, counted, retried next run.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { PaypalError, PaypalNotConfigured, getRefund, refundCapture } from "@/lib/paypal";
import { captureApprovedOrder, finalizeCaptured, type CaptureOutcome } from "./capture";
import { abandonStaleDrafts } from "./drafts";
import { flagNeedsAttention, guardedUpdate, holdIsLive, markBookingRefunded, type Row } from "./payment-state";
import { PaypalWebhookUnmatched, UNMATCHED_TAG, processAndRecordPaypalEvent, type PaypalInboxEvent } from "./webhook-events";


export interface ReconcileOptions {
  /**
   * Restricts steps 2 to 8 to these bookings, for replaying specific bookings
   * by hand and for tests that share a database. The cron passes nothing.
   */
  bookingIds?: readonly string[];
}

export interface ReconcileSummary {
  expiredHolds: number;
  abandonedDrafts: number;
  eventsReplayed: number;
  eventsUnmatched: number;
  confirmed: number;
  expired: number;
  stillPending: number;
  flaggedForAttention: number;
  refundsRequested: number;
  refunded: number;
  refundFailed: number;
  staleAttention: number;
  errors: number;
}

interface Run {
  client: SupabaseClient;
  scope: string[] | null;
  summary: ReconcileSummary;
}

/** Inconclusive capture_pending passes before the booking needs an operator (R2-02). */
const ATTENTION_PASSES = 3;
const BATCH = 50;
const INBOX_GRACE_MS = 2 * 60_000;
const STALE_ATTENTION_MS = 15 * 60_000;
/** Booking statuses a captured payment can still be confirmed or compensated from. */
const UNFINALIZED = ["pending_payment", "needs_attention", "expired"];
/** Booking statuses a failed refund flags (never a booking confirmed by another payment). */
const REFUND_FAILED_FLAGS = ["pending_payment", "needs_attention", "expired", "cancel_pending", "refund_pending"];

/** No answer from PayPal at all: the run stops instead of waiting on every item. */
function paypalUnreachable(error: unknown): boolean {
  if (error instanceof PaypalNotConfigured) return true;
  return error instanceof PaypalError && (error.status === null || error.status >= 500);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Runs `work` per row; an unreachable PayPal aborts the run, anything else is counted. */
async function eachItem(run: Run, step: string, rows: Row[], work: (row: Row) => Promise<void>): Promise<void> {
  for (const row of rows) {
    try {
      await work(row);
    } catch (error) {
      if (paypalUnreachable(error)) throw error;
      run.summary.errors++;
      logger.error("[CRON_RECONCILE_ITEM_FAILED]", { step, bookingId: row.booking_id, paymentId: row.id, error: message(error) });
    }
  }
}

function count(run: Run, outcome: CaptureOutcome): void {
  if (outcome === "confirmed") run.summary.confirmed++;
  if (outcome === "slot_gone") run.summary.expired++;
}

/** Payments in `statuses`, each with its booking under `bookings`; `bookingFilter` narrows by booking. */
async function payments(
  run: Run,
  statuses: string[],
  bookingFilter: (query: ReturnType<typeof paymentsQuery>) => ReturnType<typeof paymentsQuery> = (query) => query
): Promise<Row[]> {
  let query = bookingFilter(paymentsQuery(run.client).in("status", statuses));
  if (run.scope) query = query.in("booking_id", run.scope);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load ${statuses.join("|")} payments: ${error.message}`);
  return data ?? [];
}

function paymentsQuery(client: SupabaseClient) {
  return client.from("payments").select("*, bookings!inner(*)").order("created_at", { ascending: true }).limit(BATCH);
}

/** The payment row without its embedded booking, as the capture functions take it. */
function paymentOf(row: Row): Row {
  const payment = { ...row };
  delete payment.bookings;
  return payment;
}

async function holdOf(client: SupabaseClient, holdId: unknown): Promise<Row> {
  const { data, error } = await client.from("holds").select("expires_at, consumed_at, released_at").eq("id", holdId).single();
  if (error) throw new Error(`Failed to load hold: ${error.message}`);
  return data;
}

// Step 1
async function expireAndAbandon(run: Run): Promise<void> {
  const { data, error } = await run.client.rpc("expire_holds");
  if (error) throw new Error(`expire_holds failed: ${error.message}`);
  run.summary.expiredHolds = typeof data === "number" ? data : 0;
  run.summary.abandonedDrafts = await abandonStaleDrafts(run.client);
}

// Step 2
async function drainInbox(run: Run): Promise<void> {
  const cutoff = new Date(Date.now() - INBOX_GRACE_MS).toISOString();
  let query = run.client
    .from("paypal_webhook_events")
    .select("event_id, event_type, payload, order_id, capture_id, refund_id, custom_id")
    .is("processed_at", null)
    .lt("received_at", cutoff)
    // An unmatched event cannot become matchable (payments exist before their
    // orders); it stays in the inbox for audit but never blocks the batch.
    .or(`last_error.is.null,last_error.not.like.${UNMATCHED_TAG}*`)
    .order("received_at", { ascending: true })
    .limit(BATCH);
  if (run.scope) query = query.in("custom_id", run.scope);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load unprocessed PayPal events: ${error.message}`);

  for (const event of (data ?? []) as PaypalInboxEvent[]) {
    try {
      await processAndRecordPaypalEvent(run.client, event);
      run.summary.eventsReplayed++;
    } catch (error) {
      if (paypalUnreachable(error)) throw error;
      if (error instanceof PaypalWebhookUnmatched) {
        run.summary.eventsUnmatched++;
        continue;
      }
      run.summary.errors++;
      logger.error("[CRON_RECONCILE_ITEM_FAILED]", { step: "inbox", eventId: event.event_id, error: message(error) });
    }
  }
}

// Step 3
async function captureOpenOrders(run: Run): Promise<void> {
  const rows = await payments(run, ["created", "approved"], (query) => query.eq("bookings.status", "pending_payment"));
  await eachItem(run, "open_orders", rows, async (row) => {
    const booking = row.bookings as Row;
    const outcome = await captureApprovedOrder(run.client, booking.id as string, "reconcile");
    count(run, outcome);
    if (outcome !== "awaiting_approval" || holdIsLive(await holdOf(run.client, booking.hold_id))) return;
    // Nothing was captured and the buyer can no longer pay inside the hold.
    if (await guardedUpdate(run.client, "payments", row.id, { status: "expired" }, ["created", "approved"])) {
      await guardedUpdate(run.client, "bookings", booking.id, { status: "expired" }, ["pending_payment"]);
      run.summary.expired++;
    }
  });
}

/** Counts an inconclusive pass; from the threshold on, the booking needs attention (R2-02). */
async function recordInconclusivePass(run: Run, row: Row): Promise<void> {
  run.summary.stillPending++;
  const passes = Number(row.reconcile_passes) + 1;
  const { data, error } = await run.client
    .from("payments")
    .update({ reconcile_passes: passes })
    .eq("id", row.id)
    .eq("status", "capture_pending")
    .eq("reconcile_passes", row.reconcile_passes)
    .select("id");
  if (error) throw new Error(`Failed to count reconcile pass: ${error.message}`);
  if (!data?.length || passes < ATTENTION_PASSES) return;

  const flagged = await flagNeedsAttention(run.client, row.booking_id);
  if (flagged || passes === ATTENTION_PASSES) {
    run.summary.flaggedForAttention++;
    logger.error("[CRON_RECONCILE_ATTENTION]", { bookingId: row.booking_id, paymentId: row.id, passes, reason: "capture_unconfirmed" });
  }
}

// Step 4
async function followPendingCaptures(run: Run): Promise<void> {
  const rows = await payments(run, ["capture_pending"]);
  await eachItem(run, "capture_pending", rows, async (row) => {
    const outcome = await captureApprovedOrder(run.client, row.booking_id as string, "reconcile");
    if (outcome === "pending" || outcome === "awaiting_approval") return recordInconclusivePass(run, row);
    count(run, outcome);
  });
}

// Step 5
async function finalizeCapturedPayments(run: Run): Promise<void> {
  const rows = await payments(run, ["captured"], (query) => query.not("capture_id", "is", null).in("bookings.status", UNFINALIZED));
  await eachItem(run, "captured", rows, async (row) => {
    count(run, await finalizeCaptured(run.client, row.bookings as Row, paymentOf(row)));
  });
}

/** Moves a refund_pending payment, and its booking, to PayPal's final refund status. */
async function applyRefundStatus(run: Run, payment: Row, booking: Row, status: string): Promise<void> {
  if (status === "COMPLETED") {
    if (!(await guardedUpdate(run.client, "payments", payment.id, { status: "refunded", refunded_at: new Date().toISOString() }, ["refund_pending"]))) return;
    run.summary.refunded++;
    await markBookingRefunded(run.client, payment, booking.id);
  } else if (status === "FAILED" || status === "CANCELLED") {
    if (!(await guardedUpdate(run.client, "payments", payment.id, { status: "refund_failed" }, ["refund_pending"]))) return;
    run.summary.refundFailed++;
    await flagNeedsAttention(run.client, booking.id, REFUND_FAILED_FLAGS);
    logger.error("[PAYPAL_REFUND_FAILED]", { bookingId: booking.id, paymentId: payment.id, refundStatus: status });
  }
}

/** Requests the refund with "refund:" + the payment's operation key: a retry never refunds twice. */
async function requestRefund(run: Run, payment: Row, amountCents: unknown): Promise<{ id: string; status: string }> {
  if (typeof amountCents !== "number" || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new Error(`No refund amount for payment ${payment.id}`);
  }
  const refund = await refundCapture(payment.capture_id as string, amountCents, payment.operation_key as string);
  run.summary.refundsRequested++;
  return refund;
}

// Step 6
async function followRefunds(run: Run): Promise<void> {
  const rows = await payments(run, ["refund_pending"]);
  await eachItem(run, "refund_pending", rows, async (row) => {
    const payment = paymentOf(row);
    const booking = row.bookings as Row;
    if (payment.refund_id) {
      const refund = await getRefund(payment.refund_id as string);
      return applyRefundStatus(run, payment, booking, refund.status);
    }
    // A compensation refunds the whole capture; a cancellation refunds what Phase 5 computed.
    const amount = payment.compensation_reason ? payment.amount_cents : booking.refund_cents;
    const refund = await requestRefund(run, payment, amount);
    await guardedUpdate(run.client, "payments", payment.id, { refund_id: refund.id }, ["refund_pending"]);
    await applyRefundStatus(run, payment, booking, refund.status);
  });
}

// Step 7
async function retryConfirmedCancellations(run: Run): Promise<void> {
  const rows = await payments(run, ["captured"], (query) =>
    query
      .is("refund_id", null)
      .eq("bookings.status", "cancel_pending")
      .not("bookings.cancellation_confirmed_at", "is", null)
      .gt("bookings.refund_cents", 0)
  );
  await eachItem(run, "cancel_pending", rows, async (row) => {
    const payment = paymentOf(row);
    const booking = row.bookings as Row;
    const refund = await requestRefund(run, payment, booking.refund_cents);
    if (!(await guardedUpdate(run.client, "payments", payment.id, { status: "refund_pending", refund_id: refund.id }, ["captured"]))) return;
    await guardedUpdate(run.client, "bookings", booking.id, { status: "refund_pending" }, ["cancel_pending"]);
    await applyRefundStatus(run, payment, booking, refund.status);
  });
}

// Step 8
async function reportStaleAttention(run: Run): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_ATTENTION_MS).toISOString();
  let query = run.client
    .from("bookings")
    .select("id", { count: "exact" })
    .eq("status", "needs_attention")
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(20);
  if (run.scope) query = query.in("id", run.scope);
  const { data, count: staleCount, error } = await query;
  if (error) throw new Error(`Failed to load needs_attention bookings: ${error.message}`);
  run.summary.staleAttention = staleCount ?? 0;
  if (run.summary.staleAttention > 0) {
    logger.error("[CRON_RECONCILE_ATTENTION]", { staleCount: run.summary.staleAttention, bookingIds: (data ?? []).map((row) => row.id) });
  }
}

export async function reconcileBookings(client: SupabaseClient, options: ReconcileOptions = {}): Promise<ReconcileSummary> {
  const run: Run = {
    client,
    scope: options.bookingIds ? [...options.bookingIds] : null,
    summary: {
      expiredHolds: 0,
      abandonedDrafts: 0,
      eventsReplayed: 0,
      eventsUnmatched: 0,
      confirmed: 0,
      expired: 0,
      stillPending: 0,
      flaggedForAttention: 0,
      refundsRequested: 0,
      refunded: 0,
      refundFailed: 0,
      staleAttention: 0,
      errors: 0,
    },
  };

  await expireAndAbandon(run);
  await drainInbox(run);
  await captureOpenOrders(run);
  await followPendingCaptures(run);
  await finalizeCapturedPayments(run);
  await followRefunds(run);
  await retryConfirmedCancellations(run);
  await reportStaleAttention(run);
  return run.summary;
}
