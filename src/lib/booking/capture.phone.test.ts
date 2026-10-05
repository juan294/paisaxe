// @vitest-environment node
/**
 * The capture path's phone-confirmation branch (PayPal hackathon plan, Phase
 * 8b): for a merchant in confirmation_mode 'phone', ensurePaymentOrder creates
 * an AUTHORIZE order (or refuses when the flow is not configured) and
 * captureApprovedOrder hands the approval to the phone flow, never to
 * captureOrder. capture.test.ts, unchanged, pins the instant merchant's path.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingRow, createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";

const paypal = vi.hoisted(() => ({ createOrder: vi.fn(), getOrder: vi.fn(), captureOrder: vi.fn(), refundCapture: vi.fn() }));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  return { ...types, ...paypal };
});

const phone = vi.hoisted(() => ({ settleApprovedPhoneOrder: vi.fn() }));
vi.mock("./phone-confirmation", () => phone);

const config = vi.hoisted(() => ({ phoneConfirmationReadiness: vi.fn() }));
vi.mock("./phone-config", async (importOriginal) => ({ ...(await importOriginal<typeof import("./phone-config")>()), ...config }));

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

const { captureApprovedOrder, ensurePaymentOrder } = await import("./capture");
const { BookingError } = await import("./types");

const ID = bookingRow().id;
const PHONE_EXPERIENCE = { title: "Visita a una quesería artesana", merchant: { confirmation_mode: "phone" } };
const liveHold = () => ({ id: "hold-1", consumed_at: null, released_at: null, expires_at: new Date(Date.now() + 600_000).toISOString() });

function paymentRow(overrides: Record<string, unknown> = {}) {
  return { id: "pay-1", booking_id: ID, status: "created", order_id: "ORDER-1", approve_url: "https://pp/approve", capture_id: null, operation_key: "op-key-1", amount_cents: 4000, currency: "EUR", ...overrides };
}

let fake: BookingSupabaseFake;

function queueState(payment: Record<string, unknown> | null = paymentRow(), experience: unknown = PHONE_EXPERIENCE, booking: Record<string, unknown> = {}) {
  const bookings = fake.onTable("bookings", { data: { ...bookingRow({ deposit_cents: 4000, ...booking }), hold: liveHold(), experience } });
  fake.onTable("payments", { data: payment });
  return bookings;
}

beforeAll(() => {
  vi.stubEnv("BOOKING_LINK_SECRET", "unit-test-secret-that-is-at-least-32-bytes-long");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");
});

beforeEach(() => {
  vi.clearAllMocks();
  fake = createBookingSupabaseFake();
  config.phoneConfirmationReadiness.mockResolvedValue({ ready: true, phone: "+34612345678" });
});

describe("loadState", () => {
  it("reads the merchant's confirmation_mode with the experience", async () => {
    const bookings = queueState(null);
    await captureApprovedOrder(fake.client, ID, "return");
    expect(bookings.select).toHaveBeenCalledWith("*, hold:holds(*), experience:experiences(title, merchant:merchants(confirmation_mode))");
  });
});

describe("ensurePaymentOrder for a phone-confirmed merchant", () => {
  it("creates the deposit order with intent AUTHORIZE", async () => {
    queueState(null);
    fake.onTable("payments", { data: paymentRow() });
    fake.onTable("payments", {});
    paypal.createOrder.mockResolvedValue({ orderId: "ORDER-1", approveUrl: "https://pp/approve" });

    await ensurePaymentOrder(fake.client, ID);

    expect(paypal.createOrder).toHaveBeenCalledWith(expect.objectContaining({ intent: "AUTHORIZE", amountCents: 4000 }));
    expect(config.phoneConfirmationReadiness).toHaveBeenCalledTimes(1);
  });

  it.each(["not_configured", "booking_disabled"])("refuses with payment_unavailable when the flow is %s: no payment row, no order", async (reason) => {
    config.phoneConfirmationReadiness.mockResolvedValue({ ready: false, reason });
    queueState(null);

    await expect(ensurePaymentOrder(fake.client, ID)).rejects.toEqual(new BookingError("payment_unavailable"));

    expect(paypal.createOrder).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("[PHONE_CONFIRMATION_NOT_CONFIGURED]", { bookingId: ID, reason });
  });

  it.each(["authorized", "void_pending"])("a %s payment is payment_in_progress: never a second order", async (status) => {
    queueState(paymentRow({ status, authorization_id: "AUTH-1" }));
    await expect(ensurePaymentOrder(fake.client, ID)).rejects.toEqual(new BookingError("payment_in_progress"));
    expect(paypal.createOrder).not.toHaveBeenCalled();
  });

  it("an instant merchant's order carries no intent field (unchanged request)", async () => {
    queueState(null, { title: "Walk" });
    fake.onTable("payments", { data: paymentRow() });
    fake.onTable("payments", {});
    paypal.createOrder.mockResolvedValue({ orderId: "ORDER-1", approveUrl: "https://pp/approve" });

    await ensurePaymentOrder(fake.client, ID);

    expect(paypal.createOrder.mock.calls[0][0]).not.toHaveProperty("intent");
    expect(config.phoneConfirmationReadiness).not.toHaveBeenCalled();
  });
});

describe("captureApprovedOrder for a phone-confirmed merchant", () => {
  it("hands the approval to the phone flow and never captures the order", async () => {
    queueState(paymentRow({ status: "approved" }));
    phone.settleApprovedPhoneOrder.mockResolvedValue("pending");

    await expect(captureApprovedOrder(fake.client, ID, "webhook")).resolves.toBe("pending");

    expect(phone.settleApprovedPhoneOrder).toHaveBeenCalledWith(
      fake.client,
      expect.objectContaining({ booking: expect.objectContaining({ id: ID }), payment: expect.objectContaining({ id: "pay-1" }), hold: expect.any(Object) }),
      "webhook"
    );
    expect(paypal.getOrder).not.toHaveBeenCalled();
    expect(paypal.captureOrder).not.toHaveBeenCalled();
  });

  it("keeps the return page's order check before dispatching", async () => {
    queueState(paymentRow());
    await expect(captureApprovedOrder(fake.client, ID, "return", "ORDER-OTHER")).resolves.toBe("mismatch");
    expect(phone.settleApprovedPhoneOrder).not.toHaveBeenCalled();
  });

  it("a confirmed booking and a payment without an order answer before the phone flow", async () => {
    queueState(paymentRow(), PHONE_EXPERIENCE, { status: "confirmed" });
    await expect(captureApprovedOrder(fake.client, ID, "return")).resolves.toBe("confirmed");
    queueState(paymentRow({ order_id: null }));
    await expect(captureApprovedOrder(fake.client, ID, "return")).resolves.toBe("awaiting_approval");
    expect(phone.settleApprovedPhoneOrder).not.toHaveBeenCalled();
  });

  it("an instant merchant never reaches the phone flow", async () => {
    queueState(paymentRow({ status: "approved" }), { title: "Walk" });
    paypal.getOrder.mockResolvedValue({ id: "ORDER-1", status: "PAYER_ACTION_REQUIRED", amountCents: 4000, currency: "EUR", customId: ID, capture: null, approveUrl: null });
    await expect(captureApprovedOrder(fake.client, ID, "reconcile")).resolves.toBe("awaiting_approval");
    expect(phone.settleApprovedPhoneOrder).not.toHaveBeenCalled();
  });
});
