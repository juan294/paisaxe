import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";
import {
  sendSMS,
  buildConfirmationSMS,
  buildDeniedSMS,
  buildNoAnswerSMS,
  buildFailedSMS,
  type PendingBooking,
} from "@/lib/twilio-sms";

/**
 * POST /api/webhooks/elevenlabs
 *
 * Handles post_call_transcription webhook from ElevenLabs booking agent.
 * - Verifies HMAC signature
 * - Looks up pending booking by conversation_id
 * - Analyzes call outcome from transcript/analysis
 * - Sends SMS confirmation to customer
 * - Updates booking status in database
 */

// Outcome types for booking calls
type BookingOutcome = "confirmed" | "denied" | "no_answer" | "failed";

// Keywords to detect booking outcome from transcript
const CONFIRMED_PATTERNS = [
  "confirmad",
  "reservad",
  "perfecto",
  "apuntado",
  "esperamos",
  "le esperamos",
  "anotado",
  "confirmamos",
  "sin problema",
  "de acuerdo",
  "muy bien",
  "estupendo",
];

const DENIED_PATTERNS = [
  "completo",
  "no tenemos",
  "no hay",
  "lleno",
  "sin disponibilidad",
  "no podemos",
  "imposible",
  "no queda",
  "agotado",
  "cerrado",
  "no abrimos",
];

const NO_ANSWER_PATTERNS = [
  "buzón",
  "voicemail",
  "no contesta",
  "ocupado",
  "no disponible",
  "mensaje",
  "después del tono",
  "no ha sido posible",
];

// 30-minute tolerance for timestamp validation (matches ElevenLabs SDK)
const TIMESTAMP_TOLERANCE_SECONDS = 30 * 60;

/**
 * Parse ElevenLabs signature header format: "t=timestamp,v0=signature"
 */
function parseSignatureHeader(
  header: string
): { timestamp: number; signature: string } | null {
  const parts: Record<string, string> = {};
  for (const part of header.split(",")) {
    const [key, ...rest] = part.split("=");
    if (key && rest.length > 0) {
      parts[key] = rest.join("=");
    }
  }

  const timestamp = parts["t"] ? parseInt(parts["t"], 10) : NaN;
  const signature = parts["v0"];

  if (isNaN(timestamp) || !signature) {
    return null;
  }

  return { timestamp, signature };
}

/**
 * Verify ElevenLabs webhook signature using HMAC-SHA256.
 *
 * ElevenLabs signs webhooks with: HMAC-SHA256("${timestamp}.${rawBody}", secret)
 * The signature header format is: "t=timestamp,v0=hex_digest"
 */
function verifySignature(
  payload: string,
  sigHeader: string
): "valid" | "invalid" | "expired" | "missing_secret" {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET?.trim();

  if (!secret) {
    console.error("[elevenlabs-webhook] ELEVENLABS_WEBHOOK_SECRET not configured");
    return "missing_secret";
  }

  const parsed = parseSignatureHeader(sigHeader);
  if (!parsed) {
    return "invalid";
  }

  const { timestamp, signature } = parsed;

  // Validate timestamp freshness (reject replays older than 30 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    return "expired";
  }

  try {
    // ElevenLabs signs "${timestamp}.${rawBody}"
    const message = `${timestamp}.${payload}`;
    const hmac = createHmac("sha256", secret);
    hmac.update(message);
    const expectedSignature = hmac.digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedBuffer.length) {
      return "invalid";
    }

    return timingSafeEqual(sigBuffer, expectedBuffer) ? "valid" : "invalid";
  } catch {
    return "invalid";
  }
}

// ElevenLabs transcript entry format
interface TranscriptEntry {
  role: "user" | "agent";
  message: string;
  time_in_call_secs?: number;
}

/**
 * Extract plain text from ElevenLabs transcript array.
 * Transcript is an array of {role, message} objects, not a plain string.
 */
function extractTranscriptText(
  transcript: TranscriptEntry[] | string | undefined
): string {
  if (!transcript) return "";
  // Handle legacy string format (backwards compatibility)
  if (typeof transcript === "string") return transcript;
  // Handle array format (actual ElevenLabs payload)
  if (Array.isArray(transcript)) {
    return transcript
      .map((entry) => entry.message || "")
      .join(" ");
  }
  return "";
}

/**
 * Analyze call transcript/analysis to determine booking outcome.
 *
 * ElevenLabs payload format:
 * - transcript: array of {role, message, time_in_call_secs} objects
 * - analysis.call_successful: "success" | "failure" | "unknown" (string enum, NOT boolean)
 * - analysis.transcript_summary: string
 */
