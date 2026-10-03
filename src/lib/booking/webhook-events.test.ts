// @vitest-environment node
/**
 * PayPal webhook events: normalization, processing and the processed/failed
 * inbox marks. The capture path and PayPal are replaced at the module boundary;
 * the guarded payment and booking writes (payment-state) are real, against the
 * scripted Supabase fake, so each test pins the exact write and its guard.
 * The same behaviour runs end to end in reconcile.postgrest-integration.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingRow, createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";

const capture = vi.hoisted(() => ({
  captureApprovedOrder: vi.fn(),
  compensateCapturedPayment: vi.fn(),
  finalizeCaptured: vi.fn(),
}));
vi.mock("./capture", () => capture);

const paypal = vi.hoisted(() => ({ getCapture: vi.fn() }));
vi.mock("@/lib/paypal", async () => {
  const money = await vi.importActual<typeof import("@/lib/paypal/money")>("@/lib/paypal/money");
  return { ...money, ...paypal };
});

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

import {
  PaypalWebhookUnmatched,
  UNMATCHED_TAG,
  normalizePaypalEvent,
  processAndRecordPaypalEvent,
  processPaypalEvent,
  type PaypalInboxEvent,
} from "./webhook-events";
import { CAPTURABLE, RECORDABLE, type Row } from "./payment-state";

const BOOKING = "b0050000-0000-4000-8000-0000000000c1";

describe("normalizePaypalEvent", () => {
  it("takes the order id and custom_id from a CHECKOUT.ORDER event", () => {
    const payload = {
      id: "WH-1",
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource: { id: "ORDER-1", purchase_units: [{ custom_id: BOOKING }] },
    };

    expect(normalizePaypalEvent(payload)).toEqual({
      event_id: "WH-1",
      event_type: "CHECKOUT.ORDER.APPROVED",
      payload,
      order_id: "ORDER-1",
      capture_id: null,
      refund_id: null,
      custom_id: BOOKING,
    });
  });

  it("takes the capture id, related order id and custom_id from a capture event", () => {
    const event = normalizePaypalEvent({
      id: "WH-2",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: { id: "CAP-1", custom_id: BOOKING, supplementary_data: { related_ids: { order_id: "ORDER-1" } } },
    });

    expect(event).toMatchObject({ order_id: "ORDER-1", capture_id: "CAP-1", refund_id: null, custom_id: BOOKING });
  });

  it("takes the refund id, and the capture id from the refund's up link, from a refund event", () => {
    const event = normalizePaypalEvent({
      id: "WH-3",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: {
        id: "REFUND-1",
        custom_id: BOOKING,
        links: [
          { rel: "self", href: "https://api.sandbox.paypal.com/v2/payments/refunds/REFUND-1" },
          { rel: "up", href: "https://api.sandbox.paypal.com/v2/payments/captures/CAP-1" },
        ],
      },
    });

    expect(event).toMatchObject({ order_id: null, capture_id: "CAP-1", refund_id: "REFUND-1", custom_id: BOOKING });
  });

  it("keeps other event types without ids it does not know how to read", () => {
    expect(normalizePaypalEvent({ id: "WH-4", event_type: "PAYMENT.SALE.COMPLETED", resource: { id: "SALE-1" } })).toMatchObject({
      order_id: null,
      capture_id: null,
      refund_id: null,
      custom_id: null,
    });
  });

  it.each([
    ["no id", { event_type: "CHECKOUT.ORDER.APPROVED", resource: {} }],
    ["no event_type", { id: "WH-5", resource: {} }],
    ["an empty id", { id: "", event_type: "CHECKOUT.ORDER.APPROVED", resource: {} }],
    ["an array", []],
    ["null", null],
  ])("returns null for %s", (_label, payload) => {
    expect(normalizePaypalEvent(payload)).toBeNull();
  });

  it("reads no ids from an order event whose resource is missing or malformed", () => {
    expect(normalizePaypalEvent({ id: "WH-6", event_type: "CHECKOUT.ORDER.APPROVED" })).toMatchObject({ order_id: null, custom_id: null });
    expect(
      normalizePaypalEvent({ id: "WH-7", event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: 42, purchase_units: "nope" } })
    ).toMatchObject({ order_id: null, custom_id: null });
  });

  it.each([
    ["no links", {}],
    ["no up link", { links: [{ rel: "self", href: "https://api.sandbox.paypal.com/v2/payments/refunds/R" }] }],
    ["an up link without href", { links: [null, { rel: "up" }] }],
    ["an up link to something that is not a capture", { links: [{ rel: "up", href: "https://api.sandbox.paypal.com/v2/checkout/orders/O" }] }],
  ])("reads no capture id from a refund event with %s", (_label, resource) => {
    const event = normalizePaypalEvent({ id: "WH-8", event_type: "PAYMENT.CAPTURE.REFUNDED", resource: { id: "REFUND-2", ...resource } });

    expect(event).toMatchObject({ refund_id: "REFUND-2", capture_id: null, order_id: null });
  });

  it("reads no related order id when supplementary_data is not an object", () => {
    const event = normalizePaypalEvent({
      id: "WH-9",
      event_type: "PAYMENT.CAPTURE.PENDING",
      resource: { id: "CAP-2", supplementary_data: "x" },
    });

    expect(event).toMatchObject({ capture_id: "CAP-2", order_id: null, custom_id: null });
  });
});

// --- processing --------------------------------------------------------------

const booking = bookingRow({ id: BOOKING });

function payment(overrides: Row = {}): Row {
  return {
    id: "pay-1",
    booking_id: BOOKING,
    order_id: "ORDER-1",
    capture_id: null,
    refund_id: null,
    status: "capture_pending",
    captured_at: null,
    compensation_reason: null,
    ...overrides,
  };
}

function inboxEvent(eventType: string, overrides: Partial<PaypalInboxEvent> = {}, resource: Row = {}): PaypalInboxEvent {
  return {
    event_id: "WH-10",
    event_type: eventType,
    payload: { id: "WH-10", event_type: eventType, resource },
    order_id: "ORDER-1",
    capture_id: null,
    refund_id: null,
    custom_id: BOOKING,
    ...overrides,
  };
}

const DEPOSIT = { currency_code: "EUR", value: "30.00" };

/** A capture event for this booking's order: by default the full deposit. */
function captureEvent(eventType = "PAYMENT.CAPTURE.COMPLETED", amount: unknown = DEPOSIT, overrides: Partial<PaypalInboxEvent> = {}) {
  return inboxEvent(eventType, { capture_id: "CAP-1", ...overrides }, { id: "CAP-1", amount, custom_id: BOOKING });
}

