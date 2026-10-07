// @vitest-environment node
/**
 * Unit tests for visitor cancellation. cancel.postgrest-integration.test.ts
 * proves the behaviour against the live stack; these pin the same outcomes,
 * guarded writes and PayPal calls against the fake client so CI covers them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingRow, createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";

const paypal = vi.hoisted(() => ({ refundCapture: vi.fn() }));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  return { ...types, ...paypal };
});
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));
// Phase 8a: the balance invoice step (tested in invoice.test.ts); only its never-throwing wrapper may be used here.
const invoice = vi.hoisted(() => ({ closeInvoiceAfterCancellationSafely: vi.fn(async () => "none") }));
vi.mock("./invoice", () => invoice);

const { PaypalError, PaypalNotConfigured } = await import("@/lib/paypal/types");
const { cancellationPreview, confirmCancellation, requestCancellationRefund } = await import("./cancel");
const { BOOKING_REFUNDED_FROM } = await import("./payment-state");
const { BookingError, mapBooking } = await import("./types");

const ID = "11111111-2222-4333-8444-555555555555";
const SLOT_START = "2026-11-21T09:00:00+00:00";
const REFUND_UNTIL = "2026-11-20T09:00:00+00:00";
const NOW = new Date("2026-11-19T12:00:00Z");
const PAYMENT = { id: "pay-1", booking_id: ID, status: "captured", capture_id: "CAP-1", operation_key: "op-key-1", amount_cents: 3000 };
const CHANGED = { data: [{ id: "x" }] };
const LOST = { data: [] };

const confirmed = () => mapBooking(bookingRow({ status: "confirmed" }));

let fake: BookingSupabaseFake;

beforeEach(() => {
  vi.clearAllMocks();
  fake = createBookingSupabaseFake();
});

describe("cancellationPreview", () => {
  it("refuses a booking that is not confirmed, without computing terms", async () => {
    const booking = mapBooking(bookingRow({ status: "refunded" }));

    await expect(cancellationPreview(fake.client, booking)).rejects.toMatchObject({ code: "invalid_state" });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("maps the server's terms, passing `now` through, with termsValidUntil while a refund is due", async () => {
    const call = fake.onRpc("cancellation_terms", { data: { refund_cents: 3000, slot_start: SLOT_START, refund_until: REFUND_UNTIL } });

    const terms = await cancellationPreview(fake.client, confirmed(), NOW);

    expect(fake.rpc).toHaveBeenCalledWith("cancellation_terms", { p_booking_id: ID, p_now: NOW.toISOString() });
    expect(call.single).toHaveBeenCalled();
    expect(terms).toEqual({
      refundCents: 3000,
      depositCents: 3000,
      currency: "EUR",
      cancellationWindowHours: 24,
      slotStart: "2026-11-21T09:00:00.000Z",
      termsValidUntil: "2026-11-20T09:00:00.000Z",
    });
  });

  it("has no termsValidUntil once the refund is 0, and sends p_now null without `now`", async () => {
    fake.onRpc("cancellation_terms", { data: { refund_cents: 0, slot_start: SLOT_START, refund_until: REFUND_UNTIL } });

    const terms = await cancellationPreview(fake.client, confirmed());

    expect(fake.rpc).toHaveBeenCalledWith("cancellation_terms", { p_booking_id: ID, p_now: null });
    expect(terms).toMatchObject({ refundCents: 0, termsValidUntil: null });
  });

  it("throws on an RPC error", async () => {
    fake.onRpc("cancellation_terms", { error: { message: "boom" } });

    await expect(cancellationPreview(fake.client, confirmed())).rejects.toThrow("Failed to compute cancellation terms: boom");
  });
});

describe("confirmCancellation", () => {
  /** Queues confirm_cancellation's reply. */
  const confirmReply = (data: Record<string, unknown>) => fake.onRpc("confirm_cancellation", { data });

  it("R2-05: changed terms are returned mapped (0 refund -> no validity), with nothing read or written", async () => {
    confirmReply({ outcome: "terms_changed", status: "confirmed", refund_cents: 0, slot_start: SLOT_START, refund_until: REFUND_UNTIL });

    const result = await confirmCancellation(fake.client, confirmed(), 3000, NOW);

    expect(fake.rpc).toHaveBeenCalledWith("confirm_cancellation", { p_booking_id: ID, p_expected_refund_cents: 3000, p_now: NOW.toISOString() });
    expect(result).toEqual({
      outcome: "terms_changed",
      terms: expect.objectContaining({ refundCents: 0, termsValidUntil: null, slotStart: "2026-11-21T09:00:00.000Z" }),
    });
    expect(fake.client.from).not.toHaveBeenCalled();
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("an expectation above the policy comes back as terms_changed with the policy's refund", async () => {
    confirmReply({ outcome: "terms_changed", status: "confirmed", refund_cents: 3000, slot_start: SLOT_START, refund_until: REFUND_UNTIL });

    const result = await confirmCancellation(fake.client, confirmed(), 5000);

    expect(fake.rpc).toHaveBeenCalledWith("confirm_cancellation", { p_booking_id: ID, p_expected_refund_cents: 5000, p_now: null });
    expect(result).toMatchObject({ outcome: "terms_changed", terms: { refundCents: 3000, termsValidUntil: "2026-11-20T09:00:00.000Z" } });
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it.each(["pending_payment", "needs_attention", "expired"])(
    "a %s booking is not a cancellation: invalid_state, never reported as cancelled",
    async (status) => {
      confirmReply({ outcome: "unchanged", status, refund_cents: null });
      await expect(confirmCancellation(fake.client, confirmed(), 3000)).rejects.toMatchObject({ code: "invalid_state" });
    }
  );

  it("a second confirm is unchanged and never refunds again", async () => {
    confirmReply({ outcome: "unchanged", status: "refund_pending", refund_cents: 3000 });

    expect(await confirmCancellation(fake.client, confirmed(), 3000)).toEqual({ outcome: "unchanged", status: "refund_pending", refundCents: 3000 });
    expect(fake.client.from).not.toHaveBeenCalled();
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("cancelling with nothing to refund ends cancelled with no PayPal call", async () => {
    confirmReply({ outcome: "cancelled", status: "cancelled", refund_cents: 0 });

    expect(await confirmCancellation(fake.client, confirmed(), 0)).toEqual({ outcome: "cancelled", status: "cancelled", refundCents: 0 });
    expect(fake.client.from).not.toHaveBeenCalled();
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("throws on an RPC error", async () => {
    fake.onRpc("confirm_cancellation", { error: { message: "boom" } });

    await expect(confirmCancellation(fake.client, confirmed(), 3000)).rejects.toThrow("Failed to confirm the cancellation: boom");
  });

  it("refunds the server's amount once with the payment's key, moves payment and booking to refund_pending, then reloads", async () => {
    confirmReply({ outcome: "cancelled", status: "cancel_pending", refund_cents: 2500 });
    const load = fake.onTable("payments", { data: PAYMENT });
    const payWrite = fake.onTable("payments", CHANGED);
    const bookWrite = fake.onTable("bookings", CHANGED);
    const reload = fake.onTable("bookings", { data: { status: "refund_pending" } });
    paypal.refundCapture.mockResolvedValue({ id: "RF-1", status: "PENDING" });

    const result = await confirmCancellation(fake.client, confirmed(), 2500);

    expect(result).toEqual({ outcome: "cancelled", status: "refund_pending", refundCents: 2500 });
    expect(load.eq).toHaveBeenCalledWith("booking_id", ID);
    expect(load.eq).toHaveBeenCalledWith("status", "captured");
    expect(load.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(load.limit).toHaveBeenCalledWith(1);
    expect(paypal.refundCapture).toHaveBeenCalledTimes(1);
    expect(paypal.refundCapture).toHaveBeenCalledWith("CAP-1", 2500, "op-key-1");
    expect(payWrite.update).toHaveBeenCalledWith({ status: "refund_pending", refund_id: "RF-1" });
    expect(payWrite.in).toHaveBeenCalledWith("status", ["captured"]);
    expect(bookWrite.update).toHaveBeenCalledWith({ status: "refund_pending" });
    expect(bookWrite.in).toHaveBeenCalledWith("status", ["cancel_pending"]);
    expect(reload.select).toHaveBeenCalledWith("status");
    expect(reload.eq).toHaveBeenCalledWith("id", ID);
  });

  it("a refund PayPal completes at once ends refunded", async () => {
    confirmReply({ outcome: "cancelled", status: "cancel_pending", refund_cents: 3000 });
    fake.onTable("payments", { data: PAYMENT });
    fake.onTable("payments", CHANGED);
    const refunded = fake.onTable("payments", CHANGED);
    fake.onTable("bookings", CHANGED);
    const bookRefunded = fake.onTable("bookings", CHANGED);
    fake.onTable("bookings", { data: { status: "refunded" } });
    paypal.refundCapture.mockResolvedValue({ id: "RF-1", status: "COMPLETED" });

    expect(await confirmCancellation(fake.client, confirmed(), 3000)).toMatchObject({ outcome: "cancelled", status: "refunded" });
    expect(refunded.update).toHaveBeenCalledWith(expect.objectContaining({ status: "refunded" }));
    expect(bookRefunded.update).toHaveBeenCalledWith({ status: "refunded" });
    expect(bookRefunded.in).toHaveBeenCalledWith("status", BOOKING_REFUNDED_FROM);
  });

  // Once confirm_cancellation recorded the cancellation, every later failure
  // is "recorded, refund retried": never "could not cancel".
  it("a captured payment that cannot be loaded reports refund_unavailable, before any PayPal call", async () => {
    confirmReply({ outcome: "cancelled", status: "cancel_pending", refund_cents: 3000 });
    fake.onTable("payments", { error: { message: "none" } });

    await expect(confirmCancellation(fake.client, confirmed(), 3000)).rejects.toMatchObject({ code: "refund_unavailable" });
    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[BOOKING_CANCEL_REFUND_FAILED]", {
      bookingId: ID,
      error: "Failed to load the captured payment: none",
    });
  });

  it.each([
    ["a PayPal timeout", () => new PaypalError("timeout", { status: null })],
    ["a PayPal 5xx", () => new PaypalError("down", { status: 503 })],
    ["PayPal not configured", () => new PaypalNotConfigured()],
    ["a database error", () => new Error("db down")],
    ["a non-Error rejection", () => "plain"],
  ])("%s keeps the cancellation (no writes) and reports refund_unavailable", async (_label, makeError) => {
    confirmReply({ outcome: "cancelled", status: "cancel_pending", refund_cents: 3000 });
    fake.onTable("payments", { data: PAYMENT });
    paypal.refundCapture.mockRejectedValue(makeError());

    const failure = confirmCancellation(fake.client, confirmed(), 3000);

    await expect(failure).rejects.toBeInstanceOf(BookingError);
    await expect(failure).rejects.toMatchObject({ code: "refund_unavailable" });
    expect(fake.client.from).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith("[BOOKING_CANCEL_REFUND_FAILED]", { bookingId: ID, error: expect.any(String) });
  });

  it("a refund PayPal refuses for good (4xx) flags the booking for a person and reports needs_attention", async () => {
    confirmReply({ outcome: "cancelled", status: "cancel_pending", refund_cents: 3000 });
    fake.onTable("payments", { data: PAYMENT });
    const failed = fake.onTable("payments", CHANGED);
    const flag = fake.onTable("bookings", CHANGED);
    fake.onTable("bookings", { data: { status: "needs_attention" } });
    paypal.refundCapture.mockRejectedValue(new PaypalError("refused", { status: 422, issue: "INSUFFICIENT_FUNDS" }));

    expect(await confirmCancellation(fake.client, confirmed(), 3000)).toEqual({ outcome: "cancelled", status: "needs_attention", refundCents: 3000 });
    // The plan's "refund failed at PayPal" state: payment refund_failed, booking needs_attention.
    expect(failed.update).toHaveBeenCalledWith({ status: "refund_failed" });
    expect(failed.in).toHaveBeenCalledWith("status", ["captured"]);
    expect(flag.update).toHaveBeenCalledWith({ status: "needs_attention" });
    expect(flag.in).toHaveBeenCalledWith("status", ["cancel_pending"]);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_REFUND_REFUSED]", expect.objectContaining({ bookingId: ID, status: 422, issue: "INSUFFICIENT_FUNDS" }));
  });

  it("a booking that cannot be reloaded after the refund reports refund_unavailable", async () => {
    confirmReply({ outcome: "cancelled", status: "cancel_pending", refund_cents: 3000 });
    fake.onTable("payments", { data: PAYMENT });
    fake.onTable("payments", CHANGED);
    fake.onTable("bookings", CHANGED);
    fake.onTable("bookings", { error: { message: "gone" } });
    paypal.refundCapture.mockResolvedValue({ id: "RF-1", status: "PENDING" });

    await expect(confirmCancellation(fake.client, confirmed(), 3000)).rejects.toMatchObject({ code: "refund_unavailable" });
  });
});

describe("confirmCancellation: the balance invoice (Phase 8a)", () => {
  const confirmReply = (data: Record<string, unknown>) => fake.onRpc("confirm_cancellation", { data });

  it("closes the invoice after a cancellation with nothing to refund, and an invoice failure changes nothing", async () => {
    confirmReply({ outcome: "cancelled", status: "cancelled", refund_cents: 0 });
    invoice.closeInvoiceAfterCancellationSafely.mockResolvedValueOnce("failed");

    expect(await confirmCancellation(fake.client, confirmed(), 0)).toEqual({ outcome: "cancelled", status: "cancelled", refundCents: 0 });
    expect(invoice.closeInvoiceAfterCancellationSafely).toHaveBeenCalledWith(fake.client, ID);
  });

  it("closes the invoice after the deposit refund was requested", async () => {
    confirmReply({ outcome: "cancelled", status: "cancel_pending", refund_cents: 3000 });
    fake.onTable("payments", { data: PAYMENT });
    fake.onTable("payments", CHANGED);
    fake.onTable("bookings", CHANGED);
    fake.onTable("bookings", { data: { status: "refund_pending" } });
    paypal.refundCapture.mockResolvedValue({ id: "RF-1", status: "PENDING" });

    expect(await confirmCancellation(fake.client, confirmed(), 3000)).toMatchObject({ status: "refund_pending" });
    expect(invoice.closeInvoiceAfterCancellationSafely).toHaveBeenCalledTimes(1);
    expect(invoice.closeInvoiceAfterCancellationSafely.mock.invocationCallOrder[0]).toBeGreaterThan(paypal.refundCapture.mock.invocationCallOrder[0]);
  });

  it("still closes the invoice when the deposit refund must be retried (the cancellation is recorded)", async () => {
    confirmReply({ outcome: "cancelled", status: "cancel_pending", refund_cents: 3000 });
    fake.onTable("payments", { data: PAYMENT });
    paypal.refundCapture.mockRejectedValue(new PaypalError("down", { status: 503 }));

    await expect(confirmCancellation(fake.client, confirmed(), 3000)).rejects.toMatchObject({ code: "refund_unavailable" });
    expect(invoice.closeInvoiceAfterCancellationSafely).toHaveBeenCalledWith(fake.client, ID);
  });

  it.each([
    ["changed terms", { outcome: "terms_changed", status: "confirmed", refund_cents: 0, slot_start: SLOT_START, refund_until: REFUND_UNTIL }],
    ["a repeated confirm", { outcome: "unchanged", status: "refund_pending", refund_cents: 3000 }],
  ])("leaves the invoice alone on %s (nothing new was recorded)", async (_case, reply) => {
    confirmReply(reply);
    await confirmCancellation(fake.client, confirmed(), 3000);
    expect(invoice.closeInvoiceAfterCancellationSafely).not.toHaveBeenCalled();
  });
});

describe("requestCancellationRefund", () => {
  it.each([
    ["missing", undefined],
    ["zero", 0],
    ["negative", -1],
    ["fractional", 10.5],
    ["a string", "3000"],
  ])("refuses a %s refund amount without calling PayPal", async (_label, amount) => {
    await expect(requestCancellationRefund(fake.client, { id: ID, refund_cents: amount }, PAYMENT)).rejects.toThrow(
      `No refund amount for booking ${ID}`
    );
    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it("a lost race on the payment returns null and leaves the booking alone", async () => {
    const payWrite = fake.onTable("payments", LOST);
    paypal.refundCapture.mockResolvedValue({ id: "RF-1", status: "COMPLETED" });

    expect(await requestCancellationRefund(fake.client, { id: ID, refund_cents: 3000 }, PAYMENT)).toBeNull();
    expect(paypal.refundCapture).toHaveBeenCalledWith("CAP-1", 3000, "op-key-1");
    expect(payWrite.in).toHaveBeenCalledWith("status", ["captured"]);
    expect(fake.client.from).toHaveBeenCalledTimes(1);
  });

  it.each([400, 403, 404, 422])("a definitive PayPal refusal (%i) fails the refund, flags the booking and returns null", async (status) => {
    fake.onTable("payments", CHANGED);
    const flag = fake.onTable("bookings", CHANGED);
    paypal.refundCapture.mockRejectedValue(new PaypalError("refused", { status }));

    expect(await requestCancellationRefund(fake.client, { id: ID, refund_cents: 3000 }, PAYMENT)).toBeNull();
    expect(flag.in).toHaveBeenCalledWith("status", ["cancel_pending"]);
    expect(fake.client.from).toHaveBeenCalledTimes(2);
  });

  it("a refusal that lost the race on the payment leaves the booking alone", async () => {
    fake.onTable("payments", LOST);
    paypal.refundCapture.mockRejectedValue(new PaypalError("refused", { status: 422 }));

    expect(await requestCancellationRefund(fake.client, { id: ID, refund_cents: 3000 }, PAYMENT)).toBeNull();
    expect(fake.client.from).toHaveBeenCalledTimes(1);
  });

  it("a 422 PREVIOUS_REQUEST_IN_PROGRESS (same request still being processed) is transient and rethrown", async () => {
    paypal.refundCapture.mockRejectedValue(new PaypalError("in progress", { status: 422, issue: "PREVIOUS_REQUEST_IN_PROGRESS" }));
    await expect(requestCancellationRefund(fake.client, { id: ID, refund_cents: 3000 }, PAYMENT)).rejects.toBeInstanceOf(PaypalError);
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it.each([null, 401, 408, 409, 429, 500])("a PayPal error with status %s is transient and rethrown", async (status) => {
    paypal.refundCapture.mockRejectedValue(new PaypalError("later", { status }));
    await expect(requestCancellationRefund(fake.client, { id: ID, refund_cents: 3000 }, PAYMENT)).rejects.toBeInstanceOf(PaypalError);
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it("returns PayPal's refund once the writes applied", async () => {
    fake.onTable("payments", CHANGED);
    fake.onTable("bookings", CHANGED);
    paypal.refundCapture.mockResolvedValue({ id: "RF-1", status: "PENDING" });

    expect(await requestCancellationRefund(fake.client, { id: ID, refund_cents: 3000 }, PAYMENT)).toEqual({ id: "RF-1", status: "PENDING" });
  });
});
