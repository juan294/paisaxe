/**
 * The PayPal adapter's contract (PayPal hackathon plan, Phase 4). The rest of
 * the booking code depends on these shapes only, never on pay-pal-server-sdk
 * types. Amounts are integer cents; PayPal's "30.00" strings stay inside the
 * adapter.
 */

/** Order statuses PayPal documents; open, so other strings can appear. */
export type PaypalOrderStatus =
  | "CREATED"
  | "SAVED"
  | "APPROVED"
  | "VOIDED"
  | "COMPLETED"
  | "PAYER_ACTION_REQUIRED"
  | (string & {});

/** Capture statuses; open as above. */
export type PaypalCaptureStatus =
  | "COMPLETED"
  | "DECLINED"
  | "PARTIALLY_REFUNDED"
  | "PENDING"
  | "REFUNDED"
  | "FAILED"
  | (string & {});

/** Refund statuses; open as above. */
export type PaypalRefundStatus = "CANCELLED" | "FAILED" | "PENDING" | "COMPLETED" | (string & {});

export interface PaypalCapture {
  id: string;
  status: PaypalCaptureStatus;
  amountCents: number | null;
  currency: string | null;
  customId: string | null;
  /** The order this capture belongs to (supplementary_data.related_ids.order_id). */
  orderId: string | null;
}

export interface PaypalOrder {
  id: string;
  status: PaypalOrderStatus;
  /** purchase_units[0].amount */
  amountCents: number | null;
  currency: string | null;
  /** purchase_units[0].custom_id: the booking id */
  customId: string | null;
  /** purchase_units[0].payments.captures[0], once captured */
  capture: PaypalCapture | null;
  /** links[rel = payer-action | approve] while the buyer has not approved */
  approveUrl: string | null;
  /**
   * payer.email_address (else payment_source.paypal.email_address), present
   * once the buyer has approved: the balance invoice's recipient (Phase 8a).
   * Omitted when PayPal sent none.
   */
  payerEmail?: string;
}

/** Invoice statuses PayPal documents (Invoicing v2); open, so other strings can appear. */
export type PaypalInvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "SCHEDULED"
  | "UNPAID"
  | "PAYMENT_PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "MARKED_AS_PAID"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "MARKED_AS_REFUNDED"
  | (string & {});

export interface PaypalInvoice {
  id: string;
  status: PaypalInvoiceStatus;
  /** amount: the invoice total. */
  amountCents: number | null;
  currency: string | null;
  /** due_amount: what is still outstanding (null when PayPal sent none). */
  dueAmountCents: number | null;
  /** payments.paid_amount: what PayPal has recorded as paid (null before any payment). */
  paidAmountCents: number | null;
  /** detail.reference: our booking reference. */
  reference: string | null;
  /** detail.metadata.recipient_view_url: the payer's link, once the invoice is sent. */
  recipientViewUrl: string | null;
}

export interface CreateInvoiceInput {
  /**
   * Fixed per booking (the booking id): PayPal-Request-Id "invoice:" + key on
   * create and "invoice-send:" + key on send, so a retry returns the same invoice.
   */
  idempotencyKey: string;
  /** Booking reference, shown on the invoice (detail.reference). */
  reference: string;
  recipientEmail: string;
  amountCents: number;
  currency: "EUR";
  /** "YYYY-MM-DD": the slot date. */
  dueDate: string;
  /** The single line item's name. */
  itemName: string;
}

export interface PaypalRefund {
  id: string;
  status: PaypalRefundStatus;
}

/** Webhook verification body field -> the PayPal transmission header that carries it. */
export const TRANSMISSION_HEADERS = {
  auth_algo: "paypal-auth-algo",
  cert_url: "paypal-cert-url",
  transmission_id: "paypal-transmission-id",
  transmission_sig: "paypal-transmission-sig",
  transmission_time: "paypal-transmission-time",
} as const;

export interface CreateOrderInput {
  bookingId: string;
  amountCents: number;
  currency: "EUR";
  description: string;
  returnUrl: string;
  cancelUrl: string;
  /** payments.operation_key: becomes PayPal-Request-Id, so retries are idempotent. */
  operationKey: string;
}

/** PayPal credentials or base URL missing or not allowed (sandbox-only host guard). */
export class PaypalNotConfigured extends Error {
  constructor(message = "PayPal is not configured") {
    super(message);
    this.name = "PaypalNotConfigured";
  }
}

/** A failed PayPal call: HTTP status, PayPal's first `details[].issue` and `debug_id` when known. */
export class PaypalError extends Error {
  readonly status: number | null;
  readonly issue: string | null;
  readonly debugId: string | null;

  constructor(message: string, details: { status?: number | null; issue?: string | null; debugId?: string | null } = {}) {
    super(message);
    this.name = "PaypalError";
    this.status = details.status ?? null;
    this.issue = details.issue ?? null;
    this.debugId = details.debugId ?? null;
  }
}
