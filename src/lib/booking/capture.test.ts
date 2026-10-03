// @vitest-environment node
/**
 * Unit tests for the deposit's payment flow. capture.postgrest-integration.test.ts
 * proves the behaviour against the live stack; these pin the same outcomes,
 * guarded writes (fields and from-statuses) and PayPal calls against the fake
 * client so CI, which has no local Supabase, covers every branch.
 *
 * The fake throws on any query or rpc that was not queued, so the exact list
 * of tables touched (`touched()`) also proves which writes did NOT happen.
 */
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  bookingRow,
  createBookingSupabaseFake,
  type BookingSupabaseFake,
  type FakeQuery,
} from "@/test/booking-supabase-fake";
import type { PaypalCapture, PaypalOrder } from "@/lib/paypal/types";

const paypal = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  captureOrder: vi.fn(),
  refundCapture: vi.fn(),
}));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  return { ...types, ...paypal };
});
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

const { PaypalError, PaypalNotConfigured } = await import("@/lib/paypal/types");
const { captureApprovedOrder, compensateCapturedPayment, ensurePaymentOrder, finalizeCaptured } = await import("./capture");
const { CAPTURABLE, RECORDABLE } = await import("./payment-state");
const { bookingLink } = await import("./links");
const { BookingError } = await import("./types");

const ID = bookingRow().id;
const ORDER_ID = "ORDER-1";
const CAPTURE_ID = "CAP-1";
const KEY = "op-key-1";
const APPROVE_URL = "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-1";
const COMPENSATE_FLAGS = ["pending_payment", "expired", "needs_attention"];
const DEFAULT_FLAGS = ["pending_payment", "expired"];
const CHANGED = { data: [{ id: "x" }] };
const LOST = { data: [] };
const ISO = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

const liveHold = () => ({ id: "hold-1", consumed_at: null, released_at: null, expires_at: new Date(Date.now() + 600_000).toISOString() });
const lapsedHold = () => ({ id: "hold-1", consumed_at: null, released_at: null, expires_at: new Date(Date.now() - 1_000).toISOString() });

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay-1",
    booking_id: ID,
    status: "created",
    order_id: ORDER_ID,
    approve_url: APPROVE_URL,
    capture_id: null,
    operation_key: KEY,
    amount_cents: 3000,
    currency: "EUR",
    ...overrides,
  };
}

function capture(overrides: Partial<PaypalCapture> = {}): PaypalCapture {
  return { id: CAPTURE_ID, status: "COMPLETED", amountCents: 3000, currency: "EUR", customId: ID, orderId: null, ...overrides };
}

function order(overrides: Partial<PaypalOrder> = {}): PaypalOrder {
  return { id: ORDER_ID, status: "APPROVED", amountCents: 3000, currency: "EUR", customId: ID, capture: null, approveUrl: null, ...overrides };
}

const completed = (captureOverrides: Partial<PaypalCapture> = {}, overrides: Partial<PaypalOrder> = {}) =>
  order({ status: "COMPLETED", capture: capture(captureOverrides), ...overrides });

let fake: BookingSupabaseFake;

/** Queues loadState's two reads: the booking (with hold and experience) and its latest payment. */
function queueState(options: {
  booking?: Record<string, unknown>;
  hold?: Record<string, unknown>;
  payment?: Record<string, unknown> | null;
  experience?: { title: string } | null;
} = {}) {
  const { booking = {}, hold = liveHold(), payment = paymentRow(), experience = { title: "Walk" } } = options;
  const bookings = fake.onTable("bookings", { data: { ...bookingRow(booking), hold, experience } });
  const payments = fake.onTable("payments", { data: payment });
  return { bookings, payments };
}

/** Queues one guarded UPDATE's reply. */
const write = (table: "payments" | "bookings", changed = true) => fake.onTable(table, changed ? CHANGED : LOST);

function expectWrite(query: FakeQuery, id: string, fields: Record<string, unknown>, from: string[]) {
  expect(query.update).toHaveBeenCalledWith(fields);
  expect(query.eq).toHaveBeenCalledWith("id", id);
  expect(query.in).toHaveBeenCalledWith("status", from);
}

/** Every table queried, in order. */
const touched = () => (fake.client.from as unknown as Mock).mock.calls.map((call) => call[0]);
/** Every rpc called, in order. */
const rpcs = () => fake.rpc.mock.calls.map((call) => call[0]);

beforeAll(() => {
  vi.stubEnv("BOOKING_LINK_SECRET", "unit-test-secret-that-is-at-least-32-bytes-long");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");
});

beforeEach(() => {
  vi.clearAllMocks();
  fake = createBookingSupabaseFake();
  paypal.refundCapture.mockImplementation(async (captureId: string) => ({ id: `REFUND-${captureId}`, status: "PENDING" }));
});

