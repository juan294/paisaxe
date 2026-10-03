/**
 * Wire contract of the booking chat (PayPal hackathon plan, Phase 3), shared
 * by the route and the client hook.
 *
 * POST /api/booking/chat/stream  (Bearer + CSRF) -> text/event-stream of
 *   ChatStreamEvent (src/types/sse.ts): text, tool, card, done, error.
 * POST /api/booking/quotes/<quoteId>/accept  (Bearer + CSRF)
 *   200 {card: BookingSummaryCard}
 *   409 {error: "quote_expired" | "no_capacity"}
 *   429 {error: "limit_reached"}
 *   404 when the visitor has no booking access.
 */
import type { BookingSummaryCard } from "./booking-cards";

/** Most recent messages sent as history with each turn. */
export const BOOKING_CHAT_HISTORY_LIMIT = 10;
/** Longest history item the route accepts; the client truncates to it. */
export const BOOKING_CHAT_HISTORY_ITEM_MAX = 2_000;
/** Client-side abort for one booking turn (tool calls make turns longer). */
export const BOOKING_CHAT_CLIENT_ABORT_MS = 120_000;

export interface BookingChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

/** Sent instead of typed text right after the visitor accepts a quote (plan F06). */
export interface QuoteAcceptedEvent {
  type: "quote_accepted";
  bookingId: string;
}

export interface BookingChatRequest {
  /** May be empty only when `event` is present. */
  message: string;
  history: BookingChatHistoryItem[];
  locale?: string;
  event?: QuoteAcceptedEvent;
}

/** `message` values of SSE error events specific to the booking chat. */
export const BOOKING_CHAT_ERRORS = {
  /** The voucher's chat-turn allowance is used up. */
  limitReached: "limit_reached",
  /** The model could not be reached; the booking page still works. */
  aiUnavailable: "ai_unavailable",
} as const;

export interface QuoteAcceptResponse {
  card: BookingSummaryCard;
}
