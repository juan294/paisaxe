/**
 * Cents <-> PayPal amount strings. The booking code works in integer cents;
 * PayPal's "30.00" strings exist only at the adapter boundary.
 */
import { PaypalError } from "./types";

/** PayPal's amount value for EUR: digits with at most two decimals. */
const VALUE_RE = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Formats positive integer cents as PayPal's value string (3000 -> "30.00"). Our input: RangeError when invalid. */
export function centsToValue(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new RangeError(`amount must be a positive whole number of cents, got ${cents}`);
  }
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}

/** Parses PayPal's value string into cents ("30.00" -> 3000). PayPal's data: PaypalError when unreadable. */
export function valueToCents(value: string): number {
  const match = VALUE_RE.exec(value);
  const cents = match ? Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")) : Number.NaN;
  if (!Number.isSafeInteger(cents)) {
    throw new PaypalError(`PayPal returned an unreadable amount: ${JSON.stringify(value)}`);
  }
  return cents;
}
