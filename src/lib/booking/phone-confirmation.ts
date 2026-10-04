/**
 * Phone confirmation (PayPal hackathon plan, Phase 8b, decision R7:
 * authorize, then capture or void).
 *
 * For a merchant in confirmation_mode 'phone' (migration 126):
 *
 *   buyer approves  -> settleApprovedPhoneOrder AUTHORIZES the deposit (never
 *                      the capture path's captureOrder) and places one call
 *                      through the existing voice-booking path: the
 *                      booking_system flag, the daily call cap, a
 *                      pending_bookings claim and the ElevenLabs booking agent,
 *                      dialling only PHONE_CONFIRMATION_TEST_NUMBER
 *   call outcome    -> the ElevenLabs webhook records it on pending_bookings;
 *                      settlePhonePayment reads that RECORDED outcome:
 *                        confirmed                         -> capture the authorization
 *                        denied | no_answer | failed |
 *                        orphaned                          -> void it
 *                        still ringing, after the 3-day
 *                        honor period                      -> void it
 *
 * Payment states, every move a guarded UPDATE (payment-state.ts):
 *
 *   created -> approved -> authorized -> capture_pending -> captured -> (booking confirmed)
 *                                    \-> void_pending -> voided | expired
 *
 * A capture and a void both start by claiming 'authorized', so only one of
 * them reaches PayPal. The database refuses the capture claim unless the call
 * is recorded as confirmed (trigger payments_require_recorded_confirmation),
 * so there is no capture without a recorded confirmation even if this code is
 * wrong. Every PayPal request carries the payment's operation key, so a retry
 * never authorizes, captures or voids twice.
 *
 * The webhook (settlePhoneConfirmationCall) is the fast path; reconciliation
 * (reconcilePhoneAuthorizations, every 5 minutes) settles whatever it missed,
 * places a call that was never placed, and voids authorizations left without
 * an outcome past the honor period. Capture-pending payments go through the
 * capture path's step 4, which dispatches here.
 *
 * Finalization uses consume_hold_and_confirm directly; when it fails, the
 * payment is left 'captured' and reconciliation's finalize step confirms or
 * compensates it. (This module does not import capture.ts, which imports it.)
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { money } from "@/lib/booking-format";
import { logger } from "@/lib/logger";
import {
  PaypalError,
  authorizeOrder,
  captureAuthorization,
  getAuthorization,
  getOrder,
  voidAuthorization,
  type PaypalAuthorization,
  type PaypalCapture,
  type PaypalOrder,
} from "@/lib/paypal";
import {
  claimDailyBookingCallSlot,
  claimPendingBooking,
  markPendingBookingFailed,
  persistBookingConversationId,
} from "@/lib/services/booking-service";
import { initiateCall } from "@/lib/services/elevenlabs-call-service";
import type { CaptureOutcome } from "@/types/booking-page";
import { COMPENSATING, flagNeedsAttention, guardedUpdate, holdIsLive, type Row } from "./payment-state";
import { PHONE_CONFIRMATION_KEY_PREFIX, phoneConfirmationReadiness } from "./phone-config";

/** Capture is guaranteed only within 3 days of the authorization (Phase 0 evidence). */
const HONOR_PERIOD_MS = 3 * 86_400_000;
/** A PayPal authorization is valid for 29 days. */
const AUTHORIZATION_VALIDITY_MS = 29 * 86_400_000;
/** Recorded call outcomes (pending_bookings.status) that void the authorization. */
const VOID_OUTCOMES = new Set(["denied", "no_answer", "failed", "orphaned"]);
/** Authorization statuses after which it will never be captured. */
const NEVER_CAPTURED = new Set(["VOIDED", "EXPIRED", "DENIED"]);
const OPEN_AUTHORIZATIONS = ["authorized", "void_pending"];
const BATCH = 50;

export type PhoneSettlement =
  /** Captured and the booking confirmed. */
  | "confirmed"
  /** Captured; confirmation left to reconciliation's finalize step. */
  | "captured"
  | "capture_pending"
  | "capture_failed"
  /** Voided (or expired at PayPal): nothing charged, slot freed. */
  | "voided"
  | "void_pending"
  /** No recorded outcome yet. */
  | "waiting"
  /** Captured outside this flow: refund intent recorded. */
  | "compensating"
  /** Not this flow's state, or another caller got there first. */
  | "unchanged";

