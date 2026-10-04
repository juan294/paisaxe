// @vitest-environment node
/**
 * Invoicing v2 adapter (PayPal hackathon plan, Phase 8a) against the local
 * PayPal stand-in: wire format, idempotency by a fixed per-booking key, the
 * normalized invoice, and PayPal's failures as PaypalError.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startPaypalMock, type PaypalMock } from "@/test/paypal-mock-server";
import { getAccessToken, resetPaypalClientForTests } from "./client";
import { cancelInvoice, createInvoice, getInvoice, sendInvoice } from "./invoices";
import { PaypalError, PaypalNotConfigured, type CreateInvoiceInput } from "./types";

const BOOKING_ID = "b0080000-0000-4000-8000-0000000000b1";
const INVOICES = "/v2/invoicing/invoices";

const input: CreateInvoiceInput = {
  idempotencyKey: BOOKING_ID,
  reference: "RS-ABC123",
  recipientEmail: "buyer@example.com",
  amountCents: 9000,
  currency: "EUR",
  dueDate: "2026-11-21",
  itemName: "Paseo por la senda costera: resto de la reserva RS-ABC123",
};

let mock: PaypalMock;

beforeEach(async () => {
  mock = await startPaypalMock();
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

async function caught(promise: Promise<unknown>): Promise<PaypalError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(PaypalError);
    return error as PaypalError;
  }
  throw new Error("expected a rejection");
}

describe("createInvoice", () => {
  it("sends a draft invoice in PayPal's wire format with the per-booking request id and the token", async () => {
    await createInvoice(input);

    const [request] = mock.requestsTo("POST", INVOICES);
    expect(request.headers["paypal-request-id"]).toBe(`invoice:${BOOKING_ID}`);
    expect(request.headers.prefer).toBe("return=representation");
    expect(request.headers.authorization).toBe(`Bearer ${await getAccessToken()}`);
    expect(request.body).toEqual({
      detail: {
        currency_code: "EUR",
        reference: "RS-ABC123",
        // Spec: "Value is either but not both term_type or due_date."
        payment_term: { due_date: "2026-11-21" },
      },
      primary_recipients: [{ billing_info: { email_address: "buyer@example.com" } }],
      items: [
        {
          name: input.itemName,
          quantity: "1",
          unit_amount: { currency_code: "EUR", value: "90.00" },
          unit_of_measure: "AMOUNT",
        },
      ],
      configuration: { allow_tip: false, partial_payment: { allow_partial_payment: false } },
    });
  });

  it("returns the normalized draft", async () => {
    const invoice = await createInvoice(input);

    expect(invoice).toEqual({
      id: expect.stringMatching(/^INV2-/),
      status: "DRAFT",
      amountCents: 9000,
      currency: "EUR",
      dueAmountCents: 9000,
      paidAmountCents: null,
      reference: "RS-ABC123",
      recipientViewUrl: null,
    });
    expect(mock.invoices.get(invoice.id)).toMatchObject({ recipientEmail: "buyer@example.com", dueDate: "2026-11-21", amountCents: 9000 });
  });

  it("a retry with the same key returns the same invoice and PayPal creates one", async () => {
    const first = await createInvoice(input);
    const second = await createInvoice(input);

    expect(second.id).toBe(first.id);
    expect(mock.invoices.size).toBe(1);
  });

  it("reads the invoice when PayPal answers with only its self link (return=minimal)", async () => {
    const created = await createInvoice({ ...input, idempotencyKey: "other-booking" });
    mock.injectNext({
      method: "POST",
      path: INVOICES,
      status: 201,
      body: { rel: "self", href: `${mock.baseUrl}${INVOICES}/${created.id}`, method: "GET" },
    });

    const invoice = await createInvoice(input);

    expect(invoice.id).toBe(created.id);
    expect(mock.requestsTo("GET", `${INVOICES}/${created.id}`)).toHaveLength(1);
  });

  it("fails when PayPal answers 201 with neither an invoice nor a self link", async () => {
    mock.injectNext({ method: "POST", path: INVOICES, status: 201, body: { rel: "self" } });
    const error = await caught(createInvoice(input));
    expect(error).toMatchObject({ status: 201 });
    expect(error.message).toMatch(/no invoice id/);
  });

  it("fails with PayPal's status, issue and debug id on a 4xx", async () => {
    mock.injectNext({
      method: "POST",
      path: INVOICES,
      status: 422,
      body: { name: "UNPROCESSABLE_ENTITY", debug_id: "dbg-422", details: [{ issue: "INVALID_DUE_DATE" }] },
    });

    expect(await caught(createInvoice(input))).toMatchObject({ status: 422, issue: "INVALID_DUE_DATE", debugId: "dbg-422" });
  });

  it("rejects a non-positive or fractional amount before calling PayPal", async () => {
    await expect(createInvoice({ ...input, amountCents: 0 })).rejects.toThrow(RangeError);
    await expect(createInvoice({ ...input, amountCents: 10.5 })).rejects.toThrow(RangeError);
    expect(mock.requestsTo("POST", INVOICES)).toHaveLength(0);
  });
});

describe("sendInvoice", () => {
  it("sends to the recipient only, with the per-booking send request id, and returns the payer-view link", async () => {
    const { id } = await createInvoice(input);

    const sent = await sendInvoice(id, BOOKING_ID);

    const [request] = mock.requestsTo("POST", `${INVOICES}/${id}/send`);
    expect(request.headers["paypal-request-id"]).toBe(`invoice-send:${BOOKING_ID}`);
    expect(request.body).toEqual({ send_to_invoicer: false, send_to_recipient: true });
    expect(sent).toEqual({ recipientViewUrl: `https://www.sandbox.paypal.com/invoice/p/#${id}` });
    expect(mock.invoices.get(id)?.status).toBe("SENT");
  });

  it("a retry with the same key replays the first answer instead of failing on a sent invoice", async () => {
    const { id } = await createInvoice(input);
    const first = await sendInvoice(id, BOOKING_ID);
    expect(await sendInvoice(id, BOOKING_ID)).toEqual(first);
  });

  it("returns no link when PayPal accepts with an empty body (202) or a link of another rel", async () => {
    const { id } = await createInvoice(input);
    mock.injectNext({ method: "POST", path: `${INVOICES}/${id}/send`, status: 202, body: "" });
    expect(await sendInvoice(id, BOOKING_ID)).toEqual({ recipientViewUrl: null });

    mock.injectNext({ method: "POST", path: `${INVOICES}/${id}/send`, status: 200, body: { href: "https://x", rel: "self" } });
    expect(await sendInvoice(id, BOOKING_ID)).toEqual({ recipientViewUrl: null });
  });

  it("reads a 2xx body that is not JSON as no link", async () => {
    const { id } = await createInvoice(input);
    mock.injectNext({ method: "POST", path: `${INVOICES}/${id}/send`, status: 200, body: "accepted" });
    expect(await sendInvoice(id, BOOKING_ID)).toEqual({ recipientViewUrl: null });
  });

  it("fails with PayPal's 422 for an invoice that is no longer a draft (new request id)", async () => {
    const { id } = await createInvoice(input);
    await sendInvoice(id, BOOKING_ID);

    expect(await caught(sendInvoice(id, "another-key"))).toMatchObject({ status: 422, issue: "INVALID_INVOICE_STATUS" });
  });

  it("encodes the invoice id into the path", async () => {
    const error = await caught(sendInvoice("INV2/../x", BOOKING_ID));
    expect(error.status).toBe(404);
    expect(mock.requests.at(-1)?.path).toBe(`${INVOICES}/INV2%2F..%2Fx/send`);
  });
});

describe("cancelInvoice", () => {
  it("cancels a sent invoice and notifies the recipient only (204, no body)", async () => {
    const { id } = await createInvoice(input);
    await sendInvoice(id, BOOKING_ID);

    await expect(cancelInvoice(id)).resolves.toBeUndefined();

    const [request] = mock.requestsTo("POST", `${INVOICES}/${id}/cancel`);
    expect(request.body).toEqual({ send_to_invoicer: false, send_to_recipient: true });
    expect(request.headers.authorization).toBe(`Bearer ${await getAccessToken()}`);
    expect(mock.invoices.get(id)?.status).toBe("CANCELLED");
  });

  it("fails with PayPal's 422 for an invoice that cannot be cancelled (paid)", async () => {
    const { id } = await createInvoice(input);
    await sendInvoice(id, BOOKING_ID);
    mock.payInvoice(id);

    expect(await caught(cancelInvoice(id))).toMatchObject({ status: 422 });
    expect(mock.invoices.get(id)?.status).toBe("PAID");
  });

  it("fails with PayPal's 404 for an unknown invoice, with the id encoded into the path", async () => {
    expect(await caught(cancelInvoice("INV2/x"))).toMatchObject({ status: 404 });
    expect(mock.requests.at(-1)?.path).toBe(`${INVOICES}/INV2%2Fx/cancel`);
  });
});

describe("getInvoice", () => {
  async function sentInvoice(): Promise<string> {
    const { id } = await createInvoice(input);
    await sendInvoice(id, BOOKING_ID);
    return id;
  }

  it("normalizes a sent invoice with its payer link and everything due", async () => {
    const id = await sentInvoice();

    expect(await getInvoice(id)).toEqual({
      id,
      status: "SENT",
      amountCents: 9000,
      currency: "EUR",
      dueAmountCents: 9000,
      paidAmountCents: null,
      reference: "RS-ABC123",
      recipientViewUrl: `https://www.sandbox.paypal.com/invoice/p/#${id}`,
    });
  });

  it("reads a full payment: PAID, nothing due, the whole amount paid", async () => {
    const id = await sentInvoice();
    mock.payInvoice(id);

    expect(await getInvoice(id)).toMatchObject({ status: "PAID", dueAmountCents: 0, paidAmountCents: 9000 });
  });

  it("reads a partial payment: PARTIALLY_PAID with the rest due", async () => {
    const id = await sentInvoice();
    mock.payInvoice(id, { amountCents: 4000 });

    expect(await getInvoice(id)).toMatchObject({ status: "PARTIALLY_PAID", dueAmountCents: 5000, paidAmountCents: 4000 });
  });

  it("reads a pending payment: PAYMENT_PENDING, nothing paid, everything due", async () => {
    const id = await sentInvoice();
    mock.payInvoice(id, { pending: true });

    expect(await getInvoice(id)).toMatchObject({ status: "PAYMENT_PENDING", dueAmountCents: 9000, paidAmountCents: null });
  });

  it("fails on an unknown invoice with PayPal's 404", async () => {
    expect(await caught(getInvoice("INV2-NOPE"))).toMatchObject({ status: 404, issue: "INVALID_RESOURCE_ID" });
  });

  it.each([
    ["no status", { id: "INV2-A" }],
    ["no id", { status: "SENT" }],
    ["a body that is not an object", [1, 2]],
  ])("fails on an invoice with %s", async (_case, body) => {
    mock.injectNext({ method: "GET", path: `${INVOICES}/INV2-A`, status: 200, body });
    expect((await caught(getInvoice("INV2-A"))).message).toMatch(/without id or status/);
  });

  it("fails on an unreadable amount", async () => {
    mock.injectNext({
      method: "GET",
      path: `${INVOICES}/INV2-A`,
      status: 200,
      body: { id: "INV2-A", status: "PAID", amount: { currency_code: "EUR", value: "ninety" } },
    });
    expect((await caught(getInvoice("INV2-A"))).message).toMatch(/unreadable amount/);
  });

  it("reads absent money fields as null", async () => {
    mock.injectNext({ method: "GET", path: `${INVOICES}/INV2-A`, status: 200, body: { id: "INV2-A", status: "SENT", detail: {} } });
    expect(await getInvoice("INV2-A")).toEqual({
      id: "INV2-A",
      status: "SENT",
      amountCents: null,
      currency: null,
      dueAmountCents: null,
      paidAmountCents: null,
      reference: null,
      recipientViewUrl: null,
    });
  });

  it("fails with a null status when PayPal is unreachable", async () => {
    await getAccessToken();
    await mock.close();

    const error = await caught(getInvoice("INV2-A"));

    expect(error.status).toBeNull();
    mock = await startPaypalMock();
  });

  it("throws PaypalNotConfigured without credentials", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "");
    await expect(getInvoice("INV2-A")).rejects.toBeInstanceOf(PaypalNotConfigured);
    expect(mock.requests).toHaveLength(0);
  });
});
