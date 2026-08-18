import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";
import { logger } from "@/lib/logger";
import { sendSMS, type PendingBooking } from "@/lib/twilio-sms";
import {
  analyzeOutcome,
  buildElevenLabsEventKey,
  getSMSMessage,
  verifySignature,
} from "@/lib/services/elevenlabs-webhook-service";

/**
 * POST /api/webhooks/elevenlabs
 *
 * Handles post_call_transcription webhook from ElevenLabs booking agent.
 * - Verifies HMAC signature
 * - Looks up pending booking by conversation_id
 * - Analyzes call outcome from transcript/analysis
 * - Sends SMS confirmation to customer
 * - Updates booking status in database
 *
 * Signature verification, transcript/outcome analysis, and SMS-message
 * selection live in `src/lib/services/elevenlabs-webhook-service.ts` (#625).
 * This handler keeps the request orchestration: verify → look up booking →
 * run the idempotent RPC → claim/send the SMS job.
 */

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

// BE-H2: dynamic_variables carries whatever we sent when placing the call
// (customer_name, party_size, ..., and our own `booking_id` correlation
// key) — passthrough() since we only care about reading `booking_id` back
// out and don't want to reject/warn on the other echoed variables.
const ConversationInitiationClientDataSchema = z
  .object({
    dynamic_variables: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const ElevenLabsWebhookSchema = z
  .object({
    conversation_id: z.string().optional(),
    event_type: z.string().optional(),
    type: z.string().optional(),
    transcript: z.union([z.array(TranscriptEntrySchema), z.string()]).optional(),
    analysis: AnalysisSchema.optional(),
    conversation_initiation_client_data: ConversationInitiationClientDataSchema.optional(),
    data: z
      .object({
        conversation_id: z.string().optional(),
        transcript: z.union([z.array(TranscriptEntrySchema), z.string()]).optional(),
        analysis: AnalysisSchema.optional(),
        conversation_initiation_client_data:
          ConversationInitiationClientDataSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

/**
 * BE-H2: Extract the `booking_id` correlation key we sent as an extra
 * dynamic variable when placing the call (see elevenlabs-call-service.ts).
 * Checks both the top-level and data-wrapped payload shapes, matching the
 * pattern already used for conversation_id/transcript/analysis above.
 */
function extractBookingIdHint(body: {
  conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> };
  data?: { conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } };
}): string | null {
  const dynamicVars =
    body.conversation_initiation_client_data?.dynamic_variables ??
    body.data?.conversation_initiation_client_data?.dynamic_variables;
  const bookingId = dynamicVars?.booking_id;
  return typeof bookingId === "string" && bookingId.trim() ? bookingId : null;
}

interface ClaimedSMSJob {
  booking_id: string;
  event_key: string;
  to_phone: string;
  message: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Get signature from header (ElevenLabs uses "elevenlabs-signature")
    const sigHeader = request.headers.get("elevenlabs-signature");

    if (!sigHeader) {
      logger.warn("[ELEVENLABS_WEBHOOK_SIGNATURE_MISSING]");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // Verify signature (format: "t=timestamp,v0=hmac_hex")
    const verifyResult = verifySignature(rawBody, sigHeader);

    if (verifyResult === "expired") {
      logger.warn("[ELEVENLABS_WEBHOOK_SIGNATURE_EXPIRED]");
      return NextResponse.json({ error: "Signature expired" }, { status: 401 });
    }

    if (verifyResult !== "valid") {
      logger.warn("[ELEVENLABS_WEBHOOK_SIGNATURE_INVALID]", {
        verify_result: verifyResult,
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
    let { data: booking, error: fetchError } = await supabase
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

      // BE-H2: A call that timed out on our side before ElevenLabs responded
      // never got a conversation_id persisted, so it's invisible to the
      // lookup above even though the call may have actually happened. We
      // sent our own pending_bookings.id as a `booking_id` dynamic variable
      // when placing the call (see initiateCall/elevenlabs-call-service.ts)
      // specifically so it comes back here — matching on our own primary
      // key makes this fallback unambiguous by construction (it cannot let
      // one webhook event resolve two different bookings, so the unique
      // index on conversation_id is unaffected).
      const bookingIdHint = extractBookingIdHint(body);

      if (bookingIdHint) {
        const { data: fallbackBooking, error: fallbackFetchError } = await supabase
          .from("pending_bookings")
          .select("*")
          .eq("id", bookingIdHint)
          .maybeSingle();

        if (fallbackFetchError) {
          logger.error("[ELEVENLABS_WEBHOOK_ORPHAN_LOOKUP_FAILED]", {
            booking_id: bookingIdHint,
            conversation_id: conversationId,
            error: fallbackFetchError,
          });
        }

        // Only reconcile rows that are actually still reconcilable: no
        // conversation_id linked yet, and in a state that means "we don't
        // know the outcome" ('initiating' or 'orphaned'). This guards
        // against a stale/replayed booking_id resolving an already-settled
        // or already-linked row.
        const isReconcilable =
          fallbackBooking &&
          fallbackBooking.conversation_id == null &&
          ["initiating", "orphaned"].includes(fallbackBooking.status);

        if (isReconcilable) {
          logger.warn("[ELEVENLABS_WEBHOOK_ORPHAN_RECONCILED]", {
            booking_id: bookingIdHint,
            conversation_id: conversationId,
          });
          booking = fallbackBooking;

          // Best-effort: link conversation_id now so any later duplicate
          // webhook for this conversation matches directly. Non-fatal on
          // failure — elevenlabs_webhook_events.event_key is the actual
          // source of truth for dedup, not this column.
          const { error: linkError } = await supabase
            .from("pending_bookings")
            .update({ conversation_id: conversationId })
            .eq("id", bookingIdHint);
          if (linkError) {
            logger.warn("[ELEVENLABS_WEBHOOK_ORPHAN_LINK_FAILED]", {
              booking_id: bookingIdHint,
              conversation_id: conversationId,
              error: linkError,
            });
          }
        }
      }
    }

    if (!booking) {
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
        //
        // BE-M2: retry complete_booking_sms_job up to 2 attempts with a short
        // backoff to avoid leaving the job in 'processing' state (re-claimable
        // → duplicate SMS).  After all retries, log prominently for ops.
        {
          const MAX_COMPLETE_ATTEMPTS = 2;
          let completeSMSError: { message: string } | null = null;
          for (let attempt = 1; attempt <= MAX_COMPLETE_ATTEMPTS; attempt++) {
            const result = await supabase.rpc("complete_booking_sms_job", {
              p_event_key: eventKey,
              p_provider_sid: smsResult.sid ?? null,
              p_outcome_message: smsMessage,
            });
            if (!result.error) {
              completeSMSError = null;
              break;
            }
            completeSMSError = result.error;
            if (attempt < MAX_COMPLETE_ATTEMPTS) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
          if (completeSMSError) {
            logger.error("[ELEVENLABS_WEBHOOK_SMS_COMPLETE_FAILED]", {
              booking_id: booking.id,
              event_key: eventKey,
              error: completeSMSError.message,
              attempts: MAX_COMPLETE_ATTEMPTS,
            });
          }
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
