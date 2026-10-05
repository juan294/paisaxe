// @vitest-environment node
/**
 * The balance invoice (PayPal hackathon plan, Phase 8a) over the scripted
 * Supabase fake: each test pins the exact reads, the guarded writes and their
 * guards. PayPal is replaced at the adapter boundary; the adapter itself is
 * tested against the mock server (src/lib/paypal/invoices.test.ts) and the
 * whole path runs live in invoice.postgrest-integration.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bookingRow, createBookingSupabaseFake, type BookingSupabaseFake } from "@/test/booking-supabase-fake";
import type { PaypalInvoice } from "@/lib/paypal";

const paypal = vi.hoisted(() => ({
  getOrder: vi.fn(),
  createInvoice: vi.fn(),
  sendInvoice: vi.fn(),
  getInvoice: vi.fn(),
  cancelInvoice: vi.fn(),
}));
vi.mock("@/lib/paypal", async () => {
  const types = await vi.importActual<typeof import("@/lib/paypal/types")>("@/lib/paypal/types");
  return { ...types, ...paypal };
});

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger }));

const { PaypalError, PaypalNotConfigured } = await import("@/lib/paypal/types");
const { closeInvoiceAfterCancellation, closeInvoiceAfterCancellationSafely, markInvoiceCancelled, sendBalanceInvoice, settleBalanceInvoice } =
  await import("./invoice");
const { BookingError, mapBooking } = await import("./types");

const ID = "11111111-2222-4333-8444-555555555555";
const INVOICE_ID = "INV2-AAAA-BBBB-CCCC-DDDD";
const URL = `https://www.sandbox.paypal.com/invoice/p/#${INVOICE_ID}`;
const NOW = new Date("2026-11-01T10:00:00Z");

const confirmed = (overrides: Record<string, unknown> = {}) => mapBooking(bookingRow({ status: "confirmed", ...overrides }));
const noInvoice = { invoice_id: null, invoice_status: null, invoice_url: null };

function invoice(overrides: Partial<PaypalInvoice> = {}): PaypalInvoice {
  return {
    id: INVOICE_ID,
    status: "SENT",
    amountCents: 9000,
    currency: "EUR",
    dueAmountCents: 9000,
    paidAmountCents: null,
    reference: "RS-ABC123",
    recipientViewUrl: URL,
    ...overrides,
  };
}

let fake: BookingSupabaseFake;

beforeEach(() => {
  // Reset, not clear: a test that fails early leaves queued once-answers behind.
  vi.resetAllMocks();
  fake = createBookingSupabaseFake();
  paypal.getOrder.mockResolvedValue({ id: "ORDER-1", status: "COMPLETED", payerEmail: "buyer@example.com" });
  paypal.createInvoice.mockResolvedValue(invoice({ status: "DRAFT", recipientViewUrl: null }));
  paypal.sendInvoice.mockResolvedValue({ recipientViewUrl: URL });
  paypal.getInvoice.mockResolvedValue(invoice());
});

async function rejection(promise: Promise<unknown>): Promise<InstanceType<typeof BookingError>> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(BookingError);
  return error as InstanceType<typeof BookingError>;
}

/** The happy path's queue: state, captured payment, claim, sent. */
function queueFirstSend() {
  const state = fake.onTable("bookings", { data: noInvoice });
  const payment = fake.onTable("payments", { data: { order_id: "ORDER-1" } });
  const claim = fake.onTable("bookings", { data: [{ id: ID }] });
  const sent = fake.onTable("bookings", { data: [{ id: ID }] });
  return { state, payment, claim, sent };
}

