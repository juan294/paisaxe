/**
 * Structured cards the booking chat streams to the browser (SSE `card`
 * events, PayPal hackathon plan Phase 3). Shared by the server tools and the
 * client components, so this file imports nothing server-side.
 *
 * Cards are the only carrier of capability links and approval URLs: those
 * never appear in model-visible text or tool results (plan F05). Amounts are
 * integer cents.
 */
import type { BalanceInvoiceStatus, CancellationTerms } from "./booking-page";

export interface OfferCardOption {
  experienceId: string;
  title: string;
  priceCents: number;
  depositCents: number;
  currency: string;
  maxParty: number;
  suitability: "suitable" | "unconfirmed" | "rejected";
  reasons: string[];
  verdicts: {
    key: string;
    verdict: "supported" | "unsupported" | "unknown";
    detail: string | null;
    confirmedByProvider: boolean;
  }[];
  slots: { date: string; startTime: string; available: number }[];
}

export interface OfferCard {
  kind: "offer";
  options: OfferCardOption[];
}

export interface QuoteCard {
  kind: "quote";
  quoteId: string;
  version: number;
  experienceTitle: string;
  slotDate: string;
  slotTime: string;
  partySize: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  currency: string;
  cancellationWindowHours: number;
  expiresAt: string;
  accepted: boolean;
}

export interface BookingSummaryCard {
  kind: "booking";
  bookingId: string;
  reference: string;
  status: string;
  /** Capability link `/booking/<id>.<token>`; null when the card is shown without one. */
  link: string | null;
}

/** Phase 4: the PayPal approval link for the deposit. */
export interface PaymentCard {
  kind: "payment";
  bookingId: string;
  approvalUrl: string;
  amountCents: number;
  currency: string;
  /** The hold's expiry: the buyer must approve before it. */
  expiresAt: string;
}

/**
 * Phase 5: the read-only cancellation preview (F01). Its button confirms
 * through the capability route with the refund shown here (R2-05).
 */
export interface CancellationCard extends CancellationTerms {
  kind: "cancellation";
  bookingId: string;
  /** `<id>.<token>` for POST /api/booking/bookings/<capability>/cancel. */
  capability: string;
}

/** Phase 8a: the PayPal invoice for the balance of a confirmed booking. */
export interface InvoiceCard {
  kind: "invoice";
  bookingId: string;
  reference: string;
  /** The balance invoiced: total - deposit. */
  amountCents: number;
  currency: string;
  /** "YYYY-MM-DD": the slot date. */
  dueDate: string;
  status: BalanceInvoiceStatus;
  /** The payer's PayPal link (card only, F05); null while a draft. */
  invoiceUrl: string | null;
}

export type BookingCard = OfferCard | QuoteCard | BookingSummaryCard | PaymentCard | CancellationCard | InvoiceCard;

const CARD_KINDS = new Set<BookingCard["kind"]>(["offer", "quote", "booking", "payment", "cancellation", "invoice"]);

/** Shallow check that a parsed value carries a known card kind. */
export function isBookingCard(value: unknown): value is BookingCard {
  return (
    typeof value === "object" &&
    value !== null &&
    CARD_KINDS.has((value as { kind?: BookingCard["kind"] }).kind as BookingCard["kind"])
  );
}
