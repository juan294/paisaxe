// @vitest-environment node
/**
 * The balance invoice against the live local stack (PayPal hackathon plan,
 * Phase 8a): the send_balance_invoice tool as the acting user (ownership,
 * confirmed only, idempotent by bookings.invoice_id) and the
 * INVOICING.INVOICE.PAID webhook through the inbox, where the balance is paid
 * only when the invoice read from PayPal is settled in full. PayPal is the
 * local mock server reached through the real adapter (no module mock).
 * Requires `supabase start`; self-skips otherwise.
 */
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import {
  isLocalSupabaseReachable,
  localServiceClient,
  psql,
  sqlList,
  warnLocalSupabaseUnreachable,
} from "@/test/local-supabase";

const { createOrder } = await import("@/lib/paypal");
const { resetPaypalClientForTests } = await import("@/lib/paypal/client");
const { executeBookingTool } = await import("./tools");
const { normalizePaypalEvent, processAndRecordPaypalEvent } = await import("./webhook-events");
const { addDays, madridDate, mapBooking } = await import("./types");
const { confirmCancellation } = await import("./cancel");
const { reconcileBookings } = await import("./reconcile");

const dbReachable = await isLocalSupabaseReachable();
if (!dbReachable) warnLocalSupabaseUnreachable("invoice.postgrest-integration.test.ts");

const MERCHANT = "b0080000-0000-4000-8000-000000000001";
const EXPERIENCE = "b0080000-0000-4000-8000-000000000011";
const USER = "b0080000-0000-4000-8000-0000000000a1";
const OTHER_USER = "b0080000-0000-4000-8000-0000000000a2";
const PAYER = "visitor-b008@personal.example.com";
const EVENT_PREFIX = "WH-B008-";
const INVOICES = "/v2/invoicing/invoices";
let dayOffset = 40;
let mock: PaypalMock;

function cleanup(): void {
  psql(
    `DELETE FROM public.paypal_webhook_events WHERE event_id LIKE '${EVENT_PREFIX}%';` +
      `DELETE FROM public.payments WHERE booking_id IN (SELECT id FROM public.bookings WHERE experience_id = '${EXPERIENCE}');` +
      `DELETE FROM public.bookings WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.holds WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.quotes WHERE experience_id = '${EXPERIENCE}';` +
      `DELETE FROM public.booking_drafts WHERE user_id IN (${sqlList([USER, OTHER_USER])});` +
      `DELETE FROM public.experiences WHERE id = '${EXPERIENCE}';` +
      `DELETE FROM public.merchants WHERE id = '${MERCHANT}';` +
      `DELETE FROM public.user_profiles WHERE user_id IN (${sqlList([USER, OTHER_USER])});` +
      `DELETE FROM auth.users WHERE id IN (${sqlList([USER, OTHER_USER])});`
  );
}

/** A booking accepted by USER on a fresh date; pending_payment until paid. */
function acceptedBooking(): { id: string; date: string } {
  const date = addDays(madridDate(new Date()), dayOffset++);
  const draftId = psql(`INSERT INTO public.booking_drafts (user_id, status) VALUES ('${USER}', 'abandoned') RETURNING id;`).split("\n")[0];
  const quoteId = psql(
    `INSERT INTO public.quotes (draft_id, user_id, experience_id, version, slot_date, slot_time, party_size, ` +
      `total_cents, deposit_cents, currency, cancellation_window_hours, expires_at) VALUES (` +
      `'${draftId}', '${USER}', '${EXPERIENCE}', 1, '${date}', '10:00', 2, 12000, 3000, 'EUR', 24, now() + interval '20 minutes') RETURNING id;`
  ).split("\n")[0];
  return { id: psql(`SELECT (public.accept_quote('${quoteId}', '${USER}')).id;`), date };
}