describe("sendBalanceInvoice: creating and sending", () => {
  it("invoices the balance to the deposit payer, due the slot date, with the booking's fixed key, then sends it", async () => {
    const { state, payment, claim, sent } = queueFirstSend();

    const result = await sendBalanceInvoice(fake.client, confirmed(), NOW);

    expect(result).toEqual({ invoiceId: INVOICE_ID, status: "sent", url: URL, created: true });
    expect(state.eq).toHaveBeenCalledWith("id", ID);
    expect(payment.eq).toHaveBeenCalledWith("booking_id", ID);
    expect(payment.eq).toHaveBeenCalledWith("status", "captured");
    expect(paypal.getOrder).toHaveBeenCalledWith("ORDER-1");
    expect(paypal.createInvoice).toHaveBeenCalledWith({
      idempotencyKey: ID,
      reference: "RS-ABC123",
      recipientEmail: "buyer@example.com",
      amountCents: 9000,
      currency: "EUR",
      dueDate: "2026-11-21",
      itemName: "Resto de la reserva RS-ABC123 (demo)",
    });
    expect(claim.update).toHaveBeenCalledWith({ invoice_id: INVOICE_ID, invoice_status: "draft" });
    expect(claim.is).toHaveBeenCalledWith("invoice_id", null);
    expect(paypal.sendInvoice).toHaveBeenCalledWith(INVOICE_ID, ID);
    expect(sent.update).toHaveBeenCalledWith({ invoice_status: "sent", invoice_url: URL });
    expect(sent.eq).toHaveBeenCalledWith("invoice_status", "draft");
  });

  it("reads the payer link from the invoice when the send answer has none (202)", async () => {
    queueFirstSend();
    paypal.sendInvoice.mockResolvedValueOnce({ recipientViewUrl: null });

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toMatchObject({ status: "sent", url: URL });
    expect(paypal.getInvoice).toHaveBeenCalledWith(INVOICE_ID);
  });

  it("a send refused because the invoice already left draft (an earlier send whose answer was lost) counts as sent", async () => {
    queueFirstSend();
    paypal.sendInvoice.mockRejectedValueOnce(new PaypalError("422", { status: 422, issue: "INVALID_INVOICE_STATUS" }));

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toMatchObject({ status: "sent", url: URL });
  });

  it("continues a draft left by an earlier call without creating a second invoice", async () => {
    fake.onTable("bookings", { data: { invoice_id: INVOICE_ID, invoice_status: "draft", invoice_url: null } });
    fake.onTable("bookings", { data: [{ id: ID }] });

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toMatchObject({ status: "sent", created: true });
    expect(paypal.createInvoice).not.toHaveBeenCalled();
    expect(paypal.sendInvoice).toHaveBeenCalledWith(INVOICE_ID, ID);
  });

  it("a concurrent call that lost the claim continues the winner's invoice", async () => {
    fake.onTable("bookings", { data: noInvoice });
    fake.onTable("payments", { data: { order_id: "ORDER-1" } });
    fake.onTable("bookings", { data: [] });
    fake.onTable("bookings", { data: { invoice_id: INVOICE_ID, invoice_status: "sent", invoice_url: URL } });

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toEqual({ invoiceId: INVOICE_ID, status: "sent", url: URL, created: false });
    expect(paypal.sendInvoice).not.toHaveBeenCalled();
  });

  it("a claim answer without rows counts as lost", async () => {
    fake.onTable("bookings", { data: noInvoice });
    fake.onTable("payments", { data: { order_id: "ORDER-1" } });
    fake.onTable("bookings", { data: null });
    fake.onTable("bookings", { data: { invoice_id: INVOICE_ID, invoice_status: "sent", invoice_url: URL } });

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toMatchObject({ status: "sent", created: false });
  });

  it("logs a lost claim whose stored invoice is a different one, and keeps the stored one", async () => {
    fake.onTable("bookings", { data: noInvoice });
    fake.onTable("payments", { data: { order_id: "ORDER-1" } });
    fake.onTable("bookings", { data: [] });
    fake.onTable("bookings", { data: { invoice_id: "INV2-OTHER", invoice_status: "draft", invoice_url: null } });
    fake.onTable("bookings", { data: [{ id: ID }] });

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toMatchObject({ invoiceId: "INV2-OTHER", status: "sent" });
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_INVOICE_DUPLICATE]", { bookingId: ID, kept: "INV2-OTHER", orphan: INVOICE_ID });
    expect(paypal.sendInvoice).toHaveBeenCalledWith("INV2-OTHER", ID);
  });
});

