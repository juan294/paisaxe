/** Shared type contract for the booking agent and its optional intake path. */
import type { BookingChatHistoryItem } from "@/types/booking-chat";
import type { BookingDraft } from "./drafts";
import type { BookingModelClient } from "./model-client";
import type { ToolContext } from "./tools";
import type { Booking } from "./types";

export interface BookingTurnInput {
  anthropic: BookingModelClient;
  tools: ToolContext;
  /** The visitor's text; empty only on the post-accept turn, which runs no model. */
  message: string;
  history: BookingChatHistoryItem[];
  draft: BookingDraft;
  bookings: Booking[];
  /** Retrieved guide passages for descriptive questions, already formatted. */
  contextText: string | null;
  /** Set when the server verified a quote_accepted event for this turn. */
  acceptedBooking: { id: string; reference: string } | null;
  /** The visitor's interface language (es, en, fr, de, pt, ast), when known. */
  locale?: string | null;
  signal: AbortSignal;
  /** Called on every model stream event, so the caller's idle window sees a held reply being written (#1045). */
  onProgress?: () => void;
  now?: Date;
}
