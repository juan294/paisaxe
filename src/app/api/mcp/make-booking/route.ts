import { NextResponse } from "next/server";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";
import { logger } from "@/lib/logger";
import { getMcpIdempotencyKey, validateMcpSecret } from "@/lib/mcp-auth";
import { makeBookingRequestSchema } from "@/lib/schemas";
import {
  ACTIVE_BOOKING_STATUSES,
  claimPendingBooking,
  isValidSpanishPhone,
  markPendingBookingFailed,
  normalizePhoneNumber,
  persistBookingConversationId,
  type BookingStatus,
  type PendingBookingSnapshot,
} from "@/lib/services/booking-service";
import { initiateCall } from "@/lib/services/elevenlabs-call-service";

/**
 * MCP-compatible Make Booking API endpoint for ElevenLabs voice agents.
 * Initiates an outbound call to a business (restaurant, hotel, activity provider)
 * using ElevenLabs Conversational AI.
 *
 * This endpoint uses ElevenLabs' native Twilio integration, so Pelayo's actual
 * voice (Ignacio) is used and Pelayo can have a real conversation with the business.
 *
 * POST /api/mcp/make-booking
 *
 * Flow:
 * 1. User asks Pelayo to make a reservation
 * 2. Pelayo searches for the business using search_places
 * 3. Pelayo calls this endpoint with the reservation details
 * 4. This endpoint calls ElevenLabs' outbound call API
 * 5. ElevenLabs orchestrates Twilio to call the business with Pelayo's voice
 * 6. Pelayo conducts a real conversation with the business staff
 * 7. Returns call status to Pelayo to communicate back to the user
 *
 * Business logic (phone validation/normalization, Spanish date/time formatting,
 * pending_bookings persistence, and the outbound call) lives in
 * `src/lib/services/booking-service.ts` and
 * `src/lib/services/elevenlabs-call-service.ts` (#625). This handler stays thin:
 * authenticate → validate → call services → format response.
 */

interface MakeBookingResponse {
  success: boolean;
  message: string;
  call_sid?: string;
  status?: BookingStatus;
  estimated_wait?: string;
  fallback_action?: string;
  recovery_action?: string;
}

function buildClaimPersistenceFailureResponse(): NextResponse<MakeBookingResponse> {
  return NextResponse.json<MakeBookingResponse>(
    {
      success: false,
      message: "Could not persist booking request before placing the call.",
      status: "failed",
    },
    { status: 500 }
  );
}

function buildPriorBookingStateResponse(
  booking: PendingBookingSnapshot
): NextResponse<MakeBookingResponse> {
  const status = (booking.status as BookingStatus | null) ?? "pending";
  const venueName = booking.venue_name ?? "the venue";

  return NextResponse.json<MakeBookingResponse>({
    success: ACTIVE_BOOKING_STATUSES.has(status),
    message:
      booking.outcome_message ??
      `A booking request for ${venueName} is already in progress with status ${status}.`,
    call_sid: booking.conversation_id ?? undefined,
    status,
  });
}

function buildIdempotencyConflictResponse(): NextResponse<MakeBookingResponse> {
  return NextResponse.json<MakeBookingResponse>(
    {
      success: false,
      message:
        "A booking request with this Idempotency Key is already being processed.",
      status: "duplicate",
    },
    { status: 409 }
  );
}