describe("sendBalanceInvoice: an invoice that already exists (idempotent by bookings.invoice_id)", () => {
  it("returns a paid invoice as it is, with no PayPal call", async () => {
    fake.onTable("bookings", { data: { invoice_id: INVOICE_ID, invoice_status: "paid", invoice_url: URL } });

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toEqual({ invoiceId: INVOICE_ID, status: "paid", url: URL, created: false });
    expect(paypal.getInvoice).not.toHaveBeenCalled();
    expect(paypal.createInvoice).not.toHaveBeenCalled();
  });

  it("re-reads a sent invoice and reports what PayPal says now, never sending again", async () => {
    fake.onTable("bookings", { data: { invoice_id: INVOICE_ID, invoice_status: "sent", invoice_url: URL } });
    fake.onTable("bookings", { data: { id: ID, status: "confirmed", total_cents: 12000, deposit_cents: 3000, currency: "EUR", invoice_status: "sent", balance_paid_at: null } });
    fake.onTable("bookings", { data: [{ id: ID }] });
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "PAID", dueAmountCents: 0, paidAmountCents: 9000 }));

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toEqual({ invoiceId: INVOICE_ID, status: "paid", url: URL, created: false });
    expect(paypal.createInvoice).not.toHaveBeenCalled();
    expect(paypal.sendInvoice).not.toHaveBeenCalled();
  });

  it("keeps the stored status when PayPal cannot be read", async () => {
    fake.onTable("bookings", { data: { invoice_id: INVOICE_ID, invoice_status: "payment_pending", invoice_url: URL } });
    fake.onTable("bookings", { data: { id: ID, status: "confirmed", total_cents: 12000, deposit_cents: 3000, currency: "EUR", invoice_status: "payment_pending", balance_paid_at: null } });
    paypal.getInvoice.mockRejectedValueOnce(new PaypalError("down", { status: 503 }));

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toMatchObject({ status: "payment_pending", created: false });
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_INVOICE_REFRESH_FAILED]", { bookingId: ID, invoiceId: INVOICE_ID, error: "down" });
  });

  it("keeps the stored status when the stored invoice no longer resolves to the booking", async () => {
    fake.onTable("bookings", { data: { invoice_id: INVOICE_ID, invoice_status: "sent", invoice_url: URL } });
    fake.onTable("bookings", { data: null });

    expect(await sendBalanceInvoice(fake.client, confirmed(), NOW)).toMatchObject({ status: "sent", url: URL, created: false });
  });

  it("rethrows a database failure during the re-read", async () => {
    fake.onTable("bookings", { data: { invoice_id: INVOICE_ID, invoice_status: "sent", invoice_url: URL } });
    fake.onTable("bookings", { error: { message: "down" } });

    await expect(sendBalanceInvoice(fake.client, confirmed(), NOW)).rejects.toThrow("Failed to load the invoiced booking: down");
  });
});