describe("loadState (through captureApprovedOrder)", () => {
  it("reads the booking with its hold and experience, and the latest payment", async () => {
    const { bookings, payments } = queueState({ booking: { status: "confirmed" } });

    await captureApprovedOrder(fake.client, ID, "return");

    expect(bookings.select).toHaveBeenCalledWith("*, hold:holds(*), experience:experiences(title)");
    expect(bookings.eq).toHaveBeenCalledWith("id", ID);
    expect(payments.eq).toHaveBeenCalledWith("booking_id", ID);
    expect(payments.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(payments.limit).toHaveBeenCalledWith(1);
  });

  it("throws on a booking read error, an unknown booking and a payment read error", async () => {
    fake.onTable("bookings", { error: { message: "b-boom" } });
    fake.onTable("payments", { data: null });
    await expect(captureApprovedOrder(fake.client, ID, "return")).rejects.toThrow("Failed to load booking: b-boom");

    fake.onTable("bookings", { data: null });
    fake.onTable("payments", { data: null });
    const missing = captureApprovedOrder(fake.client, ID, "return");
    await expect(missing).rejects.toBeInstanceOf(BookingError);
    await expect(missing).rejects.toMatchObject({ code: "not_found" });

    fake.onTable("bookings", { data: { ...bookingRow(), hold: liveHold(), experience: null } });
    fake.onTable("payments", { error: { message: "p-boom" } });
    await expect(captureApprovedOrder(fake.client, ID, "return")).rejects.toThrow("Failed to load payment: p-boom");
  });
});

describe("captureApprovedOrder (F02)", () => {
  it("approved -> approved, capture_pending, captured with the payment's key -> confirmed", async () => {
    queueState();
    const approved = write("payments");
    const pending = write("payments");
    const captured = write("payments");
    fake.onRpc("consume_hold_and_confirm", { data: null });
    paypal.getOrder.mockResolvedValue(order());
    paypal.captureOrder.mockResolvedValue(completed());

    expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("confirmed");

    expect(paypal.getOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(paypal.captureOrder).toHaveBeenCalledWith(ORDER_ID, KEY);
    expectWrite(approved, "pay-1", { status: "approved" }, ["created"]);
    expectWrite(pending, "pay-1", { status: "capture_pending" }, ["approved", "capture_pending"]);
    expectWrite(captured, "pay-1", { status: "captured", capture_id: CAPTURE_ID, captured_at: ISO }, RECORDABLE);
    expect(fake.rpc).toHaveBeenCalledWith("consume_hold_and_confirm", { p_booking_id: ID, p_capture_id: CAPTURE_ID });
    expect(touched()).toEqual(["bookings", "payments", "payments", "payments", "payments"]);
    expect(rpcs()).toEqual(["consume_hold_and_confirm"]);
  });

  it("a return URL for another order is a mismatch, without asking PayPal or flagging the booking", async () => {
    queueState();

    expect(await captureApprovedOrder(fake.client, ID, "return", "SOME-OTHER-ORDER")).toBe("mismatch");
    expect(paypal.getOrder).not.toHaveBeenCalled();
    expect(touched()).toEqual(["bookings", "payments"]);
  });

  it("an expected order with no payment yet is also a mismatch", async () => {
    queueState({ payment: null });

    expect(await captureApprovedOrder(fake.client, ID, "return", ORDER_ID)).toBe("mismatch");
  });

  it("the matching expected order proceeds (a confirmed booking short-circuits)", async () => {
    queueState({ booking: { status: "confirmed" } });

    expect(await captureApprovedOrder(fake.client, ID, "return", ORDER_ID)).toBe("confirmed");
  });

  it("a confirmed booking is a no-op: no PayPal call, no write", async () => {
    queueState({ booking: { status: "confirmed" }, payment: paymentRow({ status: "captured", capture_id: CAPTURE_ID }) });

    expect(await captureApprovedOrder(fake.client, ID, "webhook")).toBe("confirmed");
    expect(paypal.getOrder).not.toHaveBeenCalled();
    expect(paypal.captureOrder).not.toHaveBeenCalled();
    expect(touched()).toEqual(["bookings", "payments"]);
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["no payment", null],
    ["a payment without an order", paymentRow({ order_id: null, approve_url: null })],
  ])("%s is awaiting approval", async (_label, payment) => {
    queueState({ payment });

    expect(await captureApprovedOrder(fake.client, ID, "webhook")).toBe("awaiting_approval");
    expect(paypal.getOrder).not.toHaveBeenCalled();
  });

  it.each(["refund_pending", "refunded", "refund_failed"])("a %s payment never reaches PayPal or the booking again", async (status) => {
    queueState({ payment: paymentRow({ status, capture_id: `CAP-${status}` }) });

    expect(await captureApprovedOrder(fake.client, ID, "webhook")).toBe("compensating");
    expect(paypal.getOrder).not.toHaveBeenCalled();
    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(touched()).toEqual(["bookings", "payments"]);
  });

  it("a captured payment is finalized without asking PayPal", async () => {
    queueState({ hold: lapsedHold(), payment: paymentRow({ status: "captured", capture_id: "CAP-LAPSED" }) });
    fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
    fake.onRpc("reacquire_hold", { data: true });
    fake.onRpc("consume_hold_and_confirm", { data: null });

    expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("confirmed");
    expect(paypal.getOrder).not.toHaveBeenCalled();
    expect(paypal.refundCapture).not.toHaveBeenCalled();
    expect(fake.rpc).toHaveBeenCalledWith("consume_hold_and_confirm", { p_booking_id: ID, p_capture_id: "CAP-LAPSED" });
    expect(rpcs()).toEqual(["consume_hold_and_confirm", "reacquire_hold", "consume_hold_and_confirm"]);
  });

  it("a captured payment without a capture id asks PayPal and records the capture", async () => {
    queueState({ payment: paymentRow({ status: "captured", capture_id: null }) });
    const captured = write("payments");
    fake.onRpc("consume_hold_and_confirm", { data: null });
    paypal.getOrder.mockResolvedValue(completed());

    expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("confirmed");
    expectWrite(captured, "pay-1", { status: "captured", capture_id: CAPTURE_ID, captured_at: ISO }, RECORDABLE);
  });

  describe("an order PayPal already COMPLETED", () => {
    it("R2-01: a COMPLETED order on an expired payment is still recorded and confirmed, never captured again", async () => {
      queueState({ booking: { status: "expired" }, hold: lapsedHold(), payment: paymentRow({ status: "expired" }) });
      const captured = write("payments");
      fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
      fake.onRpc("reacquire_hold", { data: true });
      fake.onRpc("consume_hold_and_confirm", { data: null });
      paypal.getOrder.mockResolvedValue(completed());

      expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("confirmed");
      expectWrite(captured, "pay-1", { status: "captured", capture_id: CAPTURE_ID, captured_at: ISO }, RECORDABLE);
      expect(paypal.captureOrder).not.toHaveBeenCalled();
    });

    it("R2-01 oracle: captured, response lost, hold lapsed, slot taken -> refunded with the payment's key, never expired", async () => {
      queueState({ hold: lapsedHold(), payment: paymentRow({ status: "capture_pending" }) });
      const captured = write("payments");
      fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
      fake.onRpc("reacquire_hold", { data: false });
      const compensate = write("payments");
      const flag = write("bookings");
      const refundId = write("payments");
      paypal.getOrder.mockResolvedValue(completed());

      expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("compensating");

      expectWrite(captured, "pay-1", { status: "captured", capture_id: CAPTURE_ID, captured_at: ISO }, RECORDABLE);
      expectWrite(compensate, "pay-1", { status: "refund_pending", capture_id: CAPTURE_ID, compensation_reason: "slot_gone" }, RECORDABLE);
      expectWrite(flag, ID, { status: "needs_attention" }, COMPENSATE_FLAGS);
      expectWrite(refundId, "pay-1", { refund_id: `REFUND-${CAPTURE_ID}` }, ["refund_pending"]);
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(paypal.refundCapture).toHaveBeenCalledTimes(1);
      expect(paypal.refundCapture).toHaveBeenCalledWith(CAPTURE_ID, 3000, KEY);
      expect(touched()).toEqual(["bookings", "payments", "payments", "payments", "bookings", "payments"]);
      for (const query of [captured, compensate, refundId]) {
        expect(query.update).not.toHaveBeenCalledWith(expect.objectContaining({ status: "expired" }));
      }
    });

    it.each([
      ["amount", { amountCents: 100 }],
      ["currency", { currency: "USD" }],
      ["custom_id", { customId: "someone-else" }],
    ])("a %s mismatch is refunded as order_mismatch and never written as captured", async (_label, overrides) => {
      queueState();
      const compensate = write("payments");
      const flag = write("bookings");
      const refundId = write("payments");
      paypal.getOrder.mockResolvedValue(completed({}, overrides));

      expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("compensating");

      expectWrite(compensate, "pay-1", { status: "refund_pending", capture_id: CAPTURE_ID, compensation_reason: "order_mismatch" }, RECORDABLE);
      expectWrite(flag, ID, { status: "needs_attention" }, COMPENSATE_FLAGS);
      expect(refundId.update).toHaveBeenCalledWith({ refund_id: `REFUND-${CAPTURE_ID}` });
      expect(touched()).toEqual(["bookings", "payments", "payments", "bookings", "payments"]);
      expect([compensate, refundId].some((q) => q.update.mock.calls.some(([fields]) => fields.status === "captured"))).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("[PAYPAL_CAPTURE_MISMATCH]", { bookingId: ID, orderId: ORDER_ID, source: "reconcile", captured: true });
      expect(fake.rpc).not.toHaveBeenCalled();
    });

    it("a COMPLETED order whose capture is still PENDING stays capture_pending and is not confirmed", async () => {
      queueState();
      const pending = write("payments");
      paypal.getOrder.mockResolvedValue(completed({ status: "PENDING" }));

      expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("pending");
      expectWrite(pending, "pay-1", { status: "capture_pending", capture_id: CAPTURE_ID }, CAPTURABLE);
      expect(touched()).toEqual(["bookings", "payments", "payments"]);
      expect(fake.rpc).not.toHaveBeenCalled();
    });

    it("COMPLETED with no capture in the reply is treated as not approved", async () => {
      queueState();
      paypal.getOrder.mockResolvedValue(order({ status: "COMPLETED", capture: null }));

      expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("awaiting_approval");
      expect(touched()).toEqual(["bookings", "payments"]);
    });
  });

  describe("an order not APPROVED", () => {
    it("VOIDED with a capture_pending payment -> capture_failed, booking flagged, failed", async () => {
      queueState({ payment: paymentRow({ status: "capture_pending" }) });
      const failed = write("payments");
      const flag = write("bookings");
      paypal.getOrder.mockResolvedValue(order({ status: "VOIDED" }));

      expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("failed");
      expectWrite(failed, "pay-1", { status: "capture_failed" }, ["capture_pending"]);
      expectWrite(flag, ID, { status: "needs_attention" }, DEFAULT_FLAGS);
    });

    it.each([
      ["VOIDED", "created"],
      ["PAYER_ACTION_REQUIRED", "created"],
      ["CREATED", "capture_pending"],
    ])("%s with a %s payment is awaiting approval, with no write and no capture", async (status, paymentStatus) => {
      queueState({ payment: paymentRow({ status: paymentStatus }) });
      paypal.getOrder.mockResolvedValue(order({ status }));

      expect(await captureApprovedOrder(fake.client, ID, "webhook")).toBe("awaiting_approval");
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(touched()).toEqual(["bookings", "payments"]);
    });
  });

  describe("an APPROVED order", () => {
    it.each([
      ["capture_failed", "failed"],
      ["expired", "slot_gone"],
      ["captured", "slot_gone"],
    ])("a late approval of a %s payment is never captured -> %s", async (status, outcome) => {
      queueState({ booking: { status: "expired" }, hold: lapsedHold(), payment: paymentRow({ status }) });
      paypal.getOrder.mockResolvedValue(order());

      expect(await captureApprovedOrder(fake.client, ID, "return")).toBe(outcome);
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(touched()).toEqual(["bookings", "payments"]);
      expect(fake.rpc).not.toHaveBeenCalled();
    });

    it.each([
      ["amount", { amountCents: 100 }],
      ["currency", { currency: "USD" }],
      ["custom_id", { customId: "someone-else" }],
    ])("a %s mismatch never captures and flags the booking", async (_label, overrides) => {
      queueState();
      const flag = write("bookings");
      paypal.getOrder.mockResolvedValue(order(overrides));

      expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("mismatch");
      expectWrite(flag, ID, { status: "needs_attention" }, DEFAULT_FLAGS);
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(touched()).toEqual(["bookings", "payments", "bookings"]);
      expect(logger.error).toHaveBeenCalledWith("[PAYPAL_CAPTURE_MISMATCH]", { bookingId: ID, orderId: ORDER_ID, source: "return", captured: false });
    });

    it("hold lapsed but re-acquired -> captured and confirmed", async () => {
      queueState({ hold: lapsedHold() });
      write("payments");
      fake.onRpc("reacquire_hold", { data: true });
      const pending = write("payments");
      write("payments");
      fake.onRpc("consume_hold_and_confirm", { data: null });
      paypal.getOrder.mockResolvedValue(order());
      paypal.captureOrder.mockResolvedValue(completed());

      expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("confirmed");
      expect(fake.rpc).toHaveBeenCalledWith("reacquire_hold", { p_booking_id: ID });
      expectWrite(pending, "pay-1", { status: "capture_pending" }, ["approved", "capture_pending"]);
      expect(rpcs()).toEqual(["reacquire_hold", "consume_hold_and_confirm"]);
    });

    it("a re-acquire error throws before any capture", async () => {
      queueState({ hold: lapsedHold() });
      write("payments");
      fake.onRpc("reacquire_hold", { error: { message: "db down" } });
      paypal.getOrder.mockResolvedValue(order());

      await expect(captureApprovedOrder(fake.client, ID, "reconcile")).rejects.toThrow("Failed to re-acquire hold: db down");
      expect(paypal.captureOrder).not.toHaveBeenCalled();
    });

    it("slot gone with a capture possibly in flight (capture_pending) stays pending, nothing expired", async () => {
      queueState({ hold: lapsedHold(), payment: paymentRow({ status: "capture_pending" }) });
      write("payments", false);
      fake.onRpc("reacquire_hold", { data: false });
      paypal.getOrder.mockResolvedValue(order());

      expect(await captureApprovedOrder(fake.client, ID, "reconcile")).toBe("pending");
      expect(paypal.captureOrder).not.toHaveBeenCalled();
      expect(touched()).toEqual(["bookings", "payments", "payments"]);
    });

    it("uncaptured order with the slot gone -> payment and booking expired, nothing captured (R2-01)", async () => {
      queueState({ hold: lapsedHold() });
      write("payments");
      fake.onRpc("reacquire_hold", { data: false });
      const expirePayment = write("payments");
      const expireBooking = write("bookings");
      paypal.getOrder.mockResolvedValue(order());

      expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("slot_gone");
      expectWrite(expirePayment, "pay-1", { status: "expired" }, ["created", "approved"]);
      expectWrite(expireBooking, ID, { status: "expired" }, ["pending_payment"]);
      expect(paypal.captureOrder).not.toHaveBeenCalled();
    });

    it("when the guarded expire did not change the payment, the booking is left alone", async () => {
      queueState({ hold: lapsedHold() });
      write("payments");
      fake.onRpc("reacquire_hold", { data: false });
      write("payments", false);
      paypal.getOrder.mockResolvedValue(order());

      expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("slot_gone");
      expect(touched()).toEqual(["bookings", "payments", "payments", "payments"]);
    });

    it.each([
      ["an Error", new Error("TimeoutError"), "TimeoutError"],
      ["a non-Error", "socket hang up", "socket hang up"],
    ])("a capture call that throws %s leaves capture_pending (R2-02)", async (_label, thrown, message) => {
      queueState();
      write("payments");
      const pending = write("payments");
      paypal.getOrder.mockResolvedValue(order());
      paypal.captureOrder.mockRejectedValue(thrown);

      expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("pending");
      expectWrite(pending, "pay-1", { status: "capture_pending" }, ["approved", "capture_pending"]);
      expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_CAPTURE_PENDING]", { bookingId: ID, source: "return", error: message });
      expect(touched()).toEqual(["bookings", "payments", "payments", "payments"]);
    });

    it("a capture reply without a capture is pending", async () => {
      queueState();
      write("payments");
      write("payments");
      paypal.getOrder.mockResolvedValue(order());
      paypal.captureOrder.mockResolvedValue(order({ status: "COMPLETED", capture: null }));

      expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("pending");
      expect(touched()).toEqual(["bookings", "payments", "payments", "payments"]);
    });

    it.each(["DECLINED", "FAILED"])("a %s capture is the only route to capture_failed", async (status) => {
      queueState();
      write("payments");
      write("payments");
      const failed = write("payments");
      const flag = write("bookings");
      paypal.getOrder.mockResolvedValue(order());
      paypal.captureOrder.mockResolvedValue(completed({ id: "CAP-DECLINED", status }));

      expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("failed");
      expectWrite(failed, "pay-1", { status: "capture_failed", capture_id: "CAP-DECLINED" }, CAPTURABLE);
      expectWrite(flag, ID, { status: "needs_attention" }, DEFAULT_FLAGS);
      expect(fake.rpc).not.toHaveBeenCalled();
    });

    it("a PENDING capture from the capture call stays capture_pending with its id", async () => {
      queueState();
      write("payments");
      write("payments");
      const pending = write("payments");
      paypal.getOrder.mockResolvedValue(order());
      paypal.captureOrder.mockResolvedValue(completed({ status: "PENDING" }));

      expect(await captureApprovedOrder(fake.client, ID, "return")).toBe("pending");
      expectWrite(pending, "pay-1", { status: "capture_pending", capture_id: CAPTURE_ID }, CAPTURABLE);
    });
  });
});

describe("finalizeCaptured", () => {
  const booking = { id: ID };
  const payment = paymentRow({ status: "captured", capture_id: CAPTURE_ID });

  /** Queues compensateCapturedPayment's three writes. */
  function queueCompensation() {
    return { compensate: write("payments"), flag: write("bookings"), refundId: write("payments") };
  }

  it("confirms with the capture id", async () => {
    fake.onRpc("consume_hold_and_confirm", { data: null });

    expect(await finalizeCaptured(fake.client, booking, payment)).toBe("confirmed");
    expect(fake.rpc).toHaveBeenCalledWith("consume_hold_and_confirm", { p_booking_id: ID, p_capture_id: CAPTURE_ID });
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it("hold_not_live -> re-acquires once and retries", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
    fake.onRpc("reacquire_hold", { data: true });
    fake.onRpc("consume_hold_and_confirm", { data: null });

    expect(await finalizeCaptured(fake.client, booking, payment)).toBe("confirmed");
    expect(rpcs()).toEqual(["consume_hold_and_confirm", "reacquire_hold", "consume_hold_and_confirm"]);
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("hold_not_live and the slot is gone -> refunded as slot_gone, no retry", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
    fake.onRpc("reacquire_hold", { data: false });
    const { compensate } = queueCompensation();

    expect(await finalizeCaptured(fake.client, booking, payment)).toBe("compensating");
    expect(compensate.update).toHaveBeenCalledWith({ status: "refund_pending", capture_id: CAPTURE_ID, compensation_reason: "slot_gone" });
    expect(rpcs()).toEqual(["consume_hold_and_confirm", "reacquire_hold"]);
  });

  it("a re-acquire refused with invalid_state is tolerated and compensates as slot_gone", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
    fake.onRpc("reacquire_hold", { error: { message: "invalid_state" } });
    const { compensate } = queueCompensation();

    expect(await finalizeCaptured(fake.client, booking, payment)).toBe("compensating");
    expect(compensate.update).toHaveBeenCalledWith(expect.objectContaining({ compensation_reason: "slot_gone" }));
  });

  it("any other re-acquire error throws", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
    fake.onRpc("reacquire_hold", { error: { message: "db down" } });

    await expect(finalizeCaptured(fake.client, booking, payment)).rejects.toThrow("Failed to re-acquire hold: db down");
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("re-acquired but the retry still finds no live hold -> refunded as slot_gone", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
    fake.onRpc("reacquire_hold", { data: true });
    fake.onRpc("consume_hold_and_confirm", { error: { message: "hold_not_live" } });
    const { compensate } = queueCompensation();

    expect(await finalizeCaptured(fake.client, booking, payment)).toBe("compensating");
    expect(compensate.update).toHaveBeenCalledWith(expect.objectContaining({ compensation_reason: "slot_gone" }));
  });

  it("invalid_state is already compensating: no write, no refund", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "invalid_state" } });

    expect(await finalizeCaptured(fake.client, booking, payment)).toBe("compensating");
    expect(fake.client.from).not.toHaveBeenCalled();
    expect(paypal.refundCapture).not.toHaveBeenCalled();
  });

  it("capture_mismatch (a second capture for a confirmed booking) is refunded as duplicate_capture", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "capture_mismatch" } });
    const { compensate } = queueCompensation();

    expect(await finalizeCaptured(fake.client, booking, payment)).toBe("compensating");
    expect(compensate.update).toHaveBeenCalledWith({ status: "refund_pending", capture_id: CAPTURE_ID, compensation_reason: "duplicate_capture" });
    expect(paypal.refundCapture).toHaveBeenCalledWith(CAPTURE_ID, 3000, KEY);
  });

  it("an unknown confirm error throws", async () => {
    fake.onRpc("consume_hold_and_confirm", { error: { message: "weird" } });

    await expect(finalizeCaptured(fake.client, booking, payment)).rejects.toThrow("Failed to confirm booking: weird");
    expect(fake.client.from).not.toHaveBeenCalled();
  });
});