/** A booking whose 30 EUR deposit PAYER paid at the mock PayPal (order approved and captured), then confirmed. */
async function confirmedBooking(): Promise<{ id: string; date: string }> {
  const booking = acceptedBooking();
  const { orderId } = await createOrder({
    bookingId: booking.id,
    amountCents: 3000,
    currency: "EUR",
    description: "IT (demo)",
    returnUrl: "https://paisaxe.test/r",
    cancelUrl: "https://paisaxe.test/c",
    operationKey: randomBytes(8).toString("hex"),
  });
  mock.approve(orderId, PAYER);
  const capture = mock.complete(orderId);
  psql(
    `INSERT INTO public.payments (booking_id, amount_cents, currency, status, order_id) VALUES ('${booking.id}', 3000, 'EUR', 'capture_pending', '${orderId}');` +
      `SELECT public.consume_hold_and_confirm('${booking.id}', '${capture.id}');`
  );
  return booking;
}

const invoiceRow = (id: string) =>
  psql(
    `SELECT coalesce(invoice_id, '-') || '|' || coalesce(invoice_status, '-') || '|' || coalesce(invoice_url, '-') || '|' || ` +
      `(balance_paid_at IS NOT NULL)::text FROM public.bookings WHERE id = '${id}';`
  ).split("|");

const bookingOf = (id: string) => mapBooking(JSON.parse(psql(`SELECT row_to_json(b) FROM public.bookings b WHERE id = '${id}';`)));
const bookingStatus = (id: string) => psql(`SELECT status FROM public.bookings WHERE id = '${id}';`);
const cancelPath = (invoiceId: string) => `${INVOICES}/${invoiceId}/cancel`;
/** A confirmed booking whose balance invoice was sent; returns the invoice id too. */
async function invoicedBooking(): Promise<{ id: string; invoiceId: string }> {
  const { id } = await confirmedBooking();
  await sendInvoice(id);
  return { id, invoiceId: invoiceRow(id)[0] };
}

const ctx = (userId = USER) => ({ userId, redemptionId: "r-b008", client: localServiceClient() });
const sendInvoice = (bookingId: string, userId = USER) => executeBookingTool(ctx(userId), "send_balance_invoice", { bookingId });

/** Records an invoicing event in the inbox as the route does, then processes it. */
async function deliverInvoicePaid(invoiceId: string, eventType = "INVOICING.INVOICE.PAID") {
  const payload = {
    id: `${EVENT_PREFIX}${randomBytes(6).toString("hex")}`,
    event_type: eventType,
    resource_type: "invoices",
    resource: { invoice: { id: invoiceId } },
  };
  const event = normalizePaypalEvent(payload);
  if (!event) throw new Error("event did not normalize");
  const client = localServiceClient();
  const { error } = await client.rpc("upsert_paypal_event", {
    p_event_id: event.event_id,
    p_event_type: event.event_type,
    p_payload: event.payload,
    p_order_id: null,
    p_capture_id: null,
    p_refund_id: null,
    p_custom_id: null,
    p_verification: "SUCCESS",
  });
  if (error) throw new Error(error.message);
  const outcome = await processAndRecordPaypalEvent(client, event);
  const processed = psql(`SELECT (processed_at IS NOT NULL)::text FROM public.paypal_webhook_events WHERE event_id = '${event.event_id}';`);
  return { outcome, processed };
}