describe("sendBalanceInvoice: refusals", () => {
  it.each(["pending_payment", "cancel_pending", "cancelled", "refunded", "needs_attention", "expired"])(
    "refuses a %s booking without reading anything",
    async (status) => {
      const error = await rejection(sendBalanceInvoice(fake.client, mapBooking(bookingRow({ status })), NOW));
      expect(error.code).toBe("invalid_state");
      expect(fake.client.from).not.toHaveBeenCalled();
    },
  );

  it("refuses a booking with no balance (deposit = total)", async () => {
    expect((await rejection(sendBalanceInvoice(fake.client, confirmed({ total_cents: 3000 }), NOW))).code).toBe("invalid_state");
    expect(fake.client.from).not.toHaveBeenCalled();
  });

  it("refuses to create an invoice for a slot date already past (Madrid calendar), but a same-day one is fine", async () => {
    fake.onTable("bookings", { data: noInvoice });
    const error = await rejection(sendBalanceInvoice(fake.client, confirmed({ slot_date: "2026-10-31" }), NOW));
    expect(error).toMatchObject({ code: "invalid_state", message: "the activity date has passed" });

    queueFirstSend();
    expect(await sendBalanceInvoice(fake.client, confirmed({ slot_date: "2026-11-01" }), NOW)).toMatchObject({ status: "sent" });
  });

  it("refuses without a captured payment to take the payer from", async () => {
    fake.onTable("bookings", { data: noInvoice });
    fake.onTable("payments", { data: null });

    expect((await rejection(sendBalanceInvoice(fake.client, confirmed(), NOW))).code).toBe("invalid_state");
    expect(paypal.getOrder).not.toHaveBeenCalled();
  });

  it("refuses when PayPal's order carries no payer email, and logs it", async () => {
    fake.onTable("bookings", { data: noInvoice });
    fake.onTable("payments", { data: { order_id: "ORDER-1" } });
    paypal.getOrder.mockResolvedValueOnce({ id: "ORDER-1", status: "COMPLETED" });

    expect((await rejection(sendBalanceInvoice(fake.client, confirmed(), NOW))).code).toBe("invalid_state");
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_INVOICE_NO_PAYER]", { bookingId: ID, orderId: "ORDER-1" });
    expect(paypal.createInvoice).not.toHaveBeenCalled();
  });

  it.each([
    ["a PaypalError", new PaypalError("PayPal createInvoice failed with HTTP 500", { status: 500 })],
    ["PaypalNotConfigured", new PaypalNotConfigured()],
  ])("answers payment_unavailable on %s and logs PayPal's message", async (_case, failure) => {
    fake.onTable("bookings", { data: noInvoice });
    fake.onTable("payments", { data: { order_id: "ORDER-1" } });
    paypal.createInvoice.mockRejectedValueOnce(failure);

    expect((await rejection(sendBalanceInvoice(fake.client, confirmed(), NOW))).code).toBe("payment_unavailable");
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_INVOICE_FAILED]", { bookingId: ID, error: failure.message });
  });

  it("answers payment_unavailable when the send fails and the invoice is still a draft (it stays draft for the next call)", async () => {
    fake.onTable("bookings", { data: noInvoice });
    fake.onTable("payments", { data: { order_id: "ORDER-1" } });
    fake.onTable("bookings", { data: [{ id: ID }] });
    paypal.sendInvoice.mockRejectedValueOnce(new PaypalError("timeout"));
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "DRAFT", recipientViewUrl: null }));

    expect((await rejection(sendBalanceInvoice(fake.client, confirmed(), NOW))).code).toBe("payment_unavailable");
  });

  it("rethrows anything that is not a PayPal failure", async () => {
    fake.onTable("bookings", { data: noInvoice });
    fake.onTable("payments", { data: { order_id: "ORDER-1" } });
    paypal.getOrder.mockRejectedValueOnce(new TypeError("boom"));

    await expect(sendBalanceInvoice(fake.client, confirmed(), NOW)).rejects.toThrow("boom");
  });

  it.each([
    ["the invoice state", [["bookings", { error: { message: "down" } }]], "Failed to load the booking invoice: down"],
    [
      "the captured payment",
      [["bookings", { data: noInvoice }], ["payments", { error: { message: "down" } }]],
      "Failed to load the captured payment: down",
    ],
    [
      "the claim",
      [["bookings", { data: noInvoice }], ["payments", { data: { order_id: "ORDER-1" } }], ["bookings", { error: { message: "down" } }]],
      "Failed to store the invoice: down",
    ],
    [
      "the sent mark",
      [
        ["bookings", { data: noInvoice }],
        ["payments", { data: { order_id: "ORDER-1" } }],
        ["bookings", { data: [{ id: ID }] }],
        ["bookings", { error: { message: "down" } }],
      ],
      "Failed to store the invoice: down",
    ],
  ] as const)("throws when %s cannot be read or written", async (_case, queue, message) => {
    for (const [table, result] of queue) fake.onTable(table, result);
    await expect(sendBalanceInvoice(fake.client, confirmed(), NOW)).rejects.toThrow(message);
  });
});