function analyzeOutcome(webhookData: {
  analysis?: {
    call_successful?: string | boolean;
    transcript_summary?: string;
  };
  transcript?: TranscriptEntry[] | string;
}): BookingOutcome {
  const { analysis, transcript } = webhookData;

  // If call wasn't successful at all, it's a no_answer or failed
  // ElevenLabs uses string enum: "success" | "failure" | "unknown"
  if (
    analysis?.call_successful === "failure" ||
    analysis?.call_successful === false
  ) {
    return "no_answer";
  }

  // Extract text from transcript array and combine with summary
  const transcriptText = extractTranscriptText(transcript);
  const textToAnalyze = [
    transcriptText,
    analysis?.transcript_summary || "",
  ]
    .join(" ")
    .toLowerCase();

  // Check for no answer patterns first (voicemail, etc.)
  for (const pattern of NO_ANSWER_PATTERNS) {
    if (textToAnalyze.includes(pattern)) {
      return "no_answer";
    }
  }

  // Check for denied patterns (no availability)
  for (const pattern of DENIED_PATTERNS) {
    if (textToAnalyze.includes(pattern)) {
      return "denied";
    }
  }

  // Check for confirmed patterns
  for (const pattern of CONFIRMED_PATTERNS) {
    if (textToAnalyze.includes(pattern)) {
      return "confirmed";
    }
  }

  // Default to failed if we can't determine outcome
  return "failed";
}

/**
 * Get the appropriate SMS message based on outcome.
 */
function getSMSMessage(booking: PendingBooking, outcome: BookingOutcome): string {
  switch (outcome) {
    case "confirmed":
      return buildConfirmationSMS(booking);
    case "denied":
      return buildDeniedSMS(booking);
    case "no_answer":
      return buildNoAnswerSMS(booking);
    case "failed":
    default:
      return buildFailedSMS(booking);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get signature from header (ElevenLabs uses "elevenlabs-signature")
    const sigHeader = request.headers.get("elevenlabs-signature");

    if (!sigHeader) {
      console.warn("[elevenlabs-webhook] Missing signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Verify signature (format: "t=timestamp,v0=hmac_hex")
    const verifyResult = verifySignature(rawBody, sigHeader);

    if (verifyResult === "expired") {
      console.warn("[elevenlabs-webhook] Signature timestamp expired");
      return NextResponse.json(
        { error: "Signature expired" },
        { status: 401 }
      );
    }

    if (verifyResult !== "valid") {
      console.warn(`[elevenlabs-webhook] Invalid signature: ${verifyResult}`);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse payload
    const body = JSON.parse(rawBody);

    // ElevenLabs sends different event types - only handle post_call_transcription
    const eventType = body.event_type || body.type;
    if (eventType && eventType !== "post_call_transcription") {
      return NextResponse.json({ success: true, ignored: true });
    }

    // Extract conversation_id from webhook payload
    const conversationId = body.conversation_id || body.data?.conversation_id;

    if (!conversationId) {
      console.error("[elevenlabs-webhook] Missing conversation_id in payload");
      return NextResponse.json(
        { error: "Missing conversation_id" },
        { status: 400 }
      );
    }

    // Look up pending booking
    const supabase = createAdminClient();

    const { data: booking, error: fetchError } = await supabase
      .from("pending_bookings")
      .select("*")
      .eq("conversation_id", conversationId)
      .single();

    if (fetchError || !booking) {
      console.warn(
        `[elevenlabs-webhook] No pending booking found for conversation: ${conversationId}`
      );
      // Return 200 to acknowledge receipt - this might be a call we didn't initiate
      return NextResponse.json({
        success: true,
        ignored: true,
        reason: "No pending booking found",
      });
    }

    // Check if SMS confirmation feature is enabled
    const smsEnabled = await isFeatureFlagEnabled("sms_booking_confirmation");

    // Analyze call outcome
    const outcome = analyzeOutcome({
      analysis: body.analysis,
      transcript: body.transcript,
    });

    // Build SMS message
    const smsMessage = getSMSMessage(booking as PendingBooking, outcome);

    // Send SMS if feature is enabled
    let smsSent = false;
    let smsError: string | undefined;

    if (smsEnabled) {
      const smsResult = await sendSMS(booking.customer_phone, smsMessage);
      smsSent = smsResult.success;
      smsError = smsResult.error;

      if (!smsResult.success) {
        console.error(
          `[elevenlabs-webhook] Failed to send SMS for booking ${booking.id}:`,
          smsResult.error
        );
      }
    }

    // Update booking status in database
    const { error: updateError } = await supabase
      .from("pending_bookings")
      .update({
        status: outcome,
        outcome_message: smsEnabled && smsSent ? smsMessage : null,
      })
      .eq("id", booking.id);

    if (updateError) {
      console.error(
        `[elevenlabs-webhook] Failed to update booking ${booking.id}:`,
        updateError
      );
      // Don't return error - SMS was already sent
    }

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      outcome,
      smsSent,
      smsError,
    });
  } catch (error) {
    console.error("[elevenlabs-webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
