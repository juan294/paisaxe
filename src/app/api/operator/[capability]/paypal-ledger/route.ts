import { NextResponse, type NextRequest } from "next/server";
import { matchLedger } from "@/lib/booking/ledger";
import { guardOperatorRoute, loadOperatorBookings } from "@/lib/booking/operator";
import { CAPABILITY_HEADERS } from "@/lib/booking/view";
import { logger } from "@/lib/logger";
import { MAX_SEARCH_RANGE_MS, PaypalError, PaypalNotConfigured, searchTransactions } from "@/lib/paypal";
import type { OperatorLedgerResponse } from "@/types/operator-ledger";

/** PayPal's maximum search window, less the under-a-second the adapter adds at each end (whole seconds). */
const WINDOW_MS = MAX_SEARCH_RANGE_MS - 2_000;

/**
 * GET /api/operator/<id>.<token>/paypal-ledger
 *
 * Whether PayPal's own records agree with each of the merchant's deposits
 * (APIMatic plan, Phase 2, decision D8): one Transaction Search over the last
 * 31 days, matched against the bookings the operator page lists. Read-only.
 * Same capability, rate limit and 404s as the operator view. When PayPal
 * cannot answer, 200 with state "unavailable" so the rest of the panel works.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ capability: string }> }
): Promise<NextResponse> {
  const guard = await guardOperatorRoute(request, (await params).capability);
  if (guard instanceof NextResponse) return guard;

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  let body: OperatorLedgerResponse;
  try {
    const [bookings, ledger] = await Promise.all([
      loadOperatorBookings(guard.admin, guard.access, now),
      searchTransactions(windowStart, now),
    ]);
    body = {
      state: "ok",
      refreshedAt: ledger.refreshedAt,
      truncated: ledger.truncated,
      windowStart: windowStart.toISOString(),
      bookings: matchLedger(bookings, ledger, windowStart),
    };
  } catch (error) {
    const reason =
      error instanceof PaypalNotConfigured
        ? "not_configured"
        : error instanceof PaypalError && error.status === 403
          ? "not_authorized"
          : "error";
    const details = {
      reason,
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof PaypalError ? { status: error.status, issue: error.issue, debugId: error.debugId } : {}),
    };
    // A missing permission or configuration is a setup state, not a fault.
    if (reason === "error") logger.error("[OPERATOR_LEDGER_FAILED]", details);
    else logger.warn("[OPERATOR_LEDGER_FAILED]", details);
    body = { state: "unavailable", reason };
  }
  return NextResponse.json(body, { headers: CAPABILITY_HEADERS });
}
