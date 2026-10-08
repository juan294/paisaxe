/**
 * Matches the operator's bookings against PayPal's own records (APIMatic
 * plan, Phase 2, decision D8). Pure and read-only: the result is shown to the
 * operator, never written back. PayPal lists a movement up to about three
 * hours late, so a capture it has not listed yet is "pending", not an error.
 */
import type { PaypalLedger } from "@/lib/paypal/types";
import type { LedgerMatch } from "@/types/operator-ledger";
import type { OperatorBooking, OperatorPayment } from "./operator";

/** What the matcher needs of an operator booking. */
export type LedgerBooking = Pick<OperatorBooking, "id" | "depositCents" | "currency"> & {
  payment: Pick<OperatorPayment, "captureId" | "capturedAt"> | null;
};

/** PayPal's transaction status letters: settled, not settled yet, and fully reversed (refunded to the payer). */
const SETTLED = "S";
const PENDING = "P";
const REVERSED = "V";

function matchOne(booking: LedgerBooking, ledger: PaypalLedger, windowStart: number): LedgerMatch {
  const captureId = booking.payment?.captureId;
  if (!captureId) return "not_applicable";

  const capture = ledger.entries.find((entry) => entry.transactionId === captureId);
  if (capture) {
    if (capture.status === PENDING) return "pending";
    const agrees =
      (capture.status === SETTLED || capture.status === REVERSED) &&
      capture.amountCents === booking.depositCents &&
      capture.currency === booking.currency;
    if (!agrees) return "mismatch";
    const refunded =
      capture.status === REVERSED ||
      ledger.entries.some((entry) => entry.referenceId === captureId && (entry.status === SETTLED || entry.status === PENDING));
    return refunded ? "refunded" : "matches";
  }

  // Not listed: outside the window only if PayPal's records already reach past the capture.
  // An unknown capture or refresh time parses to NaN, which compares false: pending.
  const capturedAt = Date.parse(booking.payment?.capturedAt ?? "");
  const refreshedAt = Date.parse(ledger.refreshedAt ?? "");
  return capturedAt < windowStart && capturedAt <= refreshedAt ? "outside_window" : "pending";
}

/** One LedgerMatch per booking id. `windowStart` is the searched window's start. */
export function matchLedger(bookings: LedgerBooking[], ledger: PaypalLedger, windowStart: Date): Record<string, LedgerMatch> {
  return Object.fromEntries(bookings.map((booking) => [booking.id, matchOne(booking, ledger, windowStart.getTime())]));
}
