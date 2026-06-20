import { logger } from "@/lib/logger";
import { formatDateNatural, formatTimeNatural } from "./booking-service";

/**
 * ElevenLabs outbound-call service.
 *
 * Extracted from src/app/api/mcp/make-booking/route.ts (#625). Encapsulates
 * the ElevenLabs native Twilio outbound-call request used by the dedicated
 * booking agent (NOT the tourism guide Pelayo). Behavior is preserved exactly.
 */

export interface InitiateCallInput {
  customer_name: string;
  /** Contact number for the restaurant to call back. */
  customer_phone: string;
  party_size: number;
  date: string;
  time: string;
  special_requests?: string;
}

export interface InitiateCallResult {
  success: boolean;
  callSid?: string;
  conversationId?: string;
  error?: string;
}

/** Make the outbound call via the ElevenLabs Twilio integration. */
export async function initiateCall(
  phoneNumber: string,
  request: InitiateCallInput
): Promise<InitiateCallResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID?.trim();
  // Use dedicated booking agent - NOT the tourism guide Pelayo
  const bookingAgentId = process.env.ELEVENLABS_BOOKING_AGENT_ID?.trim();

  if (!apiKey || !phoneNumberId || !bookingAgentId) {
    return {
      success: false,
      error:
        "ElevenLabs booking agent not configured. Set ELEVENLABS_BOOKING_AGENT_ID in environment.",
    };
  }

  try {
    // Build request body for the dedicated booking agent
    // The booking agent only needs reservation-specific variables
    const requestBody: Record<string, unknown> = {
      agent_id: bookingAgentId,
      agent_phone_number_id: phoneNumberId,
      to_number: phoneNumber,
      conversation_initiation_client_data: {
        dynamic_variables: {
          customer_name: request.customer_name,
          // Format phone for natural reading: remove +34 prefix for Spanish numbers
          customer_phone: request.customer_phone.replace(/^\+34\s?/, ""),
          party_size: String(request.party_size),
          // Format date with correct grammar: "hoy" stays "hoy", "viernes" → "el viernes"
          date: formatDateNatural(request.date),
          // Convert 24h time to natural Spanish: "21:00" → "nueve de la noche"
          time: formatTimeNatural(request.time),
          special_requests: request.special_requests || "ninguna",
        },
      },
    };

    // Use US regional endpoint to match Twilio webhook configuration.
    // 15-second timeout prevents hung requests from leaving pending_bookings rows
    // stuck in 'initiating' state and causing 409 conflicts on retry (BE-H4).
    const response = await fetch(
      "https://api.us.elevenlabs.io/v1/convai/twilio/outbound-call",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15_000),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      logger.error("[MAKE_BOOKING_ELEVENLABS_REQUEST_FAILED]", {
        response_status: response.status,
        error_body: data,
      });
      return {
        success: false,
        error:
          data.detail?.message ||
          data.message ||
          `ElevenLabs API error: ${response.status}`,
      };
    }

    return {
      success: true,
      callSid:
        typeof data.callSid === "string" && data.callSid.trim()
          ? data.callSid
          : undefined,
      conversationId:
        typeof data.conversation_id === "string" && data.conversation_id.trim()
          ? data.conversation_id
          : undefined,
    };
  } catch (error) {
    logger.error("[MAKE_BOOKING_CALL_INITIATION_FAILED]", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