describe("compensateCapturedPayment", () => {
  const booking = { id: ID };
  const payment = paymentRow({ status: "captured", capture_id: CAPTURE_ID });

  it("records capture, refund intent and reason in one write, then refunds once and stores the refund id", async () => {
    const compensate = write("payments");
    const flag = write("bookings");
    const refundId = write("payments");

    expect(await compensateCapturedPayment(fake.client, booking, payment, "slot_gone")).toBe("compensating");

    expectWrite(compensate, "pay-1", { status: "refund_pending", capture_id: CAPTURE_ID, compensation_reason: "slot_gone" }, RECORDABLE);
    expect(compensate.update).toHaveBeenCalledTimes(1);
    expectWrite(flag, ID, { status: "needs_attention" }, COMPENSATE_FLAGS);
    expect(paypal.refundCapture).toHaveBeenCalledTimes(1);
    expect(paypal.refundCapture).toHaveBeenCalledWith(CAPTURE_ID, 3000, KEY);
    expectWrite(refundId, "pay-1", { refund_id: `REFUND-${CAPTURE_ID}` }, ["refund_pending"]);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_COMPENSATING]", { bookingId: ID, paymentId: "pay-1", reason: "slot_gone" });
    expect(logger.error).not.toHaveBeenCalledWith("[PAYPAL_REFUND_FAILED]", expect.anything());
  });

  it.each([
    ["an Error", new PaypalError("timeout"), "timeout"],
    ["a non-Error", "socket hang up", "socket hang up"],
  ])("a refund call failing with %s is logged, leaves refund_pending, and is still compensating", async (_label, thrown, message) => {
    write("payments");
    write("bookings");
    paypal.refundCapture.mockRejectedValue(thrown);

    expect(await compensateCapturedPayment(fake.client, booking, payment, "order_mismatch")).toBe("compensating");
    expect(touched()).toEqual(["payments", "bookings"]);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_REFUND_FAILED]", { bookingId: ID, paymentId: "pay-1", error: message });
  });
});

