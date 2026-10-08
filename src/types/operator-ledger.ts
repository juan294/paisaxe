/**
 * Wire contract of GET /api/operator/<capability>/paypal-ledger (APIMatic
 * plan, Phase 2): whether PayPal's own records (Transaction Search) agree
 * with each booking's deposit. Read-only; shared by the route and the panel.
 */

/** Per booking with a deposit; not_applicable when no capture exists yet. */
export type LedgerMatch = "matches" | "refunded" | "pending" | "mismatch" | "outside_window" | "not_applicable";

export type OperatorLedgerResponse =
  | {
      state: "ok";
      /** PayPal lists nothing newer than this (ISO 8601), or null when it did not say. */
      refreshedAt: string | null;
      /** PayPal had more movements than one page; only the first page was checked. */
      truncated: boolean;
      /** Start of the searched window (ISO 8601). */
      windowStart: string;
      /** Keyed by booking id. */
      bookings: Record<string, LedgerMatch>;
    }
  | { state: "unavailable"; reason: "not_authorized" | "not_configured" | "error" };