describe("settleBalanceInvoice: balance_paid only when PayPal says it is settled", () => {
  const invoiced = (overrides: Record<string, unknown> = {}) => ({
    data: { id: ID, status: "confirmed", total_cents: 12000, deposit_cents: 3000, currency: "EUR", invoice_status: "sent", balance_paid_at: null, ...overrides },
  });

  it("a full payment: PAID, nothing due, the whole balance paid -> balance paid, once", async () => {
    const load = fake.onTable("bookings", invoiced());
    const write = fake.onTable("bookings", { data: [{ id: ID }] });
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "PAID", dueAmountCents: 0, paidAmountCents: 9000 }));

    expect(await settleBalanceInvoice(fake.client, INVOICE_ID)).toBe("paid");
    expect(load.eq).toHaveBeenCalledWith("invoice_id", INVOICE_ID);
    expect(paypal.getInvoice).toHaveBeenCalledWith(INVOICE_ID);
    expect(write.update).toHaveBeenCalledWith({ invoice_status: "paid", balance_paid_at: expect.any(String) });
    expect(write.eq).toHaveBeenCalledWith("invoice_id", INVOICE_ID);
    expect(write.is).toHaveBeenCalledWith("balance_paid_at", null);
    expect(logger.info).toHaveBeenCalledWith("[PAYPAL_INVOICE_PAID]", { bookingId: ID, invoiceId: INVOICE_ID });
  });

  it("a partial payment: PARTIALLY_PAID with the rest due -> not paid, shown as partially paid", async () => {
    fake.onTable("bookings", invoiced());
    const write = fake.onTable("bookings", { data: [{ id: ID }] });
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "PARTIALLY_PAID", dueAmountCents: 5000, paidAmountCents: 4000 }));

    expect(await settleBalanceInvoice(fake.client, INVOICE_ID)).toBe("partially_paid");
    expect(write.update).toHaveBeenCalledWith({ invoice_status: "partially_paid" });
    expect(write.update).not.toHaveBeenCalledWith(expect.objectContaining({ balance_paid_at: expect.anything() }));
    expect(write.in).toHaveBeenCalledWith("invoice_status", ["sent", "payment_pending", "partially_paid"]);
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_INVOICE_UNSETTLED]", {
      bookingId: ID,
      invoiceId: INVOICE_ID,
      invoiceStatus: "PARTIALLY_PAID",
      dueAmountCents: 5000,
    });
  });

  it("a pending payment: PAYMENT_PENDING -> not paid, shown as pending", async () => {
    fake.onTable("bookings", invoiced());
    const write = fake.onTable("bookings", { data: [{ id: ID }] });
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "PAYMENT_PENDING", dueAmountCents: 9000, paidAmountCents: null }));

    expect(await settleBalanceInvoice(fake.client, INVOICE_ID)).toBe("payment_pending");
    expect(write.update).toHaveBeenCalledWith({ invoice_status: "payment_pending" });
  });

  it.each([
    ["something still due", { dueAmountCents: 100, paidAmountCents: 8900 }],
    ["no due amount at all", { dueAmountCents: null, paidAmountCents: 9000 }],
    ["less than the balance paid", { dueAmountCents: 0, paidAmountCents: 8000 }],
    ["an invoice total that is not the balance", { amountCents: 8000, dueAmountCents: 0, paidAmountCents: 8000 }],
    ["another currency", { currency: "USD", dueAmountCents: 0, paidAmountCents: 9000 }],
  ])("PAID with %s is not settled: nothing is written and it is logged as a mismatch", async (_case, overrides) => {
    fake.onTable("bookings", invoiced());
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "PAID", ...overrides }));

    expect(await settleBalanceInvoice(fake.client, INVOICE_ID)).toBe("sent");
    expect(fake.client.from).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_INVOICE_MISMATCH]", expect.objectContaining({ bookingId: ID, invoiceId: INVOICE_ID }));
  });

  it.each(["SENT", "UNPAID", "MARKED_AS_PAID", "CANCELLED", "REFUNDED"])("%s is not settled and changes nothing", async (status) => {
    fake.onTable("bookings", invoiced());
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status, dueAmountCents: 0, paidAmountCents: 9000 }));

    expect(await settleBalanceInvoice(fake.client, INVOICE_ID)).toBe("sent");
    expect(fake.client.from).toHaveBeenCalledTimes(1);
  });

  it("does not rewrite a status that is already the one PayPal reports", async () => {
    fake.onTable("bookings", invoiced({ invoice_status: "payment_pending" }));
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "PAYMENT_PENDING" }));

    expect(await settleBalanceInvoice(fake.client, INVOICE_ID)).toBe("payment_pending");
    expect(fake.client.from).toHaveBeenCalledTimes(1);
  });

  it("an already paid balance is not read again from PayPal", async () => {
    fake.onTable("bookings", invoiced({ invoice_status: "paid", balance_paid_at: "2026-11-02T10:00:00Z" }));

    expect(await settleBalanceInvoice(fake.client, INVOICE_ID)).toBe("paid");
    expect(paypal.getInvoice).not.toHaveBeenCalled();
  });

  it("records a balance paid on a booking that is no longer confirmed, and warns (money moved)", async () => {
    fake.onTable("bookings", invoiced({ status: "cancelled" }));
    fake.onTable("bookings", { data: [{ id: ID }] });
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "PAID", dueAmountCents: 0, paidAmountCents: 9000 }));

    expect(await settleBalanceInvoice(fake.client, INVOICE_ID)).toBe("paid");
    expect(logger.warn).toHaveBeenCalledWith("[PAYPAL_INVOICE_PAID_INACTIVE]", { bookingId: ID, invoiceId: INVOICE_ID, status: "cancelled" });
  });

  it("returns null for an invoice no booking has", async () => {
    fake.onTable("bookings", { data: null });
    expect(await settleBalanceInvoice(fake.client, "INV2-UNKNOWN")).toBeNull();
    expect(paypal.getInvoice).not.toHaveBeenCalled();
  });

  it.each([
    ["the booking read", [{ error: { message: "down" } }], "Failed to load the invoiced booking: down"],
    ["the paid write", [invoiced(), { error: { message: "down" } }], "Failed to record the balance payment: down"],
  ])("throws when %s fails", async (_case, results, message) => {
    for (const result of results) fake.onTable("bookings", result);
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "PAID", dueAmountCents: 0, paidAmountCents: 9000 }));
    await expect(settleBalanceInvoice(fake.client, INVOICE_ID)).rejects.toThrow(message);
  });

  it("throws when the unsettled status cannot be written", async () => {
    fake.onTable("bookings", invoiced());
    fake.onTable("bookings", { error: { message: "down" } });
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "PARTIALLY_PAID", dueAmountCents: 5000, paidAmountCents: 4000 }));
    await expect(settleBalanceInvoice(fake.client, INVOICE_ID)).rejects.toThrow("Failed to record the invoice status: down");
  });

  it("lets a PayPal failure through (the webhook answers 500 and PayPal redelivers)", async () => {
    fake.onTable("bookings", invoiced());
    paypal.getInvoice.mockRejectedValueOnce(new PaypalError("down", { status: 503 }));
    await expect(settleBalanceInvoice(fake.client, INVOICE_ID)).rejects.toBeInstanceOf(PaypalError);
  });
});

