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
