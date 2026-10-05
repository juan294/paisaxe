/**
 * Wire contract of the booking page (PayPal hackathon plan, Phase 4), shared
 * by the capability routes and the page's client components. Every route is
 * authorized by the capability alone (no voucher, no session) and answers
 * `Cache-Control: private, no-store`.
 *
 * GET  /api/booking/bookings/<capability>          200 BookingView | 404
 * POST /api/booking/bookings/<capability>/payment  (CSRF)
 *   200 PaymentStartResponse
 *   409 {error: "hold_expired" | "invalid_state" | "payment_in_progress"}
 *   503 {error: "payment_unavailable"}
 * POST /api/booking/payments/capture {capability, orderId}  (CSRF)
 *   200 {outcome: "confirmed"}
 *   202 {outcome: "pending" | "awaiting_approval"}
 *   409 {outcome: "slot_gone" | "mismatch" | "compensating" | "failed"}
 *       (mismatch also when orderId is not the booking's latest payment's)
 *   404 unknown capability
 * GET  /api/booking/bookings/<capability>/cancellation-preview    (read-only, F01)
 *   200 CancellationTerms | 409 {error: "invalid_state"} (not confirmed)
 * POST /api/booking/bookings/<capability>/cancel {expectedRefundCents}  (CSRF)
 *   200 CancelResponse (also for a booking already cancelled: idempotent)
 *   409 {error: "terms_changed", terms: CancellationTerms}  (R2-05: nothing written)
 *   409 {error: "invalid_state"} (unpaid, expired or flagged: nothing to cancel)
 *   502 {error: "refund_unavailable"} (cancellation recorded; refund retried automatically)
 */

/** The payment as the page needs it; ids appear on the confirmed receipt. */
export interface BookingPaymentView {
  status: string;
  orderId: string | null;
  captureId: string | null;
  refundId: string | null;
}

export interface BookingView {
  reference: string;
  status: string;
  experienceTitle: string;
  slotDate: string;
  slotTime: string;
  partySize: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  currency: string;
  cancellationWindowHours: number;
  /** The hold's expiry while the booking waits for payment, else null. */
  holdExpiresAt: string | null;
  /** The latest payment attempt, or null before the first one. */
  payment: BookingPaymentView | null;
  /** The balance invoice (Phase 8a), or null before one is sent. */
  invoice: BookingInvoiceView | null;
}

/** Our reading of the PayPal balance invoice (bookings.invoice_status, migration 125). */
export type BalanceInvoiceStatus = "draft" | "sent" | "payment_pending" | "partially_paid" | "paid" | "cancelled";

export interface BookingInvoiceView {
  status: BalanceInvoiceStatus;
  /** The payer's PayPal link once sent; null while a draft. */
  url: string | null;
}

export interface PaymentStartResponse {
  approveUrl: string;
  amountCents: number;
  currency: string;
  expiresAt: string;
}

/** What the single capture path (src/lib/booking/capture.ts) concluded. */
export type CaptureOutcome =
  /** The booking is confirmed (now or before). */
  | "confirmed"
  /** The buyer has not approved the order yet. */
  | "awaiting_approval"
  /** The capture outcome is unknown; reconciliation resolves it. */
  | "pending"
  /** Approved but not captured, and the slot is gone: nothing was charged. */
  | "slot_gone"
  /** Money moved but the booking cannot be fulfilled: refund in progress. */
  | "compensating"
  /** The order does not match the booking; nothing captured, needs attention. */
  | "mismatch"
  /** PayPal declined the capture. */
  | "failed";

export interface CaptureRequest {
  capability: string;
  orderId: string;
}

export interface CaptureResponse {
  outcome: CaptureOutcome;
}

/** What a cancellation would refund now (Phase 5); the confirm request sends refundCents back. */
export interface CancellationTerms {
  refundCents: number;
  depositCents: number;
  currency: string;
  cancellationWindowHours: number;
  /** When the activity starts. */
  slotStart: string;
  /** The last instant a full refund applies, or null when none is due. */
  termsValidUntil: string | null;
}

export interface CancelRequest {
  /** The refund the visitor was shown: an expectation the server checks, never authority. */
  expectedRefundCents: number;
}

export interface CancelResponse {
  status: string;
  refundCents: number | null;
}
