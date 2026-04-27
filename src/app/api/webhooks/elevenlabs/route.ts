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
const SMS_JOB_LEASE_SECONDS = 15 * 60;

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

interface ClaimedSMSJob {
  booking_id: string;
  event_key: string;
  to_phone: string;
  message: string;
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

function buildElevenLabsEventKey(conversationId: string) {
  return `post_call_transcription:${conversationId}`;
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

    // Analyze call outcome
    // ElevenLabs may send transcript/analysis at top level or nested in data
    const outcome = analyzeOutcome({
      analysis: body.analysis ?? body.data?.analysis,
      transcript: body.transcript ?? body.data?.transcript,
    });

    const eventKey = buildElevenLabsEventKey(conversationId);

    // Check if SMS confirmation feature is enabled before calling the RPC so we
    // can pass the phone + message atomically.  This means the SMS outbox row is
    // inserted in the same transaction as the booking status update, eliminating
    // the window where booking state is committed but no outbox row exists yet.
    const smsEnabled = await isFeatureFlagEnabled("sms_booking_confirmation");
    const smsMessage = getSMSMessage(booking as PendingBooking, outcome);

    const { data: rpcStatus, error: rpcError } = await supabase.rpc(
      "process_elevenlabs_event_idempotent",
      {
        p_event_key: eventKey,
        p_booking_id: booking.id,
        p_outcome: outcome,
        // Pass SMS data so the outbox row is enqueued atomically with the
        // booking state update.  NULL values are safe — the function skips
        // the INSERT when either parameter is absent.
        p_to_phone: smsEnabled ? booking.customer_phone : null,
        p_sms_message: smsEnabled ? smsMessage : null,
      }
    );

    if (rpcError) {
      logger.error("[ELEVENLABS_WEBHOOK_RPC_FAILURE]", {
        booking_id: booking.id,
        conversation_id: conversationId,
        error: rpcError.message,
      });
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (rpcStatus === "booking_missing") {
      logger.warn("[ELEVENLABS_WEBHOOK_BOOKING_MISSING_AT_RPC]", {
        booking_id: booking.id,
        conversation_id: conversationId,
      });
      return NextResponse.json(
        {
          success: true,
          ignored: true,
          reason: "Booking missing during processing",
        },
        { status: 200 }
      );
    }

    // Send SMS if feature is enabled
    let smsSent = false;
    let smsError: string | undefined;

    if (smsEnabled) {
      // enqueue_booking_sms_job is now an idempotent upsert — for freshly
      // processed events the row was already inserted atomically above;
      // this call is a no-op for those rows.  For duplicate events it
      // re-queues a previously failed job so the webhook can retry it.
      const { error: enqueueError } = await supabase.rpc(
        "enqueue_booking_sms_job",
        {
          p_event_key: eventKey,
          p_booking_id: booking.id,
          p_to_phone: booking.customer_phone,
          p_message: smsMessage,
        }
      );

      if (enqueueError) {
        logger.error("[ELEVENLABS_WEBHOOK_SMS_ENQUEUE_FAILED]", {
          booking_id: booking.id,
          event_key: eventKey,
          error: enqueueError.message,
        });
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      const { data: claimedSMSJob, error: claimSMSError } = await supabase.rpc(
        "claim_booking_sms_job",
        {
          p_event_key: eventKey,
          p_lease_seconds: SMS_JOB_LEASE_SECONDS,
        }
      );

      if (claimSMSError) {
        logger.error("[ELEVENLABS_WEBHOOK_SMS_CLAIM_FAILED]", {
          booking_id: booking.id,
          event_key: eventKey,
          error: claimSMSError.message,
        });
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      const smsJob = claimedSMSJob as ClaimedSMSJob | null;

      if (smsJob) {
        // Attempt SMS send outside the transaction. If it fails the durable
        // booking_sms_jobs row (sms_outbox) persists with status=failed and can
        // be retried by a cron job or re-attempted on the next webhook event for
        // the same booking. We must NOT return 500 here — the booking state was
        // already committed transactionally by process_elevenlabs_event_idempotent.
        let smsResult: Awaited<ReturnType<typeof sendSMS>>;
        try {
          smsResult = await sendSMS(smsJob.to_phone, smsJob.message);
        } catch (sendError) {
          const errMsg =
            sendError instanceof Error ? sendError.message : "SMS send threw unexpectedly";
          logger.error("[ELEVENLABS_WEBHOOK_SMS_THREW]", {
            booking_id: booking.id,
            error: errMsg,
          });
          smsResult = { success: false, error: errMsg };
        }

        smsSent = smsResult.success;
        smsError = smsResult.error;

        if (!smsResult.success) {
          logger.error("[ELEVENLABS_WEBHOOK_SMS_FAILED]", {
            booking_id: booking.id,
            error: smsResult.error,
          });

          const { error: failSMSError } = await supabase.rpc(
            "fail_booking_sms_job",
            {
              p_event_key: eventKey,
              p_error: smsResult.error ?? "SMS delivery failed",
            }
          );

          if (failSMSError) {
            logger.error("[ELEVENLABS_WEBHOOK_SMS_FAIL_MARK_FAILED]", {
              booking_id: booking.id,
              event_key: eventKey,
              error: failSMSError.message,
            });
          }

          // Booking state was committed — return 200. The sms_outbox row is
          // persisted with status=failed and will be retried asynchronously.
          return NextResponse.json(
            {
              success: true,
              status: rpcStatus,
              bookingId: booking.id,
              outcome,
              smsSent: false,
              smsError,
            },
            { status: 200 }
          );
        }

        // BE-M6: outcome_message is passed to the RPC for a single atomic operation.
        // A separate pending_bookings UPDATE after this point would risk being lost
        // forever — the idempotency key prevents re-attempt, so a failure here
        // leaves outcome_message NULL with no recovery path.
        const { error: completeSMSError } = await supabase.rpc(
          "complete_booking_sms_job",
          {
            p_event_key: eventKey,
            p_provider_sid: smsResult.sid ?? null,
            p_outcome_message: smsMessage,
          }
        );

        if (completeSMSError) {
          logger.error("[ELEVENLABS_WEBHOOK_SMS_COMPLETE_FAILED]", {
            booking_id: booking.id,
            event_key: eventKey,
            error: completeSMSError.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: rpcStatus,
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