export type CallResult = "placed" | "already_placed" | "timed_out" | "not_configured" | "booking_disabled" | "daily_cap" | "failed";

/** Call results that end the confirmation before it starts: the authorization is voided. */
const CALL_VOID_REASON: Partial<Record<CallResult, string>> = {
  not_configured: "not_configured",
  booking_disabled: "not_configured",
  daily_cap: "call_failed",
  failed: "call_failed",
};

const SETTLEMENT_OUTCOME: Record<PhoneSettlement, CaptureOutcome> = {
  confirmed: "confirmed",
  captured: "pending",
  capture_pending: "pending",
  capture_failed: "failed",
  voided: "slot_gone",
  void_pending: "pending",
  waiting: "pending",
  compensating: "compensating",
  unchanged: "pending",
};

const nowIso = () => new Date().toISOString();

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Amount, currency and custom_id of the order must be this booking's deposit. */
function matchesDeposit(order: PaypalOrder, booking: Row): boolean {
  return order.amountCents === booking.deposit_cents && order.currency === booking.currency && order.customId === booking.id;
}

/** "2026-11-21" as the agent reads it: "21 de noviembre". */
function spanishDate(isoDate: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** The call's outcome as the ElevenLabs webhook recorded it, or null without a call row. */
async function recordedOutcome(client: SupabaseClient, callId: unknown): Promise<string | null> {
  if (!callId) return null;
  const { data, error } = await client.from("pending_bookings").select("status").eq("id", callId).maybeSingle();
  if (error) throw new Error(`Failed to read the confirmation call: ${error.message}`);
  return (data?.status as string | undefined) ?? null;
}

async function linkCall(client: SupabaseClient, paymentId: unknown, callId: string): Promise<void> {
  const { error } = await client.from("payments").update({ phone_call_id: callId }).eq("id", paymentId).is("phone_call_id", null);
  if (error) throw new Error(`Failed to link the confirmation call: ${error.message}`);
}

/**
 * Places the confirmation call through the existing voice-booking services,
 * once per payment: the claim key is the payment id, and a linked payment is
 * never called again.
 */
export async function placeConfirmationCall(client: SupabaseClient, booking: Row, payment: Row): Promise<CallResult> {
  if (payment.phone_call_id) return "already_placed";

  const readiness = await phoneConfirmationReadiness();
  if (!readiness.ready) {
    logger.warn("[PHONE_CONFIRMATION_NOT_CONFIGURED]", { bookingId: booking.id, reason: readiness.reason });
    return readiness.reason;
  }
  const phone = readiness.phone;
  const { data: experience } = await client.from("experiences").select("title").eq("id", booking.experience_id).maybeSingle();
  const title = (experience?.title as string | undefined) ?? "Experiencia Paisaxe";

  // The voice-booking path's global daily cap (migration 105) bounds these calls too.
  if (!(await claimDailyBookingCallSlot())) {
    logger.error("[PHONE_CONFIRMATION_DAILY_CAP_REACHED]", { bookingId: booking.id });
    return "daily_cap";
  }

  const idempotencyKey = `${PHONE_CONFIRMATION_KEY_PREFIX}${payment.id}`;
  const customerName = `Paisaxe ${booking.reference}`;
  const time = String(booking.slot_time).slice(0, 5);
  const specialRequests = `${title}. Señal de ${money(booking.deposit_cents as number, "EUR", "es")} autorizada en PayPal; solo se cobra si confirman.`;
  const claim = await claimPendingBooking({
    idempotencyKey,
    venueName: title,
    venuePhone: phone,
    customerName,
    customerPhone: phone,
    partySize: booking.party_size as number,
    bookingDate: booking.slot_date as string,
    bookingTime: time,
    specialRequests,
  });

  if (claim.kind === "persistence_failed") throw new Error("Could not record the confirmation call");
  if (claim.kind === "duplicate") {
    // Claimed before a crash: link it, but never dial twice. The call row's own
    // outcome (or the stale-bookings cron's 'orphaned') settles the payment.
    const { data: existing } = await client.from("pending_bookings").select("id").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing?.id) await linkCall(client, payment.id, existing.id as string);
    return "already_placed";
  }

  const callId = claim.pendingRowId;
  // Linked before dialling, so the webhook can always find the payment.
  await linkCall(client, payment.id, callId);

  const result = await initiateCall(phone, {
    customer_name: customerName,
    customer_phone: phone,
    party_size: booking.party_size as number,
    date: spanishDate(booking.slot_date as string),
    time,
    special_requests: specialRequests,
    booking_id: callId,
  });

  if (result.success) {
    const conversationId = result.conversationId || result.callSid;
    if (!conversationId) {
      await markPendingBookingFailed(callId, idempotencyKey, "Call initiation failed: ElevenLabs response missing conversation_id or callSid.");
      return "failed";
    }
    if (!(await persistBookingConversationId(callId, conversationId, idempotencyKey))) {
      // The webhook still finds the row through the booking_id dynamic variable.
      logger.warn("[PHONE_CONFIRMATION_CALL_UNTRACKED]", { bookingId: booking.id, callId });
    }
    logger.info("[PHONE_CONFIRMATION_CALL_PLACED]", { bookingId: booking.id, paymentId: payment.id, callId });
    return "placed";
  }
  if (result.timedOut) {
    // Unknown whether ElevenLabs dialled: the webhook or the stale-bookings cron resolves the row.
    logger.warn("[PHONE_CONFIRMATION_CALL_TIMED_OUT]", { bookingId: booking.id, callId });
    return "timed_out";
  }
  await markPendingBookingFailed(callId, idempotencyKey, `Call initiation failed: ${result.error ?? "unknown error"}`);
  return "failed";
}