describe.skipIf(!dbReachable)("balance invoice against live local Supabase and the PayPal mock", () => {
  beforeAll(() => {
    cleanup();
    psql(
      `INSERT INTO auth.users (id, email) VALUES ('${USER}', '${USER}@invoice-it.test'), ('${OTHER_USER}', '${OTHER_USER}@invoice-it.test') ` +
        `ON CONFLICT (id) DO NOTHING;`
    );
    psql(
      `INSERT INTO public.merchants (id, slug, name, timezone, cancellation_window_hours, is_fixture) ` +
        `VALUES ('${MERCHANT}', 'it-invoice-merchant', 'IT', 'Europe/Madrid', 24, true);`
    );
    psql(
      `INSERT INTO public.experiences (id, merchant_id, slug, title, price_cents, deposit_cents, max_party, capacity_per_slot, slot_rule) ` +
        `VALUES ('${EXPERIENCE}', '${MERCHANT}', 'it-invoice-exp', 'IT experience', 12000, 3000, 4, 4, '{"weekdays":[1,2,3,4,5,6,7],"start_times":["10:00"]}');`
    );
  });

  afterAll(() => cleanup());

  beforeEach(async () => {
    // Salted ids: the shared database keeps other runs' order, capture and invoice ids.
    mock = await startPaypalMock({ idSalt: `B008${randomBytes(4).toString("hex").toUpperCase()}` });
    vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("PAYPAL_API_BASE", mock.baseUrl);
    resetPaypalClientForTests();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    resetPaypalClientForTests();
    await mock.close();
  });

  it("invoices the balance to the deposit's payer, due the slot date; a repeat creates and sends nothing more", async () => {
    const { id, date } = await confirmedBooking();

    const first = await sendInvoice(id);

    expect(first.isError).toBe(false);
    const [invoiceId, status, url, paid] = invoiceRow(id);
    expect(status).toBe("sent");
    expect(paid).toBe("false");
    expect(url).toBe(`https://www.sandbox.paypal.com/invoice/p/#${invoiceId}`);
    expect(mock.invoices.get(invoiceId)).toMatchObject({ recipientEmail: PAYER, amountCents: 9000, currency: "EUR", dueDate: date, status: "SENT" });
    expect(mock.requestsTo("POST", INVOICES)[0].headers["paypal-request-id"]).toBe(`invoice:${id}`);
    expect(first.result).toMatchObject({ invoice: "sent", alreadySent: false, balanceEuros: "90.00", dueDate: date });
    expect(JSON.stringify(first.result)).not.toMatch(/https?:\/\/|INV2-|@/);
    expect(first.card).toMatchObject({ kind: "invoice", bookingId: id, amountCents: 9000, status: "sent", invoiceUrl: url });

    const second = await sendInvoice(id);

    expect(second.result).toMatchObject({ invoice: "sent", alreadySent: true });
    expect(mock.requestsTo("POST", INVOICES)).toHaveLength(1);
    expect(mock.requestsTo("POST", /\/send$/)).toHaveLength(1);
    expect(mock.invoices.size).toBe(1);
    expect(invoiceRow(id)[0]).toBe(invoiceId);
  });

  it("refuses another user's booking: not_found, no PayPal call, nothing written", async () => {
    const { id } = await confirmedBooking();
    const before = mock.requests.length;

    expect(await sendInvoice(id, OTHER_USER)).toMatchObject({ isError: true, result: { error: "not_found" } });
    expect(mock.requests.length).toBe(before);
    expect(invoiceRow(id).slice(0, 2)).toEqual(["-", "-"]);
  });

  it("refuses a booking that is not confirmed", async () => {
    const { id } = acceptedBooking();

    expect(await sendInvoice(id)).toMatchObject({ isError: true, result: { error: "invalid_state" } });
    expect(mock.requestsTo("POST", INVOICES)).toHaveLength(0);
  });

  it("a full, settled payment of the invoice marks the balance paid (once, through the inbox)", async () => {
    const { id } = await confirmedBooking();
    await sendInvoice(id);
    const [invoiceId] = invoiceRow(id);
    mock.payInvoice(invoiceId);

    expect(await deliverInvoicePaid(invoiceId)).toEqual({ outcome: "recorded", processed: "true" });
    expect(invoiceRow(id)).toEqual([invoiceId, "paid", `https://www.sandbox.paypal.com/invoice/p/#${invoiceId}`, "true"]);

    const reads = mock.requestsTo("GET", `${INVOICES}/${invoiceId}`).length;
    expect(await deliverInvoicePaid(invoiceId)).toEqual({ outcome: "recorded", processed: "true" });
    expect(mock.requestsTo("GET", `${INVOICES}/${invoiceId}`)).toHaveLength(reads);
    expect((await sendInvoice(id)).result).toMatchObject({ invoice: "paid", alreadySent: true });
  });

  it("a partial payment does not mark the balance paid; paying the rest does", async () => {
    const { id } = await confirmedBooking();
    await sendInvoice(id);
    const [invoiceId] = invoiceRow(id);

    mock.payInvoice(invoiceId, { amountCents: 4000 });
    expect(await deliverInvoicePaid(invoiceId)).toEqual({ outcome: "unsettled", processed: "true" });
    expect(invoiceRow(id)).toEqual([invoiceId, "partially_paid", expect.any(String), "false"]);

    mock.payInvoice(invoiceId);
    expect(await deliverInvoicePaid(invoiceId)).toEqual({ outcome: "recorded", processed: "true" });
    expect(invoiceRow(id).slice(1)).toEqual(["paid", expect.any(String), "true"]);
  });

  it("a pending payment does not mark the balance paid", async () => {
    const { id } = await confirmedBooking();
    await sendInvoice(id);
    const [invoiceId] = invoiceRow(id);
    mock.payInvoice(invoiceId, { pending: true });

    expect(await deliverInvoicePaid(invoiceId)).toEqual({ outcome: "unsettled", processed: "true" });
    expect(invoiceRow(id)).toEqual([invoiceId, "payment_pending", expect.any(String), "false"]);
  });

  it("an event for an invoice no booking has stays unprocessed, tagged unmatched", async () => {
    await expect(deliverInvoicePaid("INV2-B008-UNKNOWN")).rejects.toThrow(/PAYPAL_WEBHOOK_UNMATCHED/);
    expect(
      psql(`SELECT count(*) FROM public.paypal_webhook_events WHERE event_id LIKE '${EVENT_PREFIX}%' AND processed_at IS NULL AND last_error LIKE '[PAYPAL_WEBHOOK_UNMATCHED]%';`)
    ).toBe("1");
  });

  it("the database refuses a paid balance without a paid invoice, and a second booking with the same invoice", async () => {
    const { id } = await confirmedBooking();
    const { id: other } = await confirmedBooking();

    expect(() => psql(`UPDATE public.bookings SET balance_paid_at = now() WHERE id = '${id}';`)).toThrow(/bookings_balance_paid_check/);
    expect(() => psql(`UPDATE public.bookings SET invoice_status = 'sent' WHERE id = '${id}';`)).toThrow(/bookings_invoice_pair_check/);
    psql(`UPDATE public.bookings SET invoice_id = 'INV2-B008-DUP', invoice_status = 'sent' WHERE id = '${id}';`);
    expect(() => psql(`UPDATE public.bookings SET invoice_id = 'INV2-B008-DUP', invoice_status = 'sent' WHERE id = '${other}';`)).toThrow(
      /bookings_invoice_id_key/
    );
  });
  describe("cancellation of an invoiced booking", () => {
    it("cancels a sent, unpaid invoice at PayPal and records it; only the deposit is refunded", async () => {
      const { id, invoiceId } = await invoicedBooking();

      expect(await confirmCancellation(localServiceClient(), bookingOf(id), 3000)).toMatchObject({ outcome: "cancelled", status: "refunded" });

      expect(mock.requestsTo("POST", cancelPath(invoiceId))).toHaveLength(1);
      expect(mock.invoices.get(invoiceId)?.status).toBe("CANCELLED");
      expect(invoiceRow(id).slice(1)).toEqual(["cancelled", expect.any(String), "false"]);
      expect([...mock.refunds.values()].map((refund) => refund.amount?.value)).toEqual(["30.00"]);
      expect(bookingStatus(id)).toBe("refunded");
    });

    it("never fails the cancellation when PayPal cannot cancel the invoice; reconciliation cancels it later", async () => {
      const { id, invoiceId } = await invoicedBooking();
      mock.injectNext({ method: "POST", path: cancelPath(invoiceId), status: 503, body: { name: "SERVICE_UNAVAILABLE", debug_id: "d" } });
      mock.injectNext({ method: "GET", path: `${INVOICES}/${invoiceId}`, status: 503, body: { name: "SERVICE_UNAVAILABLE", debug_id: "d" } });

      expect(await confirmCancellation(localServiceClient(), bookingOf(id), 3000)).toMatchObject({ outcome: "cancelled", status: "refunded" });
      expect(invoiceRow(id)[1]).toBe("sent");
      expect(mock.invoices.get(invoiceId)?.status).toBe("SENT");

      const summary = await reconcileBookings(localServiceClient(), { bookingIds: [id] });

      expect(summary).toMatchObject({ invoicesCancelled: 1, errors: 0 });
      expect(mock.invoices.get(invoiceId)?.status).toBe("CANCELLED");
      expect(invoiceRow(id)[1]).toBe("cancelled");
      expect((await reconcileBookings(localServiceClient(), { bookingIds: [id] })).invoicesCancelled).toBe(0);
    });

    it("a balance already paid is never refunded: the deposit alone is, and the completed cancellation is flagged for the operator", async () => {
      const { id, invoiceId } = await invoicedBooking();
      mock.payInvoice(invoiceId);
      await deliverInvoicePaid(invoiceId);

      await confirmCancellation(localServiceClient(), bookingOf(id), 3000);

      expect([...mock.refunds.values()].map((refund) => refund.amount?.value)).toEqual(["30.00"]);
      expect(mock.requestsTo("POST", cancelPath(invoiceId))).toHaveLength(0);
      expect(mock.invoices.get(invoiceId)?.status).toBe("PAID");
      expect(invoiceRow(id).slice(1)).toEqual(["paid", expect.any(String), "true"]);
      expect(bookingStatus(id)).toBe("needs_attention");
    });

    it("flags a paid balance only once the cancellation's refund completes (reconciliation)", async () => {
      const { id, invoiceId } = await invoicedBooking();
      mock.payInvoice(invoiceId);
      await deliverInvoicePaid(invoiceId);
      mock.setRefundStatus("PENDING");

      expect(await confirmCancellation(localServiceClient(), bookingOf(id), 3000)).toMatchObject({ status: "refund_pending" });
      expect(bookingStatus(id)).toBe("refund_pending");

      mock.setRefundStatus("COMPLETED");
      const summary = await reconcileBookings(localServiceClient(), { bookingIds: [id] });

      expect(summary).toMatchObject({ refunded: 1, flaggedForAttention: 1 });
      expect(bookingStatus(id)).toBe("needs_attention");
      expect([...mock.refunds.values()]).toHaveLength(1);
    });
  });

  describe("INVOICING.INVOICE.CANCELLED", () => {
    it("records an open invoice cancelled and nothing else; a redelivery changes nothing", async () => {
      const { id, invoiceId } = await invoicedBooking();

      expect(await deliverInvoicePaid(invoiceId, "INVOICING.INVOICE.CANCELLED")).toEqual({ outcome: "recorded", processed: "true" });
      expect(invoiceRow(id).slice(1)).toEqual(["cancelled", expect.any(String), "false"]);
      expect(bookingStatus(id)).toBe("confirmed");
      expect(await deliverInvoicePaid(invoiceId, "INVOICING.INVOICE.CANCELLED")).toEqual({ outcome: "recorded", processed: "true" });
    });

    it("never turns a paid balance into a cancelled invoice", async () => {
      const { id, invoiceId } = await invoicedBooking();
      mock.payInvoice(invoiceId);
      await deliverInvoicePaid(invoiceId);

      expect(await deliverInvoicePaid(invoiceId, "INVOICING.INVOICE.CANCELLED")).toEqual({ outcome: "out_of_order", processed: "true" });
      expect(invoiceRow(id).slice(1)).toEqual(["paid", expect.any(String), "true"]);
    });
  });
});