describe("closeInvoiceAfterCancellation: a cancelled booking's balance invoice", () => {
  const cancelledRow = (overrides: Record<string, unknown> = {}) => ({
    data: {
      id: ID,
      status: "cancel_pending",
      cancellation_confirmed_at: "2026-11-01T09:00:00Z",
      invoice_id: INVOICE_ID,
      invoice_status: "sent",
      ...overrides,
    },
  });

  it.each(["sent", "payment_pending"])("cancels a %s invoice at PayPal and records it cancelled", async (invoiceStatus) => {
    const load = fake.onTable("bookings", cancelledRow({ invoice_status: invoiceStatus }));
    const write = fake.onTable("bookings", { data: [{ id: ID }] });

    expect(await closeInvoiceAfterCancellation(fake.client, ID)).toBe("cancelled");
    expect(load.eq).toHaveBeenCalledWith("id", ID);
    expect(paypal.cancelInvoice).toHaveBeenCalledWith(INVOICE_ID);
    expect(write.update).toHaveBeenCalledWith({ invoice_status: "cancelled" });
    expect(write.in).toHaveBeenCalledWith("invoice_status", ["sent", "payment_pending"]);
    expect(logger.info).toHaveBeenCalledWith("[PAYPAL_INVOICE_CANCELLED]", { bookingId: ID, invoiceId: INVOICE_ID });
  });

  it("records a draft (never sent) cancelled without calling PayPal", async () => {
    fake.onTable("bookings", cancelledRow({ invoice_status: "draft" }));
    const write = fake.onTable("bookings", { data: [{ id: ID }] });

    expect(await closeInvoiceAfterCancellation(fake.client, ID)).toBe("cancelled");
    expect(paypal.cancelInvoice).not.toHaveBeenCalled();
    expect(write.eq).toHaveBeenCalledWith("invoice_status", "draft");
  });

  it.each([
    ["no invoice", { invoice_id: null, invoice_status: null }],
    ["an invoice already cancelled", { invoice_status: "cancelled" }],
    ["no confirmed cancellation", { cancellation_confirmed_at: null }],
  ])("does nothing for a booking with %s", async (_case, overrides) => {
    fake.onTable("bookings", cancelledRow(overrides));

    expect(await closeInvoiceAfterCancellation(fake.client, ID)).toBe("none");
    expect(paypal.cancelInvoice).not.toHaveBeenCalled();
    expect(fake.client.from).toHaveBeenCalledTimes(1);
  });

  it("a PayPal failure on an invoice that is in fact cancelled already (lost answer) still records it", async () => {
    fake.onTable("bookings", cancelledRow());
    fake.onTable("bookings", { data: [{ id: ID }] });
    paypal.cancelInvoice.mockRejectedValueOnce(new PaypalError("422", { status: 422 }));
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "CANCELLED" }));

    expect(await closeInvoiceAfterCancellation(fake.client, ID)).toBe("cancelled");
  });

  it("an invoice paid in full meanwhile is recorded paid, never refunded, and flagged once the cancellation is complete", async () => {
    fake.onTable("bookings", cancelledRow({ status: "cancelled" }));
    paypal.cancelInvoice.mockRejectedValueOnce(new PaypalError("422", { status: 422 }));
    paypal.getInvoice.mockResolvedValue(invoice({ status: "PAID", dueAmountCents: 0, paidAmountCents: 9000 }));
    // settleBalanceInvoice: load by invoice id, then the paid write.
    fake.onTable("bookings", { data: { id: ID, status: "cancelled", total_cents: 12000, deposit_cents: 3000, currency: "EUR", invoice_status: "sent", balance_paid_at: null } });
    fake.onTable("bookings", { data: [{ id: ID }] });
    // Then the booking is read again and flagged.
    fake.onTable("bookings", cancelledRow({ status: "cancelled", invoice_status: "paid" }));
    const flag = fake.onTable("bookings", { data: [{ id: ID }] });

    expect(await closeInvoiceAfterCancellation(fake.client, ID)).toBe("flagged");
    expect(flag.update).toHaveBeenCalledWith({ status: "needs_attention" });
  });

  it("rethrows a PayPal failure when the invoice is still open (reconciliation retries)", async () => {
    fake.onTable("bookings", cancelledRow());
    const failure = new PaypalError("503", { status: 503 });
    paypal.cancelInvoice.mockRejectedValueOnce(failure);
    paypal.getInvoice.mockResolvedValueOnce(invoice({ status: "SENT" }));

    await expect(closeInvoiceAfterCancellation(fake.client, ID)).rejects.toBe(failure);
    expect(fake.client.from).toHaveBeenCalledTimes(1);
  });

  it.each(["cancelled", "refunded"])(
    "a balance already paid is never refunded: a %s booking is flagged needs_attention for the operator and logged",
    async (status) => {
      fake.onTable("bookings", cancelledRow({ status, invoice_status: "paid" }));
      const flag = fake.onTable("bookings", { data: [{ id: ID }] });

      expect(await closeInvoiceAfterCancellation(fake.client, ID)).toBe("flagged");
      expect(flag.update).toHaveBeenCalledWith({ status: "needs_attention" });
      expect(flag.in).toHaveBeenCalledWith("status", ["cancelled", "refunded"]);
      expect(paypal.cancelInvoice).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith("[BOOKING_BALANCE_PAID_ON_CANCEL]", { bookingId: ID, invoiceId: INVOICE_ID, invoiceStatus: "paid" });
    },
  );

  it("a partially paid balance is treated like a paid one (money moved)", async () => {
    fake.onTable("bookings", cancelledRow({ status: "refunded", invoice_status: "partially_paid" }));
    fake.onTable("bookings", { data: [{ id: ID }] });

    expect(await closeInvoiceAfterCancellation(fake.client, ID)).toBe("flagged");
  });

  it.each(["cancel_pending", "refund_pending"])("waits for a %s cancellation to complete before flagging a paid balance", async (status) => {
    fake.onTable("bookings", cancelledRow({ status, invoice_status: "paid" }));

    expect(await closeInvoiceAfterCancellation(fake.client, ID)).toBe("awaiting_completion");
    expect(fake.client.from).toHaveBeenCalledTimes(1);
  });

  it("reports none when another caller flagged it first", async () => {
    fake.onTable("bookings", cancelledRow({ status: "cancelled", invoice_status: "paid" }));
    fake.onTable("bookings", { data: [] });

    expect(await closeInvoiceAfterCancellation(fake.client, ID)).toBe("none");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    ["the load", [{ error: { message: "down" } }], "Failed to load the booking invoice: down"],
    ["the cancelled mark", [cancelledRow(), { error: { message: "down" } }], "Failed to store the invoice: down"],
    ["the flag", [cancelledRow({ status: "cancelled", invoice_status: "paid" }), { error: { message: "down" } }], "Failed to update bookings: down"],
  ])("throws when %s fails", async (_case, results, message) => {
    for (const result of results) fake.onTable("bookings", result);
    await expect(closeInvoiceAfterCancellation(fake.client, ID)).rejects.toThrow(message);
  });
});