/** Places the call; when it cannot be placed at all, voids the authorization. */
async function callOrVoid(client: SupabaseClient, booking: Row, payment: Row): Promise<PhoneSettlement> {
  const reason = CALL_VOID_REASON[await placeConfirmationCall(client, booking, payment)];
  return reason ? voidPhonePayment(client, booking, payment, reason) : "waiting";
}

/** A voided or expired authorization: nothing charged, the booking expires and its slot is freed. */
async function closeVoided(client: SupabaseClient, booking: Row, payment: Row, fields: Row): Promise<PhoneSettlement> {
  await guardedUpdate(client, "payments", payment.id, fields, ["void_pending"]);
  await guardedUpdate(client, "bookings", booking.id, { status: "expired" }, ["pending_payment", "needs_attention"]);
  const { error } = await client
    .from("holds")
    .update({ released_at: nowIso() })
    .eq("id", booking.hold_id)
    .is("consumed_at", null)
    .is("released_at", null);
  if (error) throw new Error(`Failed to release the hold: ${error.message}`);
  logger.info("[PHONE_CONFIRMATION_VOIDED]", { bookingId: booking.id, paymentId: payment.id, reason: payment.confirmation_outcome, status: fields.status });
  return "voided";
}

/**
 * The authorization was captured, but not through a recorded confirmation (for
 * example from the PayPal dashboard). Money moved (R2-01): record the capture
 * and the refund intent in one write; reconciliation's refund step refunds it.
 */
async function compensateUnconfirmedCapture(client: SupabaseClient, booking: Row, payment: Row): Promise<PhoneSettlement> {
  const order = await getOrder(payment.order_id as string);
  if (!order.capture) return "void_pending";
  await guardedUpdate(
    client,
    "payments",
    payment.id,
    { status: "refund_pending", capture_id: order.capture.id, compensation_reason: "unconfirmed_capture" },
    ["void_pending"]
  );
  await flagNeedsAttention(client, booking.id, ["pending_payment", "expired", "needs_attention"]);
  logger.error("[PAYPAL_COMPENSATING]", { bookingId: booking.id, paymentId: payment.id, reason: "unconfirmed_capture" });
  return "compensating";
}

/**
 * Claims the void (authorized -> void_pending, recording why), then voids at
 * PayPal. A refusal (422) is resolved by reading the authorization; no answer
 * leaves void_pending for reconciliation, which retries with the same key.
 */
