import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";
import { logger } from "@/lib/logger";
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
 * Zod schema for the ElevenLabs post_call_transcription payload.
 * The analysis field has two possible nesting paths:
 *   1. Top-level: { analysis: { call_successful, transcript_summary } }
 *   2. Nested in data: { data: { analysis: { call_successful, transcript_summary } } }
 */
const TranscriptEntrySchema = z
  .object({
    role: z.enum(["user", "agent"]),
    message: z.string().optional(),
    time_in_call_secs: z.number().optional(),
  })
  .strict();

const AnalysisSchema = z
  .object({
    call_successful: z.union([z.string(), z.boolean()]).optional(),
    transcript_summary: z.string().optional(),
  })
  .strict();

const ElevenLabsWebhookSchema = z
  .object({
    conversation_id: z.string().optional(),
    event_type: z.string().optional(),
    type: z.string().optional(),
    transcript: z.union([z.array(TranscriptEntrySchema), z.string()]).optional(),
    analysis: AnalysisSchema.optional(),
    data: z
      .object({
        conversation_id: z.string().optional(),
        transcript: z.union([z.array(TranscriptEntrySchema), z.string()]).optional(),
        analysis: AnalysisSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

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
    logger.error("[ELEVENLABS_WEBHOOK_SECRET_MISSING]");
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
 * Normalize the call_successful field from ElevenLabs webhook analysis.
 *
 * ElevenLabs has delivered this field in multiple formats across API versions:
 * - Boolean: true / false
 * - String enum: "success" / "failure" / "unknown"
 * - String boolean: "true" / "false"
 * - Missing / null / undefined → treat as unsuccessful
 *
 * Returns:
 *  "success"  → call connected and succeeded
 *  "failure"  → call explicitly failed (no answer, network error, etc.)
 *  "unknown"  → ambiguous — fall through to transcript keyword analysis
 */
export function isCallSuccessful(value: unknown): "success" | "failure" | "unknown" {
  if (value === true || value === "success" || value === "true") return "success";
  if (value === false || value === "failure" || value === "false") return "failure";
  // null, undefined, "unknown", or any other value → unknown
  return "unknown";
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

  // Normalize call_successful to handle all field variants
  const callResult = isCallSuccessful(analysis?.call_successful);

  // Explicit failure → no_answer (call didn't connect)
  if (callResult === "failure") {
    return "no_answer";
  }

  // null/undefined/missing also means no successful call → no_answer
  if (callResult === "unknown" && analysis?.call_successful == null) {
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
      logger.warn("[ELEVENLABS_WEBHOOK_SIGNATURE_MISSING]");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    // Verify signature (format: "t=timestamp,v0=hmac_hex")
    const verifyResult = verifySignature(rawBody, sigHeader);

    if (verifyResult === "expired") {
      logger.warn("[ELEVENLABS_WEBHOOK_SIGNATURE_EXPIRED]");
      return NextResponse.json(
        { error: "Signature expired" },
        { status: 401 }
      );
    }

    if (verifyResult !== "valid") {
      logger.warn("[ELEVENLABS_WEBHOOK_SIGNATURE_INVALID]", {
        verify_result: verifyResult,
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse payload
    const body = JSON.parse(rawBody);

    // Zod schema validation — warn on unexpected/missing fields
    const parseResult = ElevenLabsWebhookSchema.safeParse(body);
    if (!parseResult.success) {
      const unknownFields = parseResult.error.issues.flatMap((i) =>
        "keys" in i && Array.isArray(i.keys)
          ? (i.keys as string[])
          : i.path.length > 0
          ? [i.path.join(".")]
          : []
      );
      logger.warn("[WEBHOOK_UNKNOWN_SHAPE]", { webhook: "elevenlabs", fields: unknownFields });
    }

    // ElevenLabs sends different event types - only handle post_call_transcription
    const eventType = body.event_type || body.type;
    if (eventType && eventType !== "post_call_transcription") {
      return NextResponse.json({ success: true, ignored: true });
    }

    // Extract conversation_id from webhook payload
    const conversationId = body.conversation_id || body.data?.conversation_id;

    if (!conversationId) {
      logger.error("[ELEVENLABS_WEBHOOK_CONVERSATION_ID_MISSING]");
      return NextResponse.json(
        { error: "Missing conversation_id" },
        { status: 400 }
      );
    }

    // Look up pending booking
    const supabase = createAdminClient();

    // maybeSingle() returns {data: null, error: null} when no row is found
    const { data: booking, error: fetchError } = await supabase
      .from("pending_bookings")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (fetchError) {
      logger.error("[ELEVENLABS_WEBHOOK_FETCH_BOOKING_FAILED]", {
        conversation_id: conversationId,
        error: fetchError,
      });
    }

    if (!booking) {
      logger.warn("[ELEVENLABS_WEBHOOK_BOOKING_NOT_FOUND]", {
        conversation_id: conversationId,
      });
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
    // ElevenLabs may send transcript/analysis at top level or nested in data
    const outcome = analyzeOutcome({
      analysis: body.analysis ?? body.data?.analysis,
      transcript: body.transcript ?? body.data?.transcript,
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
        logger.error("[ELEVENLABS_WEBHOOK_SMS_FAILED]", {
          booking_id: booking.id,
          error: smsResult.error,
        });
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
      logger.error("[ELEVENLABS_WEBHOOK_UPDATE_BOOKING_FAILED]", {
        booking_id: booking.id,
        error: updateError,
      });
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
    logger.error("[ELEVENLABS_WEBHOOK_UNHANDLED_ERROR]", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