describe("ensurePaymentOrder", () => {
  const createdOrder = { orderId: ORDER_ID, approveUrl: APPROVE_URL };
  const link = () => `https://paisaxe.es${bookingLink({ id: ID, linkVersion: 1 })}`;

  it.each(["expired", "confirmed", "needs_attention"])("refuses a %s booking as invalid_state", async (status) => {
    queueState({ booking: { status } });

    await expect(ensurePaymentOrder(fake.client, ID)).rejects.toMatchObject({ code: "invalid_state" });
    expect(paypal.createOrder).not.toHaveBeenCalled();
  });

  it("refuses when the hold has expired", async () => {
    queueState({ hold: lapsedHold() });

    await expect(ensurePaymentOrder(fake.client, ID)).rejects.toMatchObject({ code: "hold_expired" });
    expect(paypal.createOrder).not.toHaveBeenCalled();
  });

  it.each(["capture_pending", "captured"])("never creates a second order while the payment is %s", async (status) => {
    queueState({ payment: paymentRow({ status }) });

    await expect(ensurePaymentOrder(fake.client, ID)).rejects.toMatchObject({ code: "payment_in_progress" });
    expect(paypal.createOrder).not.toHaveBeenCalled();
    expect(touched()).toEqual(["bookings", "payments"]);
  });

  it.each(["created", "approved"])("reuses the open %s order without calling PayPal", async (status) => {
    const hold = liveHold();
    queueState({ hold, payment: paymentRow({ status }) });

    expect(await ensurePaymentOrder(fake.client, ID)).toEqual({ approveUrl: APPROVE_URL, amountCents: 3000, currency: "EUR", expiresAt: hold.expires_at });
    expect(paypal.createOrder).not.toHaveBeenCalled();
    expect(touched()).toEqual(["bookings", "payments"]);
  });

  it("creates the first payment and order with the operation key and the capability return/cancel URLs", async () => {
    const hold = liveHold();
    queueState({ hold, payment: null });
    const insert = fake.onTable("payments", { data: paymentRow({ order_id: null, approve_url: null, operation_key: "new-key" }) });
    const store = fake.onTable("payments", { data: null });
    paypal.createOrder.mockResolvedValue(createdOrder);

    const result = await ensurePaymentOrder(fake.client, ID);

    expect(result).toEqual({ approveUrl: APPROVE_URL, amountCents: 3000, currency: "EUR", expiresAt: hold.expires_at });
    expect(insert.insert).toHaveBeenCalledWith({ booking_id: ID, amount_cents: 3000, currency: "EUR" });
    expect(insert.single).toHaveBeenCalled();
    expect(paypal.createOrder).toHaveBeenCalledTimes(1);
    expect(paypal.createOrder).toHaveBeenCalledWith({
      bookingId: ID,
      amountCents: 3000,
      currency: "EUR",
      description: "Walk (demo)",
      returnUrl: `${link()}/return`,
      cancelUrl: `${link()}?cancelled=1`,
      operationKey: "new-key",
    });
    expect(paypal.createOrder.mock.calls[0][0].returnUrl).toMatch(new RegExp(`^https://paisaxe\\.es/booking/${ID}\\.[A-Za-z0-9_-]{43}/return$`));
    expect(store.update).toHaveBeenCalledWith({ order_id: ORDER_ID, approve_url: APPROVE_URL });
    expect(store.eq).toHaveBeenCalledWith("id", "pay-1");
  });

  it("a booking without an experience title still gets a description", async () => {
    queueState({ payment: null, experience: null });
    fake.onTable("payments", { data: paymentRow({ order_id: null }) });
    fake.onTable("payments", { data: null });
    paypal.createOrder.mockResolvedValue(createdOrder);

    await ensurePaymentOrder(fake.client, ID);
    expect(paypal.createOrder.mock.calls[0][0].description).toBe(" (demo)");
  });

  it("a payment whose order was never created is continued with its own key, without a new row", async () => {
    queueState({ payment: paymentRow({ id: "pay-open", status: "created", order_id: null, approve_url: null, operation_key: "open-key" }) });
    const store = fake.onTable("payments", { data: null });
    paypal.createOrder.mockResolvedValue(createdOrder);

    expect((await ensurePaymentOrder(fake.client, ID)).approveUrl).toBe(APPROVE_URL);
    expect(paypal.createOrder.mock.calls[0][0].operationKey).toBe("open-key");
    expect(store.insert).not.toHaveBeenCalled();
    expect(store.eq).toHaveBeenCalledWith("id", "pay-open");
    expect(touched()).toEqual(["bookings", "payments", "payments"]);
  });

  it("an ended payment (expired) gets a fresh payment row", async () => {
    queueState({ payment: paymentRow({ status: "expired" }) });
    const insert = fake.onTable("payments", { data: paymentRow({ id: "pay-2", order_id: null, operation_key: "fresh-key" }) });
    fake.onTable("payments", { data: null });
    paypal.createOrder.mockResolvedValue(createdOrder);

    await ensurePaymentOrder(fake.client, ID);
    expect(insert.insert).toHaveBeenCalled();
    expect(paypal.createOrder.mock.calls[0][0].operationKey).toBe("fresh-key");
  });

  it("a concurrent insert that loses (23505) continues the winner's open payment", async () => {
    queueState({ payment: null });
    fake.onTable("payments", { error: { message: "duplicate key", code: "23505" } });
    const open = fake.onTable("payments", { data: paymentRow({ id: "pay-winner", order_id: null, operation_key: "winner-key" }) });
    const store = fake.onTable("payments", { data: null });
    paypal.createOrder.mockResolvedValue(createdOrder);

    expect((await ensurePaymentOrder(fake.client, ID)).approveUrl).toBe(APPROVE_URL);
    expect(open.eq).toHaveBeenCalledWith("booking_id", ID);
    expect(open.eq).toHaveBeenCalledWith("status", "created");
    expect(paypal.createOrder.mock.calls[0][0].operationKey).toBe("winner-key");
    expect(store.eq).toHaveBeenCalledWith("id", "pay-winner");
  });

  it.each([
    ["no open row", { data: null }],
    ["a read error", { error: { message: "boom" } }],
  ])("a lost insert with %s is payment_in_progress, without calling PayPal", async (_label, reply) => {
    queueState({ payment: null });
    fake.onTable("payments", { error: { message: "duplicate key", code: "23505" } });
    fake.onTable("payments", reply);

    await expect(ensurePaymentOrder(fake.client, ID)).rejects.toMatchObject({ code: "payment_in_progress" });
    expect(paypal.createOrder).not.toHaveBeenCalled();
  });

  it("any other insert error throws", async () => {
    queueState({ payment: null });
    fake.onTable("payments", { error: { message: "check violation", code: "23514" } });

    await expect(ensurePaymentOrder(fake.client, ID)).rejects.toThrow("Failed to create payment: check violation");
    expect(paypal.createOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["PaypalError", () => new PaypalError("INTERNAL_SERVER_ERROR", { status: 500 })],
    ["PaypalNotConfigured", () => new PaypalNotConfigured()],
  ])("a %s from createOrder is payment_unavailable, nothing stored, PayPal's message only in the log", async (_label, makeError) => {
    queueState({ payment: paymentRow({ order_id: null, approve_url: null }) });
    const error = makeError();
    paypal.createOrder.mockRejectedValue(error);

    const failure = ensurePaymentOrder(fake.client, ID);
    await expect(failure).rejects.toBeInstanceOf(BookingError);
    await expect(failure).rejects.toMatchObject({ code: "payment_unavailable", message: "payment_unavailable" });
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_CREATE_ORDER_FAILED]", { bookingId: ID, error: error.message });
    expect(touched()).toEqual(["bookings", "payments"]);
  });

  it("a non-PayPal error from createOrder is rethrown unchanged", async () => {
    queueState({ payment: paymentRow({ order_id: null, approve_url: null }) });
    const boom = new TypeError("bad input");
    paypal.createOrder.mockRejectedValue(boom);

    await expect(ensurePaymentOrder(fake.client, ID)).rejects.toBe(boom);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("a failure to store the order is rethrown, not reported as payment_unavailable", async () => {
    queueState({ payment: paymentRow({ order_id: null, approve_url: null }) });
    fake.onTable("payments", { error: { message: "store failed" } });
    paypal.createOrder.mockResolvedValue(createdOrder);

    await expect(ensurePaymentOrder(fake.client, ID)).rejects.toThrow("Failed to store the order: store failed");
  });
});
