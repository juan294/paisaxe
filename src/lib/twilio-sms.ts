/**
 * Twilio SMS utility for sending booking confirmations.
 *
 * Uses existing Twilio credentials configured for ElevenLabs outbound calling.
 * Sends SMS to customers after booking agent calls complete.
 */

export interface PendingBooking {
  id: string;
  conversation_id: string;
  venue_name: string;
  venue_phone: string;
  customer_name: string;
  customer_phone: string;
  party_size: number;
  booking_date: string;
  booking_time: string;
  special_requests: string | null;
  status: string;
  outcome_message: string | null;
  created_at: string;
  updated_at: string;
}

interface SendSMSResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Send an SMS via Twilio.
 *
 * @param to - Phone number in E.164 format (e.g., +34612345678)
 * @param body - Message text
 */
export async function sendSMS(to: string, body: string): Promise<SendSMSResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    console.error("[twilio-sms] Missing Twilio credentials");
    return {
      success: false,
      error: "Twilio not configured",
    };
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: fromNumber,
          Body: body,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[twilio-sms] API error:", data);
      return {
        success: false,
        error: data.message || `Twilio error: ${response.status}`,
      };
    }

    return {
      success: true,
      sid: data.sid,
    };
  } catch (error) {
    console.error("[twilio-sms] Failed to send SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Format time for display in SMS (e.g., "21:00" stays as "21:00")
 */
function formatTime(time: string): string {
  // If time is already in HH:MM format, return as-is
  if (/^\d{1,2}:\d{2}$/.test(time)) {
    return time;
  }
  // Otherwise return the natural language version
  return time;
}

/**
 * Build SMS message for confirmed booking.
 */
export function buildConfirmationSMS(booking: PendingBooking): string {
  const time = formatTime(booking.booking_time);
  return [
    "✓ Reserva confirmada",
    "",
    booking.venue_name,
    `📅 ${booking.booking_date}, ${time}`,
    `👥 ${booking.party_size} ${booking.party_size === 1 ? "persona" : "personas"}`,
    `📞 ${booking.venue_phone}`,
    "",
    "— Pelayo (paisaxe.es)",
  ].join("\n");
}

/**
 * Build SMS message for denied booking.
 */
export function buildDeniedSMS(booking: PendingBooking, reason?: string): string {
  const time = formatTime(booking.booking_time);
  const reasonText =
    reason ||
    `no tiene mesa para ${booking.party_size} ${booking.party_size === 1 ? "persona" : "personas"} ${booking.booking_date} a las ${time}`;

  return [
    "✗ No disponible",
    "",
    `${booking.venue_name} ${reasonText}.`,
    "",
    `Puedes llamarles directamente: ${booking.venue_phone}`,
    "",
    "— Pelayo (paisaxe.es)",
  ].join("\n");
}

/**
 * Build SMS message for no answer.
 */
export function buildNoAnswerSMS(booking: PendingBooking): string {
  return [
    "📞 Sin respuesta",
    "",
    `No pudimos contactar con ${booking.venue_name}.`,
    "",
    `Prueba a llamar directamente: ${booking.venue_phone}`,
    "",
    "— Pelayo (paisaxe.es)",
  ].join("\n");
}

/**
 * Build SMS message for failed call.
 */
export function buildFailedSMS(booking: PendingBooking): string {
  return [
    "⚠️ Error en la llamada",
    "",
    `No pudimos completar la llamada a ${booking.venue_name}.`,
    "",
    `Puedes llamarles directamente: ${booking.venue_phone}`,
    "",
    "— Pelayo (paisaxe.es)",
  ].join("\n");
}
