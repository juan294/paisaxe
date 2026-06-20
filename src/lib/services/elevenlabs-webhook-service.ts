import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { isCallSuccessful } from "@/lib/elevenlabs-call-status";
import {
  buildConfirmationSMS,
  buildDeniedSMS,
  buildNoAnswerSMS,
  buildFailedSMS,
  type PendingBooking,
} from "@/lib/twilio-sms";

/**
 * ElevenLabs post_call_transcription webhook service.
 *
 * Extracted from src/app/api/webhooks/elevenlabs/route.ts (#625): signature
 * verification, transcript extraction, booking-outcome analysis, and SMS
 * message selection. The route handler keeps the orchestration (DB lookup,
 * idempotent RPC, SMS job claim/send). Behavior is preserved exactly.
 */

// Outcome types for booking calls
export type BookingOutcome = "confirmed" | "denied" | "no_answer" | "failed";

export type SignatureVerificationResult =
  | "valid"
  | "invalid"
  | "expired"
  | "missing_secret";

// ElevenLabs transcript entry format
export interface TranscriptEntry {
  role: "user" | "agent";
  message: string;
  time_in_call_secs?: number;
}

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
export function parseSignatureHeader(
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
export function verifySignature(
  payload: string,
  sigHeader: string
): SignatureVerificationResult {
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

/**
 * Extract plain text from ElevenLabs transcript array.
 * Transcript is an array of {role, message} objects, not a plain string.
 */
export function extractTranscriptText(
  transcript: TranscriptEntry[] | string | undefined
): string {
  if (!transcript) return "";
  // Handle legacy string format (backwards compatibility)
  if (typeof transcript === "string") return transcript;
  // Handle array format (actual ElevenLabs payload)
  if (Array.isArray(transcript)) {
    return transcript.map((entry) => entry.message || "").join(" ");
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
export function analyzeOutcome(webhookData: {
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
  const textToAnalyze = [transcriptText, analysis?.transcript_summary || ""]
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
export function getSMSMessage(
  booking: PendingBooking,
  outcome: BookingOutcome
): string {
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

export function buildElevenLabsEventKey(conversationId: string): string {
  return `post_call_transcription:${conversationId}`;
}