let fake: BookingSupabaseFake;

/** The event resolves to `row` by its order id; the booking is then loaded. */
function resolvesTo(row: Row, bookingData: Row = booking) {
  return { lookup: fake.onTable("payments", { data: row }), load: fake.onTable("bookings", { data: bookingData }) };
}

/** Next guarded write on `table`: `changed` says whether a row matched the guard. */
function write(table: string, changed = true) {
  return fake.onTable(table, { data: changed ? [{ id: "row" }] : [] });
}

const tablesQueried = () => vi.mocked(fake.client.from).mock.calls.map(([table]) => table);

beforeEach(() => {
  vi.clearAllMocks();
  fake = createBookingSupabaseFake();
});

describe("processPaypalEvent: resolving the payment", () => {
  it("resolves by order id first, newest payment, then loads its booking", async () => {
    const { lookup, load } = resolvesTo(payment());
    write("payments");

    await expect(processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.PENDING"))).resolves.toBe("recorded");

    expect(lookup.eq).toHaveBeenCalledWith("order_id", "ORDER-1");
    expect(lookup.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(lookup.limit).toHaveBeenCalledWith(1);
    expect(lookup.maybeSingle).toHaveBeenCalled();
    expect(load.eq).toHaveBeenCalledWith("id", BOOKING);
    expect(paypal.getCapture).not.toHaveBeenCalled();
  });

  it("falls back to custom_id (the booking id) when the order id matches nothing", async () => {
    fake.onTable("payments", { data: null });
    const byBooking = fake.onTable("payments", { data: payment() });
    fake.onTable("bookings", { data: booking });
    write("payments");

    await expect(processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.PENDING", DEPOSIT, { order_id: "ORDER-X" }))).resolves.toBe(
      "recorded"
    );

    expect(byBooking.eq).toHaveBeenCalledWith("booking_id", BOOKING);
  });

  it("skips a custom_id that is not a uuid and resolves by the capture id", async () => {
    const byCapture = fake.onTable("payments", { data: payment({ capture_id: "CAP-1" }) });
    fake.onTable("bookings", { data: booking });
    write("payments");

    const event = captureEvent("PAYMENT.CAPTURE.PENDING", DEPOSIT, { order_id: null, custom_id: "not-a-uuid" });
    await expect(processPaypalEvent(fake.client, event)).resolves.toBe("recorded");

    expect(byCapture.eq).toHaveBeenCalledWith("capture_id", "CAP-1");
    expect(byCapture.eq).toHaveBeenCalledTimes(1);
  });

  it("asks PayPal for the capture's order as the last resort", async () => {
    fake.onTable("payments", { data: null });
    const byOrder = fake.onTable("payments", { data: payment() });
    fake.onTable("bookings", { data: booking });
    write("payments");
    paypal.getCapture.mockResolvedValue({ id: "CAP-1", orderId: "ORDER-1" });

    const event = captureEvent("PAYMENT.CAPTURE.PENDING", DEPOSIT, { order_id: null, custom_id: null });
    await expect(processPaypalEvent(fake.client, event)).resolves.toBe("recorded");

    expect(paypal.getCapture).toHaveBeenCalledWith("CAP-1");
    expect(byOrder.eq).toHaveBeenCalledWith("order_id", "ORDER-1");
  });

  it("throws PaypalWebhookUnmatched, tagged for the drain filter, when nothing resolves", async () => {
    fake.onTable("payments", { data: null });
    paypal.getCapture.mockResolvedValue({ id: "CAP-NOBODY", orderId: null });

    const event = captureEvent("PAYMENT.CAPTURE.COMPLETED", DEPOSIT, { order_id: null, custom_id: null, capture_id: "CAP-NOBODY" });
    const result = processPaypalEvent(fake.client, event);

    await expect(result).rejects.toBeInstanceOf(PaypalWebhookUnmatched);
    await expect(result).rejects.toThrow(new RegExp(`^\\${UNMATCHED_TAG} event WH-10 matches no payment$`));
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_UNMATCHED]", expect.objectContaining({ eventId: "WH-10", captureId: "CAP-NOBODY" }));
    expect(tablesQueried()).toEqual(["payments"]);
  });

  it("is unmatched without any lookup or PayPal call when the event carries no ids", async () => {
    const event = inboxEvent("CHECKOUT.ORDER.APPROVED", { order_id: null, custom_id: null });

    await expect(processPaypalEvent(fake.client, event)).rejects.toBeInstanceOf(PaypalWebhookUnmatched);
    expect(fake.client.from).not.toHaveBeenCalled();
    expect(paypal.getCapture).not.toHaveBeenCalled();
  });

  it("throws when the payment cannot be loaded", async () => {
    fake.onTable("payments", { error: { message: "boom" } });

    await expect(processPaypalEvent(fake.client, captureEvent())).rejects.toThrow("Failed to load payment: boom");
  });

  it("throws when the booking cannot be loaded", async () => {
    fake.onTable("payments", { data: payment() });
    fake.onTable("bookings", { error: { message: "gone" } });

    await expect(processPaypalEvent(fake.client, captureEvent())).rejects.toThrow("Failed to load booking: gone");
  });

  it("ignores event types the booking flow does not use, without reading anything", async () => {
    await expect(processPaypalEvent(fake.client, inboxEvent("PAYMENT.SALE.COMPLETED"))).resolves.toBe("ignored");
    expect(fake.client.from).not.toHaveBeenCalled();
  });
});

describe("CHECKOUT.ORDER.APPROVED", () => {
  it("marks a created payment approved and runs the shared capture path as the webhook", async () => {
    resolvesTo(payment({ status: "created" }));
    const approve = write("payments");
    capture.captureApprovedOrder.mockResolvedValue("confirmed");

    await expect(processPaypalEvent(fake.client, inboxEvent("CHECKOUT.ORDER.APPROVED"))).resolves.toBe("confirmed");

    expect(approve.update).toHaveBeenCalledWith({ status: "approved" });
    expect(approve.in).toHaveBeenCalledWith("status", ["created"]);
    expect(capture.captureApprovedOrder).toHaveBeenCalledWith(fake.client, BOOKING, "webhook");
  });

  it("still runs the capture path for a captured payment (it confirms the booking)", async () => {
    resolvesTo(payment({ status: "captured", capture_id: "CAP-1" }));
    write("payments", false);
    capture.captureApprovedOrder.mockResolvedValue("confirmed");

    await expect(processPaypalEvent(fake.client, inboxEvent("CHECKOUT.ORDER.APPROVED"))).resolves.toBe("confirmed");
    expect(capture.captureApprovedOrder).toHaveBeenCalledTimes(1);
  });

  it.each(["expired", "capture_failed", "refund_pending", "refunded"])("never captures on a late approval for a %s payment", async (status) => {
    resolvesTo(payment({ status }));

    await expect(processPaypalEvent(fake.client, inboxEvent("CHECKOUT.ORDER.APPROVED"))).resolves.toBe("out_of_order");

    expect(capture.captureApprovedOrder).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_OUT_OF_ORDER]", expect.objectContaining({ paymentStatus: status }));
    expect(tablesQueried()).toEqual(["payments", "bookings"]);
  });
});