async function voidPhonePayment(client: SupabaseClient, booking: Row, payment: Row, reason: string | null): Promise<PhoneSettlement> {
  let claimed = payment;
  if (payment.status !== "void_pending") {
    if (!(await guardedUpdate(client, "payments", payment.id, { status: "void_pending", confirmation_outcome: reason }, ["authorized"]))) {
      return "unchanged";
    }
    claimed = { ...payment, status: "void_pending", confirmation_outcome: reason };
  }

  let authorization: PaypalAuthorization;
  try {
    authorization = await voidAuthorization(payment.authorization_id as string, payment.operation_key as string);
  } catch (error) {
    if (!(error instanceof PaypalError)) throw error;
    if (error.status !== 422) {
      logger.warn("[PAYPAL_VOID_PENDING]", { bookingId: booking.id, paymentId: payment.id, error: error.message });
      return "void_pending";
    }
    authorization = await getAuthorization(payment.authorization_id as string);
  }

  if (authorization.status === "VOIDED") return closeVoided(client, booking, claimed, { status: "voided", voided_at: nowIso() });
  if (authorization.status === "EXPIRED") return closeVoided(client, booking, claimed, { status: "expired" });
  if (authorization.status === "CAPTURED") return compensateUnconfirmedCapture(client, booking, claimed);
  return "void_pending";
}

/** Records PayPal's answer to a capture of the authorization (claimed capture_pending). */
async function settleAuthorizationCapture(client: SupabaseClient, booking: Row, payment: Row, capture: PaypalCapture): Promise<PhoneSettlement> {
  if (capture.status === "COMPLETED") {
    // Persisted before anything else: money moved (R2-01).
    await guardedUpdate(client, "payments", payment.id, { status: "captured", capture_id: capture.id, captured_at: nowIso() }, ["capture_pending"]);
    const { error } = await client.rpc("consume_hold_and_confirm", { p_booking_id: booking.id, p_capture_id: capture.id });
    if (error) {
      logger.warn("[PHONE_CONFIRMATION_FINALIZE_DEFERRED]", { bookingId: booking.id, paymentId: payment.id, error: error.message });
      return "captured";
    }
    logger.info("[PHONE_CONFIRMATION_CAPTURED]", { bookingId: booking.id, paymentId: payment.id, captureId: capture.id });
    return "confirmed";
  }
  if (capture.status === "DECLINED" || capture.status === "FAILED") {
    await guardedUpdate(client, "payments", payment.id, { status: "capture_failed", capture_id: capture.id }, ["capture_pending"]);
    await flagNeedsAttention(client, booking.id);
    logger.error("[PAYPAL_CAPTURE_DENIED]", { bookingId: booking.id, paymentId: payment.id, phone: true });
    return "capture_failed";
  }
  await guardedUpdate(client, "payments", payment.id, { capture_id: capture.id }, ["capture_pending"]);
  return "capture_pending";
}

async function tryCapture(client: SupabaseClient, booking: Row, payment: Row): Promise<PhoneSettlement> {
  let capture: PaypalCapture;
  try {
    capture = await captureAuthorization(payment.authorization_id as string, payment.amount_cents as number, payment.operation_key as string);
  } catch (error) {
    // Timeout or a non-definitive reply: unknown until PayPal says (R2-02).
    logger.warn("[PAYPAL_CAPTURE_PENDING]", { bookingId: booking.id, paymentId: payment.id, phone: true, error: message(error) });
    return "capture_pending";
  }
  return settleAuthorizationCapture(client, booking, payment, capture);
}

/** The merchant said yes: take the slot, claim the capture (the database checks the recorded confirmation), capture once. */
async function captureConfirmed(client: SupabaseClient, booking: Row, payment: Row): Promise<PhoneSettlement> {
  // The slot first, so a capture is never taken for a slot that is gone.
  const { data: reacquired, error } = await client.rpc("reacquire_hold", { p_booking_id: booking.id });
  if (error) throw new Error(`Failed to re-acquire hold: ${error.message}`);
  if (!reacquired) return voidPhonePayment(client, booking, payment, "slot_gone");

  const claim = { status: "capture_pending", confirmation_outcome: "confirmed" };
  if (!(await guardedUpdate(client, "payments", payment.id, claim, ["authorized"]))) return "unchanged";
  return tryCapture(client, booking, { ...payment, ...claim });
}

