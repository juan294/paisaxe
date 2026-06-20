import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * Booking service layer for the MCP make-booking flow.
 *
 * Extracted from src/app/api/mcp/make-booking/route.ts (#625) so the
 * business logic — phone validation/normalization, Spanish date/time
 * formatting, and pending_bookings persistence — is independently
 * unit-testable. The route handler is left thin: parse/validate → call
 * service → format response.
 *
 * Behavior is preserved exactly; the route-level characterization tests
 * continue to exercise these helpers through the HTTP boundary.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type BookingStatus =
  | "initiated"
  | "queued"
  | "failed"
  | "not_configured"
  | "duplicate"
  | "degraded"
  | "initiating"
  | "pending"
  | "confirmed"
  | "denied"
  | "no_answer"
  /** BE-H2: call timed out — row stays in 'initiating', cron/webhook reconciles */
  | "timed_out";

export interface PendingBookingSnapshot {
  conversation_id: string | null;
  status: BookingStatus | string | null;
  venue_name: string | null;
  outcome_message: string | null;
}

export interface ClaimBookingInput {
  idempotencyKey: string;
  venueName: string;
  venuePhone: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  bookingDate: string;
  bookingTime: string;
  specialRequests?: string | null;
}

export type ClaimBookingResult =
  | { kind: "claimed"; pendingRowId: string }
  | { kind: "duplicate"; priorBooking: PendingBookingSnapshot | null }
  | { kind: "persistence_failed" };

export const ACTIVE_BOOKING_STATUSES = new Set<string>([
  "initiating",
  "pending",
  "confirmed",
]);

// ---------------------------------------------------------------------------
// Phone validation / normalization
// ---------------------------------------------------------------------------

/** Validate Spanish phone number format. */
export function isValidSpanishPhone(phone: string): boolean {
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, "");

  // Spanish phone numbers:
  // - Start with +34 followed by 9 digits, OR
  // - Start with 34 followed by 9 digits, OR
  // - Just 9 digits starting with 6, 7, 8, or 9
  const patterns = [
    /^\+34[6789]\d{8}$/, // International format
    /^34[6789]\d{8}$/, // International without +
    /^[6789]\d{8}$/, // National format
  ];

  return patterns.some((pattern) => pattern.test(cleaned));
}

/** Normalize phone to E.164 format for Twilio. */
export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");

  if (cleaned.startsWith("+34")) {
    return cleaned;
  }
  if (cleaned.startsWith("34")) {
    return `+${cleaned}`;
  }
  // Assume Spanish number
  return `+34${cleaned}`;
}

// ---------------------------------------------------------------------------
// Spanish date / time formatting
// ---------------------------------------------------------------------------

/**
 * Format date with correct Spanish grammar:
 * "hoy" → "hoy" (no article), "viernes" → "el viernes" (needs article),
 * "15 de febrero" → "el 15 de febrero" (needs article).
 */
export function formatDateNatural(date: string): string {
  const lowerDate = date.toLowerCase().trim();

  // These don't need "el" prefix
  const noArticle = ["hoy", "mañana", "pasado mañana"];
  if (noArticle.includes(lowerDate)) {
    return lowerDate;
  }

  // If it already starts with "el", return as-is
  if (lowerDate.startsWith("el ")) {
    return date;
  }

  // Everything else needs "el" (days of week, specific dates)
  return `el ${date}`;
}

/**
 * Convert 24-hour time to natural Spanish format:
 * "21:00" → "nueve de la noche", "14:30" → "dos y media de la tarde",
 * "9:00" → "nueve de la mañana". Non-clock strings pass through unchanged.
 */
export function formatTimeNatural(time: string): string {
  // If already in natural format, return as-is
  if (!/^\d{1,2}[:.]\d{2}$/.test(time)) {
    return time;
  }

  const [hourStr, minStr] = time.split(/[:.]/);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  // Spanish number words
  const numbers: Record<number, string> = {
    1: "una",
    2: "dos",
    3: "tres",
    4: "cuatro",
    5: "cinco",
    6: "seis",
    7: "siete",
    8: "ocho",
    9: "nueve",
    10: "diez",
    11: "once",
    12: "doce",
  };

  // Convert 24h to 12h
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const hourWord = numbers[hour12] || String(hour12);

  // Time of day
  let period: string;
  if (hour >= 6 && hour < 13) {
    period = "de la mañana";
  } else if (hour >= 13 && hour < 20) {
    period = "de la tarde";
  } else {
    period = "de la noche";
  }

  // Handle minutes
  if (min === 0) {
    return `${hourWord} ${period}`;
  } else if (min === 30) {
    return `${hourWord} y media ${period}`;
  } else if (min === 15) {
    return `${hourWord} y cuarto ${period}`;
  } else if (min === 45) {
    const nextHour = hour12 === 12 ? 1 : hour12 + 1;
    const nextHourWord = numbers[nextHour] || String(nextHour);
    return `${nextHourWord} menos cuarto ${period}`;
  } else {
    return `${hourWord} y ${min} ${period}`;
  }
}

