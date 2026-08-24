import "server-only";
import { ELEVENLABS_BOOKING_AGENT_ID } from "@/config/elevenlabs-owned-agents";
import {
  ElevenLabsCredentialError,
  getElevenLabsRuntimeCredential,
} from "@/lib/elevenlabs-credentials";
import {
  classifyElevenLabsProviderStatus,
  logElevenLabsFailure,
} from "@/lib/elevenlabs-observability";
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
  /**
   * BE-H2: the pending_bookings row id, claimed BEFORE this call is placed.
   * Sent as an extra dynamic variable (not referenced by the agent prompt,
   * same pattern as customer_phone) purely so ElevenLabs echoes it back in
   * the post_call_transcription webhook's conversation_initiation_client_data
   * — an unambiguous fallback correlation key for calls whose fetch to
   * ElevenLabs times out before we learn the conversation_id.
   */
  booking_id?: string;
}

export interface InitiateCallResult {
  success: boolean;
  callSid?: string;
  conversationId?: string;
  error?: string;
  /**
   * BE-H2: true when the call timed out or was aborted before ElevenLabs
   * could respond. The caller should NOT mark the booking 'failed' — the
   * row stays in 'initiating' so the stale-bookings cron or a late webhook
   * can reconcile.
   */
  timedOut?: true;
}

/** Make the outbound call via the ElevenLabs Twilio integration. */
export async function initiateCall(
  phoneNumber: string,
  request: InitiateCallInput
): Promise<InitiateCallResult> {
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID?.trim();
  // Use dedicated booking agent - NOT the tourism guide Pelayo
  const bookingAgentId = process.env.ELEVENLABS_BOOKING_AGENT_ID?.trim();

  if (!process.env.ELEVENLABS_API_KEY?.trim() || !phoneNumberId || !bookingAgentId) {
    return {
      success: false,
      error:
        "ElevenLabs booking agent not configured. Set ELEVENLABS_BOOKING_AGENT_ID in environment.",
    };
  }

  let apiKey: string;
  let fingerprint: string;
  let fingerprintMatches: boolean;
  try {
    ({ apiKey, fingerprint, fingerprintMatches } =
      getElevenLabsRuntimeCredential());
  } catch (error) {
    const credentialError =
      error instanceof ElevenLabsCredentialError ? error : undefined;
    logElevenLabsFailure({
      source: "booking-call",
      agentKey: "booking",
      failureClass: credentialError?.code ?? "unknown",
      fingerprint: credentialError?.fingerprint,
      fingerprintMatches: credentialError?.fingerprintMatches ?? false,
    });
    return {
      success: false,
      error: "ElevenLabs runtime credential rejected",
    };
  }

  if (
    process.env.VERCEL_ENV &&
    bookingAgentId !== ELEVENLABS_BOOKING_AGENT_ID
  ) {
    logElevenLabsFailure({
      source: "booking-call",
      agentKey: "booking",
      failureClass: "agent_identity_mismatch",
      fingerprint,
      fingerprintMatches,
    });
    return {
      success: false,
      error: "ElevenLabs booking agent identity mismatch",
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
          // BE-H2: correlation key for webhook fallback reconciliation — omit
          // entirely when absent rather than sending an empty string, so the
          // webhook handler can tell "no hint" apart from "empty hint".
          ...(request.booking_id ? { booking_id: request.booking_id } : {}),
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

    if (!response.ok) {
      logElevenLabsFailure({
        source: "booking-call",
        agentKey: "booking",
        failureClass: classifyElevenLabsProviderStatus(response.status),
        providerStatus: response.status,
        fingerprint,
        fingerprintMatches,
      });
      return {
        success: false,
        error: `ElevenLabs API error: ${response.status}`,
      };
    }

    const data = await response.json();

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
    // BE-H2: Distinguish a timeout/abort (AbortError / TimeoutError emitted by
    // AbortSignal.timeout) from a definitive ElevenLabs error.  On timeout we
    // do NOT know whether ElevenLabs accepted the call, so callers must leave
    // the pending_bookings row in 'initiating' for later reconciliation.
    // We check .name directly (not just instanceof Error) because DOMException
    // may not extend Error in all JS runtimes/environments.
    const errorName = (error as { name?: string } | null)?.name;
    const isTimeout =
      errorName === "AbortError" || errorName === "TimeoutError";

    logElevenLabsFailure({
      source: "booking-call",
      agentKey: "booking",
      failureClass: isTimeout ? "upstream_timeout" : "upstream_unavailable",
      fingerprint,
      fingerprintMatches,
    });

    return {
      success: false,
      error: isTimeout
        ? "ElevenLabs request timed out"
        : "ElevenLabs request unavailable",
      ...(isTimeout ? { timedOut: true as const } : {}),
    };
  }
}