/** capture_pending: only PayPal's answer ends it; a retry reuses the same key, so never a second capture. */
async function resolveAuthorizationCapture(client: SupabaseClient, booking: Row, payment: Row): Promise<PhoneSettlement> {
  const order = await getOrder(payment.order_id as string);
  if (order.capture) return settleAuthorizationCapture(client, booking, payment, order.capture);

  const authorization = await getAuthorization(payment.authorization_id as string);
  if (NEVER_CAPTURED.has(authorization.status)) {
    await guardedUpdate(client, "payments", payment.id, { status: "capture_failed" }, ["capture_pending"]);
    await flagNeedsAttention(client, booking.id);
    logger.error("[PHONE_CONFIRMATION_CAPTURE_FAILED]", { bookingId: booking.id, paymentId: payment.id, authorizationStatus: authorization.status });
    return "capture_failed";
  }
  if (authorization.status !== "CREATED") return "capture_pending";

  // The claim passed the database's check; check again before asking PayPal.
  if ((await recordedOutcome(client, payment.phone_call_id)) !== "confirmed") {
    logger.error("[PHONE_CONFIRMATION_UNCONFIRMED_CAPTURE_PENDING]", { bookingId: booking.id, paymentId: payment.id });
    return "capture_pending";
  }
  return tryCapture(client, booking, payment);
}

/**
 * Settles an authorization from its recorded call outcome. Captures only on a
 * recorded 'confirmed'; voids on any other final outcome, when the call cannot
 * be placed, or when no outcome arrived within the honor period.
 */
export async function settlePhonePayment(client: SupabaseClient, booking: Row, payment: Row): Promise<PhoneSettlement> {
  if (payment.status === "void_pending") return voidPhonePayment(client, booking, payment, null);
  if (payment.status === "capture_pending" && payment.authorization_id) return resolveAuthorizationCapture(client, booking, payment);
  if (payment.status !== "authorized") return "unchanged";

  const outcome = await recordedOutcome(client, payment.phone_call_id);
  if (outcome === "confirmed") return captureConfirmed(client, booking, payment);
  if (outcome && VOID_OUTCOMES.has(outcome)) return voidPhonePayment(client, booking, payment, outcome);
  if (Date.parse(payment.authorized_at as string) + HONOR_PERIOD_MS <= Date.now()) {
    return voidPhonePayment(client, booking, payment, "honor_period_elapsed");
  }
  if (!payment.phone_call_id) return callOrVoid(client, booking, payment);
  return "waiting";
}

/** Records an authorization PayPal granted, then places the call (or voids when the order does not match). */
async function recordAuthorization(client: SupabaseClient, booking: Row, payment: Row, order: PaypalOrder): Promise<CaptureOutcome> {
  const authorization = order.authorization as PaypalAuthorization;
  if (authorization.status === "DENIED") {
    await guardedUpdate(client, "payments", payment.id, { status: "capture_failed", authorization_id: authorization.id }, ["created", "approved"]);
    await flagNeedsAttention(client, booking.id);
    return "failed";
  }

  const authorizedAt = nowIso();
  const fields = {
    status: "authorized",
    authorization_id: authorization.id,
    authorized_at: authorizedAt,
    authorization_expires_at: authorization.expiresAt ?? new Date(Date.parse(authorizedAt) + AUTHORIZATION_VALIDITY_MS).toISOString(),
  };
  // A concurrent caller that recorded it first also places the call.
  if (!(await guardedUpdate(client, "payments", payment.id, fields, ["created", "approved"]))) return "pending";
  const authorized = { ...payment, ...fields };
  logger.info("[PHONE_CONFIRMATION_AUTHORIZED]", { bookingId: booking.id, paymentId: payment.id, authorizationId: authorization.id });

  if (!matchesDeposit(order, booking)) {
    logger.error("[PAYPAL_CAPTURE_MISMATCH]", { bookingId: booking.id, orderId: order.id, phone: true, captured: false });
    return SETTLEMENT_OUTCOME[await voidPhonePayment(client, booking, authorized, "order_mismatch")];
  }
  return SETTLEMENT_OUTCOME[await callOrVoid(client, booking, authorized)];
}

/** Nothing authorized, nothing charged: the payment and its booking expire (the order lapses at PayPal). */
async function expireUnauthorized(client: SupabaseClient, booking: Row, payment: Row, fields: Row = {}): Promise<CaptureOutcome> {
  if (await guardedUpdate(client, "payments", payment.id, { status: "expired", ...fields }, ["created", "approved"])) {
    await guardedUpdate(client, "bookings", booking.id, { status: "expired" }, ["pending_payment"]);
  }
  return "slot_gone";
}