describe("closeInvoiceAfterCancellationSafely: the visitor's cancellation never fails on the invoice", () => {
  it("logs and reports failed instead of throwing, for a PayPal error or anything else", async () => {
    fake.onTable("bookings", { data: { id: ID, status: "cancelled", cancellation_confirmed_at: "x", invoice_id: INVOICE_ID, invoice_status: "sent" } });
    paypal.cancelInvoice.mockRejectedValueOnce(new PaypalNotConfigured());
    paypal.getInvoice.mockRejectedValueOnce(new PaypalNotConfigured());

    expect(await closeInvoiceAfterCancellationSafely(fake.client, ID)).toBe("failed");
    expect(logger.error).toHaveBeenCalledWith("[PAYPAL_INVOICE_CANCEL_FAILED]", { bookingId: ID, error: "PayPal is not configured" });

    fake.onTable("bookings", { error: { message: "down" } });
    expect(await closeInvoiceAfterCancellationSafely(fake.client, ID)).toBe("failed");
    fake.onTable("bookings", { data: null });
    paypal.cancelInvoice.mockRejectedValueOnce("socket");
    expect(await closeInvoiceAfterCancellationSafely(fake.client, ID)).toBe("none");
  });

  it("passes the outcome through when nothing fails", async () => {
    fake.onTable("bookings", { data: { id: ID, status: "cancelled", cancellation_confirmed_at: "x", invoice_id: null, invoice_status: null } });
    expect(await closeInvoiceAfterCancellationSafely(fake.client, ID)).toBe("none");
  });
});

