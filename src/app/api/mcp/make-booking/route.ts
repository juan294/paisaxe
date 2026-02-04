import { NextResponse } from "next/server";

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
 */

interface MakeBookingRequest {
  // Required fields
  venue_name: string;
  phone_number: string;
  party_size: number;
  date: string; // ISO date string or natural language like "hoy", "mañana"
  time: string; // e.g., "20:00" or "9pm" or "esta noche"
  customer_name: string;
  customer_phone: string; // Contact number for the restaurant to call back

  // Optional fields
  special_requests?: string;
  language?: "es" | "en"; // Default to Spanish for Asturias
}

interface MakeBookingResponse {
  success: boolean;
  message: string;
  call_sid?: string;
  status?: "initiated" | "queued" | "failed" | "not_configured";
  estimated_wait?: string;
  fallback_action?: string;
}

// Validate Spanish phone number format
function isValidSpanishPhone(phone: string): boolean {
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

// Normalize phone to E.164 format for Twilio
function normalizePhoneNumber(phone: string): string {
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

// Format date with correct Spanish grammar
// "hoy" → "hoy" (no article)
// "mañana" → "mañana" (no article)
// "viernes" → "el viernes" (needs article)
// "15 de febrero" → "el 15 de febrero" (needs article)
function formatDateNatural(date: string): string {
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

// Convert 24-hour time to natural Spanish format
// "21:00" → "nueve de la noche"
// "14:30" → "dos y media de la tarde"
// "9:00" → "nueve de la mañana"
function formatTimeNatural(time: string): string {
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

// Make the outbound call via ElevenLabs API
async function initiateCall(
  phoneNumber: string,
  request: MakeBookingRequest
): Promise<{ success: boolean; callSid?: string; conversationId?: string; error?: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
  // Use dedicated booking agent - NOT the tourism guide Pelayo
  const bookingAgentId = process.env.ELEVENLABS_BOOKING_AGENT_ID;

  if (!apiKey || !phoneNumberId || !bookingAgentId) {
    return {
      success: false,
      error: "ElevenLabs booking agent not configured. Set ELEVENLABS_BOOKING_AGENT_ID in environment.",
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

    console.log("[make-booking] Request body:", JSON.stringify(requestBody, null, 2));

    // Use US regional endpoint to match Twilio webhook configuration
    const response = await fetch(
      "https://api.us.elevenlabs.io/v1/convai/twilio/outbound-call",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();
    console.log("[make-booking] Full ElevenLabs response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("[make-booking] ElevenLabs error:", data);
      return {
        success: false,
        error: data.detail?.message || data.message || `ElevenLabs API error: ${response.status}`,
      };
    }

    console.log(
      `[make-booking] Call initiated to ${request.venue_name}: ${data.callSid || data.conversation_id}`
    );

    return {
      success: true,
      callSid: data.callSid,
      conversationId: data.conversation_id,
    };
  } catch (error) {
    console.error("[make-booking] Failed to initiate call:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();

    // Support both flat format and MCP format
    let params: Partial<MakeBookingRequest>;

    if (body.arguments) {
      // MCP tool call format
      params = body.arguments;
    } else {
      // Flat format from ElevenLabs webhook
      params = body;
    }

    // Validate required fields
    const {
      venue_name,
      phone_number,
      party_size,
      date,
      time,
      customer_name,
      customer_phone,
    } = params;

    if (
      !venue_name ||
      !phone_number ||
      !party_size ||
      !date ||
      !time ||
      !customer_name ||
      !customer_phone
    ) {
      return NextResponse.json<MakeBookingResponse>(
        {
          success: false,
          message:
            "Missing required fields: venue_name, phone_number, party_size, date, time, customer_name, customer_phone",
          status: "failed",
        },
        { status: 400 }
      );
    }

    // Validate phone number
    if (!isValidSpanishPhone(phone_number)) {
      return NextResponse.json<MakeBookingResponse>(
        {
          success: false,
          message: `Invalid Spanish phone number: ${phone_number}. Please provide a valid Spanish phone number.`,
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
      console.log("[make-booking] ElevenLabs outbound calling not configured, returning mock response");
      return NextResponse.json<MakeBookingResponse>({
        success: false,
        message: `Outbound calling is not configured. To make a reservation at ${venue_name}, please call them directly at ${phone_number}.`,
        status: "not_configured",
        fallback_action: `Tell the user: "I cannot make calls yet, but you can call ${venue_name} directly at ${phone_number} to make a reservation for ${party_size} people on ${date} at ${time}."`,
      });
    }

    // Build the full request object
    const callRequest: MakeBookingRequest = {
      venue_name,
      phone_number,
      party_size: Number(party_size),
      date,
      time,
      customer_name,
      customer_phone,
      special_requests: params.special_requests,
      language: params.language || "es",
    };

    // Normalize phone number for calling
    const normalizedPhone = normalizePhoneNumber(phone_number);

    // Initiate the call via ElevenLabs
    const result = await initiateCall(normalizedPhone, callRequest);

    if (result.success) {
      return NextResponse.json<MakeBookingResponse>({
        success: true,
        message: `Calling ${venue_name} now to make a reservation for ${party_size} people on ${date} at ${time} under the name ${customer_name}. Pelayo will speak with the restaurant staff.`,
        call_sid: result.callSid || result.conversationId,
        status: "initiated",
        estimated_wait: "30-60 seconds",
      });
    } else {
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
    console.error("[make-booking] Error:", err);
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