/**
 * The capture path's branch for a phone-confirmed merchant (captureApprovedOrder
 * dispatches here for the return page, the approval webhook and
 * reconciliation). An approved order is AUTHORIZED, never captured.
 */
export async function settleApprovedPhoneOrder(
  client: SupabaseClient,
  state: { booking: Row; payment: Row; hold: Row },
  source: string
): Promise<CaptureOutcome> {
  const { booking, payment, hold } = state;
  const status = payment.status as string;

  if (COMPENSATING.includes(status)) return "compensating";
  if (status === "voided" || status === "expired") return "slot_gone";
  if (status === "capture_failed") return "failed";
  if (status !== "created" && status !== "approved") {
    return SETTLEMENT_OUTCOME[await settlePhonePayment(client, booking, payment)];
  }

  const order = await getOrder(payment.order_id as string);
  // Authorized at PayPal but the answer never reached us.
  if (order.authorization) return recordAuthorization(client, booking, payment, order);
  if (order.status !== "APPROVED") return "awaiting_approval";

  if (!matchesDeposit(order, booking)) {
    logger.error("[PAYPAL_CAPTURE_MISMATCH]", { bookingId: booking.id, orderId: order.id, source, phone: true, captured: false });
    await flagNeedsAttention(client, booking.id);
    return "mismatch";
  }

  await guardedUpdate(client, "payments", payment.id, { status: "approved" }, ["created"]);

  if (!holdIsLive(hold)) {
    const { data: reacquired, error } = await client.rpc("reacquire_hold", { p_booking_id: booking.id });
    if (error) throw new Error(`Failed to re-acquire hold: ${error.message}`);
    if (!reacquired) return expireUnauthorized(client, booking, payment);
  }

  // Never hold the buyer's money for a call that cannot be made.
  const readiness = await phoneConfirmationReadiness();
  if (!readiness.ready) {
    logger.warn("[PHONE_CONFIRMATION_NOT_CONFIGURED]", { bookingId: booking.id, reason: readiness.reason });
    return expireUnauthorized(client, booking, payment, { confirmation_outcome: "not_configured" });
  }

  let authorized: PaypalOrder;
  try {
    authorized = await authorizeOrder(order.id, payment.operation_key as string);
  } catch (error) {
    // Unknown outcome: the payment stays approved and getOrder tells reconciliation.
    logger.warn("[PAYPAL_AUTHORIZE_PENDING]", { bookingId: booking.id, source, error: message(error) });
    return "pending";
  }
  return recordAuthorization(client, booking, payment, authorized);
}

/** The ElevenLabs webhook's hook: settles the payment linked to this call, if any. */
export async function settlePhoneConfirmationCall(client: SupabaseClient, callId: string): Promise<PhoneSettlement | "not_linked"> {
  const { data, error } = await client.from("payments").select("*, booking:bookings(*)").eq("phone_call_id", callId).maybeSingle();
  if (error) throw new Error(`Failed to load the confirmation payment: ${error.message}`);
  if (!data) return "not_linked";
  const { booking, ...payment } = data as Row & { booking: Row };
  return settlePhonePayment(client, booking, payment);
}

/**
 * Reconciliation's phone step: every authorized or void_pending payment (in
 * `scope` when given). `onError` decides per item: count it, or rethrow to
 * abort the run (PayPal unreachable).
 */
export async function reconcilePhoneAuthorizations(
  client: SupabaseClient,
  scope: readonly string[] | null,
  onError: (error: unknown, row: Row) => void
): Promise<{ confirmed: number; voided: number }> {
  let query = client
    .from("payments")
    .select("*, bookings!inner(*)")
    .in("status", OPEN_AUTHORIZATIONS)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (scope) query = query.in("booking_id", [...scope]);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load open authorizations: ${error.message}`);

  const counts = { confirmed: 0, voided: 0 };
  for (const row of (data ?? []) as Row[]) {
    const { bookings, ...payment } = row;
    try {
      const settled = await settlePhonePayment(client, bookings as Row, payment);
      if (settled === "confirmed") counts.confirmed++;
      if (settled === "voided") counts.voided++;
    } catch (failure) {
      onError(failure, row);
    }
  }
  return counts;
}