function buildConversationPersistenceFailureResponse(
  callId: string | undefined
): NextResponse<MakeBookingResponse> {
  return NextResponse.json<MakeBookingResponse>(
    {
      success: false,
      message:
        "The call was initiated, but booking tracking is degraded because the conversation ID could not be persisted.",
      call_sid: callId,
      status: "degraded",
      recovery_action:
        "manual recovery required: inspect the pending booking row and reconcile the accepted ElevenLabs call conversation_id.",
    },
    { status: 202 }
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!validateMcpSecret(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized", status: "failed" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Support both flat format and MCP format — validate with Zod
    const parsed = makeBookingRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json<MakeBookingResponse & { errors?: unknown }>(
        {
          success: false,
          message: "Invalid request parameters",
          status: "failed",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const params = parsed.data;

    // Check if booking system is enabled via feature flag
    const bookingEnabled = await isFeatureFlagEnabled("booking_system");

    if (!bookingEnabled) {
      const venueName = params.venue_name || "the business";
      const phoneNumber = params.phone_number || "their phone number";

      return NextResponse.json<MakeBookingResponse>({
        success: false,
        message: `Booking is temporarily unavailable. Please call ${venueName} directly at ${phoneNumber} to make your reservation.`,
        status: "not_configured",
        fallback_action: `Tell the user: "I can't make calls right now, but you can call ${venueName} directly at ${phoneNumber}."`,
      });
    }

    const {
      venue_name,
      phone_number,
      party_size,
      date,
      time,
      customer_name,
      customer_phone,
    } = params;

    // Validate phone number format (isValidSpanishPhone uses a stricter regex than Zod schema)
    if (!isValidSpanishPhone(phone_number)) {
      return NextResponse.json<MakeBookingResponse>(
        {
          success: false,
          message:
            "Invalid Spanish phone number. Please provide a valid Spanish phone number.",
          status: "failed",
          fallback_action:
            "Ask the user to confirm the phone number or search for the restaurant again.",
        },
        { status: 400 }
      );
    }

    // Check if ElevenLabs outbound calling is configured
    if (
      !process.env.ELEVENLABS_API_KEY ||
      !process.env.ELEVENLABS_PHONE_NUMBER_ID
    ) {
      // Return a helpful message for testing/development
      return NextResponse.json<MakeBookingResponse>({
        success: false,
        message: `Outbound calling is not configured. To make a reservation at ${venue_name}, please call them directly at ${phone_number}.`,
        status: "not_configured",
        fallback_action: `Tell the user: "I cannot make calls yet, but you can call ${venue_name} directly at ${phone_number} to make a reservation for ${party_size} people on ${date} at ${time}."`,
      });
    }

    // Normalize phone numbers for calling
    const normalizedPhone = normalizePhoneNumber(phone_number);
    const normalizedCustomerPhone = normalizePhoneNumber(customer_phone);
    const idempotencyKey = getMcpIdempotencyKey(request);

    if (!idempotencyKey) {
      return NextResponse.json<MakeBookingResponse>(
        {
          success: false,
          message: "Idempotency key is required for booking requests.",
          status: "failed",
          fallback_action:
            "Retry the booking request with the same Idempotency-Key header to avoid duplicate calls.",
        },
        { status: 400 }
      );
    }

    // Claim the booking request before the outbound call so retries cannot place duplicates.
    const claim = await claimPendingBooking({
      idempotencyKey,
      venueName: venue_name,
      venuePhone: normalizedPhone,
      customerName: customer_name,
      customerPhone: normalizedCustomerPhone,
      partySize: party_size,
      bookingDate: date,
      bookingTime: time,
      specialRequests: params.special_requests || null,
    });

    if (claim.kind === "duplicate") {
      if (claim.priorBooking) {
        return buildPriorBookingStateResponse(claim.priorBooking);
      }
      return buildIdempotencyConflictResponse();
    }

    if (claim.kind === "persistence_failed") {
      return buildClaimPersistenceFailureResponse();
    }

    const pendingRowId = claim.pendingRowId;

    // Initiate the call via ElevenLabs
    const result = await initiateCall(normalizedPhone, {
      customer_name,
      customer_phone,
      party_size,
      date,
      time,
      special_requests: params.special_requests,
    });

    if (result.success) {
      // BE-B6: Now that we have the call ID, update the row with conversation_id and status='pending'.
      // The webhook handler will look up the booking by conversation_id.
      const conversationId = result.conversationId || result.callSid;

      if (!conversationId) {
        await markPendingBookingFailed(
          pendingRowId,
          idempotencyKey,
          "Call initiation failed: ElevenLabs response missing conversation_id or callSid.",
          { response_status: "missing_identifier" }
        );
        return NextResponse.json<MakeBookingResponse>(
          {
            success: false,
            message:
              "Could not call the venue: ElevenLabs response missing conversation_id or callSid.",
            status: "failed",
            fallback_action: `Tell the user they can call the restaurant directly at ${phone_number}.`,
          },
          { status: 500 }
        );
      }

      const persisted = await persistBookingConversationId(
        pendingRowId,
        conversationId,
        idempotencyKey
      );

      if (!persisted) {
        await markPendingBookingFailed(
          pendingRowId,
          idempotencyKey,
          `Call initiated but conversation_id persistence failed for ${conversationId}. Manual recovery required.`,
          { conversation_id: conversationId }
        );
        return buildConversationPersistenceFailureResponse(
          result.callSid || result.conversationId
        );
      }

      // Check if SMS confirmation is enabled
      const smsEnabled = await isFeatureFlagEnabled("sms_booking_confirmation");
      const smsNote = smsEnabled
        ? ` The visitor will receive an SMS at ${customer_phone} once the restaurant answers and confirms.`
        : "";

      return NextResponse.json<MakeBookingResponse>({
        success: true,
        message: `IMPORTANT: The call to ${venue_name} has been INITIATED but the reservation is NOT confirmed yet. The restaurant has not answered yet. DO NOT tell the user the reservation is confirmed. Tell the user: "Estoy llamando al restaurante ahora. Te avisaré cuando confirmen."${smsNote}`,
        call_sid: result.callSid || result.conversationId,
        status: "initiated",
        estimated_wait: "30-60 seconds",
      });
    } else if (result.timedOut) {
      // BE-H2: The fetch to ElevenLabs timed out — we do NOT know whether
      // ElevenLabs accepted the call. Leave the pending_bookings row in
      // 'initiating' so the stale-bookings cron or a late webhook can
      // reconcile. Do NOT mark 'failed' — that is a terminal state that
      // prevents the cron from cleaning up and blocks retries.
      logger.warn("[MAKE_BOOKING_CALL_TIMED_OUT]", {
        pending_row_id: pendingRowId,
        idempotency_key: idempotencyKey,
        venue: venue_name,
        error: result.error,
      });
      return NextResponse.json<MakeBookingResponse>(
        {
          success: false,
          message: `The call to ${venue_name} timed out — we are not sure if the venue received it. The system will retry or expire the request automatically.`,
          status: "timed_out",
          recovery_action: `Tell the user: "La llamada está tardando demasiado. El sistema reintentará pronto. Si necesitas reservar con urgencia, llama directamente a ${phone_number}."`,
        },
        { status: 202 }
      );
    } else {
      await markPendingBookingFailed(
        pendingRowId,
        idempotencyKey,
        `Call initiation failed: ${result.error ?? "Unknown error"}`,
        { error: result.error }
      );
      return NextResponse.json<MakeBookingResponse>(
        {
          success: false,
          message: `Could not call ${venue_name}: ${result.error}`,
          status: "failed",
          fallback_action: `Tell the user they can call the restaurant directly at ${phone_number}.`,
        },
        { status: 500 }
      );
    }
  } catch (err) {
    logger.error("[MAKE_BOOKING_UNHANDLED_ERROR]", { error: err });
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json<MakeBookingResponse>(
      {
        success: false,
        message: `Error processing request: ${message}`,
        status: "failed",
      },
      { status: 500 }
    );
  }
}

// GET endpoint for health checks and documentation
export async function GET(): Promise<NextResponse> {
  const outboundConfigured = !!(
    process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_PHONE_NUMBER_ID &&
    process.env.ELEVENLABS_BOOKING_AGENT_ID
  );

  return NextResponse.json({
    endpoint: "/api/mcp/make-booking",
    description:
      "Initiate an outbound call to a business (restaurant, hotel, activity) using a dedicated booking agent (ElevenLabs Conversational AI)",
    outbound_configured: outboundConfigured,
    agent: "Pelayo (Booking)",
    required_fields: [
      "venue_name",
      "phone_number",
      "party_size",
      "date",
      "time",
      "customer_name",
      "customer_phone",
    ],
    required_headers: ["x-mcp-secret", "Idempotency-Key"],
    optional_fields: ["special_requests", "language"],
    example_request: {
      venue_name: "Casa Gerardo",
      phone_number: "+34 985 88 77 97",
      party_size: 4,
      date: "hoy",
      time: "21:00",
      customer_name: "Juan García López",
      customer_phone: "+34 612 345 678",
      special_requests: "Trona para bebé",
      language: "es",
    },
  });
}