describe("markInvoiceCancelled (INVOICING.INVOICE.CANCELLED)", () => {
  it("records an open invoice cancelled and changes nothing else", async () => {
    const write = fake.onTable("bookings", { data: [{ id: ID }] });

    expect(await markInvoiceCancelled(fake.client, INVOICE_ID)).toBe("cancelled");
    expect(write.update).toHaveBeenCalledWith({ invoice_status: "cancelled" });
    expect(write.eq).toHaveBeenCalledWith("invoice_id", INVOICE_ID);
    expect(write.in).toHaveBeenCalledWith("invoice_status", ["draft", "sent", "payment_pending"]);
    expect(paypal.getInvoice).not.toHaveBeenCalled();
  });

  it.each(["cancelled", "paid", "partially_paid"])("leaves a %s invoice as it is and reports its status", async (status) => {
    fake.onTable("bookings", { data: [] });
    fake.onTable("bookings", { data: { invoice_status: status } });

    expect(await markInvoiceCancelled(fake.client, INVOICE_ID)).toBe(status);
  });

  it("returns null for an invoice no booking has", async () => {
    fake.onTable("bookings", { data: null });
    fake.onTable("bookings", { data: null });
    expect(await markInvoiceCancelled(fake.client, INVOICE_ID)).toBeNull();
  });

  it.each([
    ["the write", [{ error: { message: "down" } }]],
    ["the read", [{ data: [] }, { error: { message: "down" } }]],
  ])("throws when %s fails", async (_case, results) => {
    for (const result of results) fake.onTable("bookings", result);
    await expect(markInvoiceCancelled(fake.client, INVOICE_ID)).rejects.toThrow(/down/);
  });
});
