/**
 * Invoicing v2 for the booking balance (PayPal hackathon plan, Phase 8a).
 *
 * The pinned SDK has no invoicing surface, so these are plain fetches that
 * share the adapter's token cache, host guard and timeout, like webhooks.ts.
 *
 * PayPal-Request-Id carries a key fixed per booking: "invoice:" + key on
 * create and "invoice-send:" + key on send. The Invoicing v2 spec does not
 * list that header for these operations, so it is best effort; the booking
 * code's guarantee is bookings.invoice_id (set once) and re-reading the
 * invoice after a failed send.
 *
 * Every failure is a PaypalError (status, issue, debug id) or
 * PaypalNotConfigured; nothing here logs.
 */
import "server-only";

import { createPaypalFetch, getAccessToken, httpError, paypalTimeoutMs, paypalTransportError } from "./client";
import { getPaypalConfig } from "./env";
import { centsToValue, valueToCents } from "./money";
import { PaypalError, type CreateInvoiceInput, type PaypalInvoice } from "./types";

const INVOICES_PATH = "/v2/invoicing/invoices";
const INVOICE_ID_RE = /\/v2\/invoicing\/invoices\/([^/?#]+)$/;

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** One Invoicing request: JSON in, the parsed body (or null) and HTTP status out; non-2xx throws. */
async function invoicingRequest(
  operation: string,
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; requestId?: string } = {},
): Promise<{ body: unknown; status: number }> {
  const config = getPaypalConfig();
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  if (options.requestId) headers["PayPal-Request-Id"] = options.requestId;
  if (method === "POST" && path === INVOICES_PATH) headers.Prefer = "return=representation";

  const response = await createPaypalFetch(config.baseUrl)(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(paypalTimeoutMs()),
  }).catch((error: unknown) => {
    throw paypalTransportError(error, operation);
  });

  const raw = await response.text().catch(() => "");
  if (!response.ok) throw httpError(operation, response, raw);
  let body: unknown = null;
  try {
    body = raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    body = null;
  }
  return { body, status: response.status };
}

function cents(money: unknown): number | null {
  const value = asObject(money)?.value;
  return typeof value === "string" ? valueToCents(value) : null;
}

function normalizeInvoice(body: unknown, status: number): PaypalInvoice {
  const invoice = asObject(body);
  const id = text(invoice?.id);
  const invoiceStatus = text(invoice?.status);
  if (!invoice || !id || !invoiceStatus) {
    throw new PaypalError("PayPal returned an invoice without id or status", { status });
  }
  const detail = asObject(invoice.detail);
  return {
    id,
    status: invoiceStatus,
    amountCents: cents(invoice.amount),
    currency: text(asObject(invoice.amount)?.currency_code),
    dueAmountCents: cents(invoice.due_amount),
    paidAmountCents: cents(asObject(invoice.payments)?.paid_amount),
    reference: text(detail?.reference),
    recipientViewUrl: text(asObject(detail?.metadata)?.recipient_view_url),
  };
}

const invoicePath = (invoiceId: string) => `${INVOICES_PATH}/${encodeURIComponent(invoiceId)}`;

export async function getInvoice(invoiceId: string): Promise<PaypalInvoice> {
  const { body, status } = await invoicingRequest("getInvoice", "GET", invoicePath(invoiceId));
  return normalizeInvoice(body, status);
}

/**
 * Creates the DRAFT invoice for a booking's balance: one EUR line, due on the
 * slot date, no tip and no partial payment. PayPal may answer with the
 * invoice (return=representation) or only its self link; the latter is read.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<PaypalInvoice> {
  const value = centsToValue(input.amountCents);
  const { body, status } = await invoicingRequest("createInvoice", "POST", INVOICES_PATH, {
    requestId: `invoice:${input.idempotencyKey}`,
    body: {
      detail: {
        currency_code: input.currency,
        reference: input.reference,
        // Invoicing v2: payment_term takes "either but not both term_type or due_date".
        payment_term: { due_date: input.dueDate },
      },
      primary_recipients: [{ billing_info: { email_address: input.recipientEmail } }],
      items: [
        {
          name: input.itemName,
          quantity: "1",
          unit_amount: { currency_code: input.currency, value },
          unit_of_measure: "AMOUNT",
        },
      ],
      configuration: { allow_tip: false, partial_payment: { allow_partial_payment: false } },
    },
  });
  if (text(asObject(body)?.id)) return normalizeInvoice(body, status);
  const linked = text(asObject(body)?.href)?.match(INVOICE_ID_RE)?.[1];
  if (!linked) throw new PaypalError("PayPal createInvoice returned no invoice id", { status });
  return getInvoice(decodeURIComponent(linked));
}

/**
 * Sends a DRAFT invoice to its recipient (not to us). Returns the payer-view
 * link when PayPal includes it (200); a 202 has no body, and the link is then
 * on the invoice (getInvoice). A non-draft invoice fails with PayPal's 4xx
 * unless the same request id replays the first answer.
 */
export async function sendInvoice(invoiceId: string, idempotencyKey: string): Promise<{ recipientViewUrl: string | null }> {
  const { body } = await invoicingRequest("sendInvoice", "POST", `${invoicePath(invoiceId)}/send`, {
    requestId: `invoice-send:${idempotencyKey}`,
    body: { send_to_invoicer: false, send_to_recipient: true },
  });
  const link = asObject(body);
  return { recipientViewUrl: link?.rel === "payer-view" ? text(link.href) : null };
}

/**
 * Cancels a sent invoice and notifies its recipient (Invoicing v2
 * invoices.cancel: POST /v2/invoicing/invoices/{invoice_id}/cancel with a
 * `notification` body; 204 No Content). PayPal documents no
 * PayPal-Request-Id for it: callers re-read the invoice when it fails.
 */
export async function cancelInvoice(invoiceId: string): Promise<void> {
  await invoicingRequest("cancelInvoice", "POST", `${invoicePath(invoiceId)}/cancel`, {
    body: { send_to_invoicer: false, send_to_recipient: true },
  });
}