// ---------------------------------------------------------------------------
// pending_bookings persistence
// ---------------------------------------------------------------------------

/** Look up a prior pending booking by its idempotency key. */
export async function getPriorBookingByIdempotencyKey(
  idempotencyKey: string
): Promise<PendingBookingSnapshot | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pending_bookings")
    .select("conversation_id, status, venue_name, outcome_message")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    logger.error("[MAKE_BOOKING_IDEMPOTENCY_LOOKUP_FAILED]", {
      idempotency_key: idempotencyKey,
      error,
    });
    return null;
  }

  return (data as PendingBookingSnapshot | null) ?? null;
}

/**
 * Claim a booking request by inserting a pending_bookings row with
 * status='initiating' BEFORE the outbound call, so retries cannot place
 * duplicate calls. Returns a discriminated result describing the outcome:
 * - `claimed`: a fresh row was inserted; carries its id.
 * - `duplicate`: the idempotency key was already claimed (23505); carries
 *   the prior snapshot when it could be read back.
 * - `persistence_failed`: the claim could not be persisted (DB error,
 *   missing id, or thrown exception).
 */
export async function claimPendingBooking(
  input: ClaimBookingInput
): Promise<ClaimBookingResult> {
  try {
    const supabase = createAdminClient();
    const { data: insertedRows, error: insertError } = await supabase
      .from("pending_bookings")
      .insert({
        idempotency_key: input.idempotencyKey,
        conversation_id: null,
        venue_name: input.venueName,
        venue_phone: input.venuePhone,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        party_size: Number(input.partySize),
        booking_date: input.bookingDate,
        booking_time: input.bookingTime,
        special_requests: input.specialRequests ?? null,
        status: "initiating",
      })
      .select("id");

    if (insertError) {
      if ((insertError as { code?: string }).code === "23505") {
        const priorBooking = await getPriorBookingByIdempotencyKey(
          input.idempotencyKey
        );
        return { kind: "duplicate", priorBooking };
      }

      logger.error("[MAKE_BOOKING_PENDING_INSERT_FAILED]", {
        idempotency_key: input.idempotencyKey,
        error: insertError,
      });
      return { kind: "persistence_failed" };
    }

    const pendingRowId =
      (insertedRows?.[0] as { id?: string } | undefined)?.id ?? null;

    if (!pendingRowId) {
      logger.error("[MAKE_BOOKING_PENDING_INSERT_MISSING_ID]", {
        idempotency_key: input.idempotencyKey,
        inserted_rows: insertedRows,
      });
      return { kind: "persistence_failed" };
    }

    return { kind: "claimed", pendingRowId };
  } catch (dbError) {
    logger.error("[MAKE_BOOKING_PENDING_INSERT_DB_ERROR]", {
      idempotency_key: input.idempotencyKey,
      error: dbError,
    });
    return { kind: "persistence_failed" };
  }
}

/**
 * Persist the conversation_id on the claimed pending booking and flip its
 * status to 'pending'. Returns true on success, false when the update fails
 * or throws (the caller then degrades the response).
 */
export async function persistBookingConversationId(
  pendingRowId: string,
  conversationId: string,
  idempotencyKey: string
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from("pending_bookings")
      .update({
        conversation_id: conversationId,
        status: "pending",
      })
      .eq("id", pendingRowId);

    if (updateError) {
      logger.error("[MAKE_BOOKING_PENDING_UPDATE_FAILED]", {
        pending_booking_id: pendingRowId,
        idempotency_key: idempotencyKey,
        conversation_id: conversationId,
        error: updateError,
      });
      return false;
    }

    return true;
  } catch (dbError) {
    logger.error("[MAKE_BOOKING_PENDING_UPDATE_DB_ERROR]", {
      pending_booking_id: pendingRowId,
      idempotency_key: idempotencyKey,
      conversation_id: conversationId,
      error: dbError,
    });
    return false;
  }
}

/** Mark a claimed pending booking as failed with an outcome message. */
export async function markPendingBookingFailed(
  pendingRowId: string,
  idempotencyKey: string,
  outcomeMessage: string,
  logContext: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("pending_bookings")
      .update({
        status: "failed",
        outcome_message: outcomeMessage,
      })
      .eq("id", pendingRowId);

    if (error) {
      logger.error("[MAKE_BOOKING_PENDING_FAIL_MARK_FAILED]", {
        pending_booking_id: pendingRowId,
        idempotency_key: idempotencyKey,
        error,
        ...logContext,
      });
    }
  } catch (error) {
    logger.error("[MAKE_BOOKING_PENDING_FAIL_MARK_DB_ERROR]", {
      pending_booking_id: pendingRowId,
      idempotency_key: idempotencyKey,
      error,
      ...logContext,
    });
  }
}