describe("PAYMENT.CAPTURE.COMPLETED", () => {
  it("records a matching capture from any recordable status, then finalizes it", async () => {
    resolvesTo(payment());
    const record = write("payments");
    capture.finalizeCaptured.mockResolvedValue("confirmed");

    await expect(processPaypalEvent(fake.client, captureEvent())).resolves.toBe("confirmed");

    const fields = record.update.mock.calls[0][0];
    expect(fields).toEqual({ status: "captured", capture_id: "CAP-1", captured_at: expect.any(String) });
    expect(record.in).toHaveBeenCalledWith("status", RECORDABLE);
    expect(capture.finalizeCaptured).toHaveBeenCalledWith(fake.client, booking, expect.objectContaining({ id: "pay-1", ...fields }));
  });

  it.each(["expired", "capture_failed"])("records a completed capture over %s, because money moved (R2-01)", async (status) => {
    resolvesTo(payment({ status }));
    const record = write("payments");
    capture.finalizeCaptured.mockResolvedValue("confirmed");

    await expect(processPaypalEvent(fake.client, captureEvent())).resolves.toBe("confirmed");
    expect(record.update).toHaveBeenCalledWith(expect.objectContaining({ status: "captured", capture_id: "CAP-1" }));
  });

  it("keeps the captured_at the payment already has", async () => {
    resolvesTo(payment({ status: "captured", capture_id: "CAP-1", captured_at: "2026-11-20T09:00:00.000Z" }));
    const record = write("payments");
    capture.finalizeCaptured.mockResolvedValue("confirmed");

    await processPaypalEvent(fake.client, captureEvent());

    expect(record.update).toHaveBeenCalledWith(expect.objectContaining({ captured_at: "2026-11-20T09:00:00.000Z" }));
  });

  it.each([
    ["the payment is already refund_pending", payment({ status: "refund_pending", capture_id: "CAP-1" }), {}],
    ["the payment is already refunded", payment({ status: "refunded", capture_id: "CAP-1" }), {}],
    ["the payment holds a different capture", payment({ status: "captured", capture_id: "CAP-OTHER" }), {}],
    ["the event has no capture id", payment(), { capture_id: null }],
  ])("does not regress when %s", async (_label, row, overrides) => {
    resolvesTo(row);

    await expect(processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.COMPLETED", DEPOSIT, overrides))).resolves.toBe("out_of_order");

    expect(tablesQueried()).toEqual(["payments", "bookings"]);
    expect(capture.finalizeCaptured).not.toHaveBeenCalled();
    expect(capture.compensateCapturedPayment).not.toHaveBeenCalled();
  });

  it("is out of order when the guarded write loses the race", async () => {
    resolvesTo(payment());
    write("payments", false);

    await expect(processPaypalEvent(fake.client, captureEvent())).resolves.toBe("out_of_order");
    expect(capture.finalizeCaptured).not.toHaveBeenCalled();
  });

  it.each([
    ["a different amount", { currency_code: "EUR", value: "1.00" }, {}],
    ["a different currency", { currency_code: "USD", value: "30.00" }, {}],
    ["an unreadable amount", { currency_code: "EUR", value: "thirty" }, {}],
    ["no amount", null, {}],
    ["another booking's custom_id", DEPOSIT, { custom_id: "b0050000-0000-4000-8000-0000000000ff" }],
  ])("compensates a capture with %s in one write, never writing captured", async (_label, amount, overrides) => {
    resolvesTo(payment());
    capture.compensateCapturedPayment.mockResolvedValue("compensating");

    await expect(processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.COMPLETED", amount, overrides))).resolves.toBe("compensating");

    expect(capture.compensateCapturedPayment).toHaveBeenCalledWith(
      fake.client,
      booking,
      expect.objectContaining({ id: "pay-1", capture_id: "CAP-1" }),
      "order_mismatch"
    );
    // Only the lookup touched payments: the capture is recorded by compensation's single write.
    expect(tablesQueried()).toEqual(["payments", "bookings"]);
    expect(capture.finalizeCaptured).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_CAPTURE_MISMATCH]", expect.objectContaining({ bookingId: BOOKING, source: "webhook" }));
  });
});

describe("PAYMENT.CAPTURE.PENDING", () => {
  it("moves a capturable payment to capture_pending with the event's capture id", async () => {
    resolvesTo(payment({ status: "approved" }));
    const pending = write("payments");

    await expect(processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.PENDING"))).resolves.toBe("recorded");

    expect(pending.update).toHaveBeenCalledWith({ status: "capture_pending", capture_id: "CAP-1" });
    expect(pending.in).toHaveBeenCalledWith("status", CAPTURABLE);
  });

  it("never overwrites a capture id the payment already has", async () => {
    resolvesTo(payment({ capture_id: "CAP-KNOWN" }));
    const pending = write("payments");

    await processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.PENDING"));

    expect(pending.update).toHaveBeenCalledWith({ status: "capture_pending" });
  });

  it("is out of order for a payment past capture", async () => {
    resolvesTo(payment({ status: "captured", capture_id: "CAP-1" }));
    write("payments", false);

    await expect(processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.PENDING"))).resolves.toBe("out_of_order");
  });
});

describe("PAYMENT.CAPTURE.DENIED", () => {
  it("fails the payment and flags the booking for attention", async () => {
    resolvesTo(payment());
    const failed = write("payments");
    const flag = write("bookings");

    await expect(processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.DENIED"))).resolves.toBe("failed");

    expect(failed.update).toHaveBeenCalledWith({ status: "capture_failed", capture_id: "CAP-1" });
    expect(failed.in).toHaveBeenCalledWith("status", CAPTURABLE);
    expect(flag.update).toHaveBeenCalledWith({ status: "needs_attention" });
    expect(flag.eq).toHaveBeenCalledWith("id", BOOKING);
    expect(flag.in).toHaveBeenCalledWith("status", ["pending_payment", "expired"]);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_CAPTURE_DENIED]", expect.objectContaining({ bookingId: BOOKING }));
  });

  it("keeps the payment's own capture id", async () => {
    resolvesTo(payment({ capture_id: "CAP-KNOWN" }));
    const failed = write("payments");
    write("bookings");

    await processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.DENIED"));

    expect(failed.update).toHaveBeenCalledWith({ status: "capture_failed", capture_id: "CAP-KNOWN" });
  });

  it("is out of order for a captured payment and flags nothing", async () => {
    resolvesTo(payment({ status: "captured", capture_id: "CAP-1" }));
    write("payments", false);

    await expect(processPaypalEvent(fake.client, captureEvent("PAYMENT.CAPTURE.DENIED"))).resolves.toBe("out_of_order");
    expect(tablesQueried()).toEqual(["payments", "bookings", "payments"]);
  });
});

describe("PAYMENT.CAPTURE.REFUNDED", () => {
  const refundEvent = () => inboxEvent("PAYMENT.CAPTURE.REFUNDED", { capture_id: "CAP-1", refund_id: "RF-1" });

  it("marks the payment refunded with the event's ids and the booking refunded", async () => {
    resolvesTo(payment({ status: "refund_pending", capture_id: null, compensation_reason: "slot_gone" }));
    const refunded = write("payments");
    const bookingRefunded = write("bookings");

    await expect(processPaypalEvent(fake.client, refundEvent())).resolves.toBe("recorded");

    expect(refunded.update).toHaveBeenCalledWith({ status: "refunded", refunded_at: expect.any(String), capture_id: "CAP-1", refund_id: "RF-1" });
    const from = refunded.in.mock.calls[0][1] as string[];
    expect(from).toEqual(expect.arrayContaining([...RECORDABLE, "refund_pending", "refund_failed"]));
    expect(from).not.toContain("refunded");
    expect(bookingRefunded.update).toHaveBeenCalledWith({ status: "refunded" });
  });

  it("keeps the payment's own capture and refund ids", async () => {
    resolvesTo(payment({ status: "refund_pending", capture_id: "CAP-KNOWN", refund_id: "RF-KNOWN" }));
    const refunded = write("payments");
    write("bookings");

    await processPaypalEvent(fake.client, refundEvent());

    expect(refunded.update).toHaveBeenCalledWith(expect.objectContaining({ capture_id: "CAP-KNOWN", refund_id: "RF-KNOWN" }));
  });

  it("leaves the booking confirmed when the refunded payment was a duplicate capture", async () => {
    resolvesTo(payment({ status: "refund_pending", capture_id: "CAP-1", compensation_reason: "duplicate_capture" }));
    write("payments");

    await expect(processPaypalEvent(fake.client, refundEvent())).resolves.toBe("recorded");
    expect(tablesQueried()).toEqual(["payments", "bookings", "payments"]);
  });

  it("is out of order for a payment already refunded", async () => {
    resolvesTo(payment({ status: "refunded", capture_id: "CAP-1", refund_id: "RF-1" }));
    write("payments", false);

    await expect(processPaypalEvent(fake.client, refundEvent())).resolves.toBe("out_of_order");
    expect(tablesQueried()).toEqual(["payments", "bookings", "payments"]);
  });
});

describe("processAndRecordPaypalEvent", () => {
  it("marks the event processed after it is applied", async () => {
    fake.onRpc("mark_paypal_event_processed", {});

    await expect(processAndRecordPaypalEvent(fake.client, inboxEvent("PAYMENT.SALE.COMPLETED"))).resolves.toBe("ignored");

    expect(fake.rpc).toHaveBeenCalledWith("mark_paypal_event_processed", { p_event_id: "WH-10" });
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });

  it("throws when the processed mark cannot be written", async () => {
    fake.onRpc("mark_paypal_event_processed", { error: { message: "db down" } });

    await expect(processAndRecordPaypalEvent(fake.client, inboxEvent("PAYMENT.SALE.COMPLETED"))).rejects.toThrow(
      "Failed to mark PayPal event processed: db down"
    );
  });

  it("records the failure, leaves the event unprocessed and rethrows the original error (F03)", async () => {
    fake.onRpc("mark_paypal_event_failed", {});
    const event = inboxEvent("CHECKOUT.ORDER.APPROVED", { order_id: null, custom_id: null });

    const error = await processAndRecordPaypalEvent(fake.client, event).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PaypalWebhookUnmatched);
    expect(fake.rpc).toHaveBeenCalledWith("mark_paypal_event_failed", { p_event_id: "WH-10", p_error: (error as Error).message });
    expect(fake.rpc).not.toHaveBeenCalledWith("mark_paypal_event_processed", expect.anything());
  });

  it("logs a failure mark that could not be written and still rethrows the processing error", async () => {
    fake.onRpc("mark_paypal_event_failed", { error: { message: "db down" } });
    resolvesTo(payment({ status: "created" }));
    write("payments");
    capture.captureApprovedOrder.mockRejectedValue("socket closed");

    await expect(processAndRecordPaypalEvent(fake.client, inboxEvent("CHECKOUT.ORDER.APPROVED"))).rejects.toBe("socket closed");

    expect(fake.rpc).toHaveBeenCalledWith("mark_paypal_event_failed", { p_event_id: "WH-10", p_error: "socket closed" });
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_WEBHOOK_MARK_FAILED]", { eventId: "WH-10", error: "db down" });
  });
});
