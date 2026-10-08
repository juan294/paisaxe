/**
 * Transaction Search through the SDK (APIMatic plan, Phase 2; contract sheet
 * paypal-server-sdk-plan.md, "Operations"): what PayPal itself recorded for
 * the merchant, so the operator panel can check each deposit against it.
 * Read-only. PayPal lists a movement up to about three hours after it
 * happens; last_refreshed_datetime says how far its records go.
 */
import "server-only";

import type { TransactionInformation } from "@paypal/paypal-server-sdk";
import { callPaypal } from "./client";
import { valueToCents } from "./money";
import type { PaypalLedger, PaypalLedgerEntry } from "./types";

/** PayPal's limit on one search's date range. */
export const MAX_SEARCH_RANGE_MS = 31 * 24 * 3_600_000;
const PAGE_SIZE = 500;

/** RFC 3339 with seconds and no fraction, as the API documents. */
function rfc3339(time: number): string {
  return `${new Date(time).toISOString().slice(0, 19)}Z`;
}

/** PayPal's date ("2026-10-08T10:00:00Z" from the sandbox; "+0000" in its examples) as ISO 8601, or null. */
function isoOrNull(value: string | undefined): string | null {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** A signed amount ("-30.00" for a refund) in cents, or null when unreadable. */
function signedCents(value: string | undefined): number | null {
  if (!value) return null;
  const negative = value.startsWith("-");
  try {
    const cents = valueToCents(negative ? value.slice(1) : value);
    return negative ? -cents : cents;
  } catch {
    return null;
  }
}

function toEntry(info: TransactionInformation | undefined): PaypalLedgerEntry | null {
  if (!info?.transactionId) return null;
  return {
    transactionId: info.transactionId,
    referenceId: info.paypalReferenceId ?? null,
    eventCode: info.transactionEventCode ?? null,
    status: info.transactionStatus ?? null,
    amountCents: signedCents(info.transactionAmount?.value),
    currency: info.transactionAmount?.currencyCode ?? null,
    customId: info.customField ?? null,
  };
}

/**
 * The first page (500 movements) of the merchant's transactions between
 * `start` and `end`, widened to whole seconds and then at most 31 days apart
 * (RangeError otherwise, before any request). PayPal's refusals are
 * PaypalError; 403 means the app lacks the Transaction Search permission.
 */
export async function searchTransactions(start: Date, end: Date): Promise<PaypalLedger> {
  // Whole seconds, outwards, so a movement in the window's last second is not cut off.
  const from = Math.floor(start.getTime() / 1000) * 1000;
  const to = Math.ceil(end.getTime() / 1000) * 1000;
  if (!(end.getTime() >= start.getTime() && to - from <= MAX_SEARCH_RANGE_MS)) {
    throw new RangeError("a Transaction Search window must run forwards and span at most 31 days");
  }
  const { value } = await callPaypal("searchTransactions", ({ transactions }) =>
    transactions.searchTransactions({
      startDate: rfc3339(from),
      endDate: rfc3339(to),
      fields: "transaction_info",
      pageSize: PAGE_SIZE,
      page: 1,
    }),
  );
  return {
    entries: (value.transactionDetails ?? []).flatMap((detail) => toEntry(detail.transactionInfo) ?? []),
    refreshedAt: isoOrNull(value.lastRefreshedDatetime),
    truncated: (value.totalPages ?? 1) > 1,
  };
}
