import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendSMS } from "@/lib/twilio-sms";

const SMS_RETRY_LIMIT = 10;
const SMS_RETRY_LEASE_SECONDS = 15 * 60;
const SMS_RETRY_MAX_ATTEMPTS = 3;

interface RetryableSMSJob {
  booking_id: string;
  event_key: string;
  to_phone: string;
  message: string;
  attempts: number;
}

async function retryBookingSMSJobs(): Promise<NextResponse> {
  const start = Date.now();
  const supabase = createAdminClient();

  const { data: claimedJobs, error: claimError } = await supabase.rpc(
    "claim_retryable_booking_sms_jobs",
    {
      p_limit: SMS_RETRY_LIMIT,
      p_lease_seconds: SMS_RETRY_LEASE_SECONDS,
      p_max_attempts: SMS_RETRY_MAX_ATTEMPTS,
    }
  );

  if (claimError) {
    logger.error("[CRON_FAILURE]", {
      job: "retry-booking-sms",
      error: claimError.message,
    });
    logger.error("[CRON_RETRY_BOOKING_SMS_CLAIM_FAILED]", {
      error: claimError.message,
    });
    return NextResponse.json(
      { error: "Failed to claim retryable SMS jobs" },
      { status: 500 }
    );
  }

  const jobs = (claimedJobs ?? []) as RetryableSMSJob[];
  let sentCount = 0;
  let failedCount = 0;

  for (const job of jobs) {
    let smsResult: Awaited<ReturnType<typeof sendSMS>>;
    try {
      smsResult = await sendSMS(job.to_phone, job.message);
    } catch (error) {
      smsResult = {
        success: false,
        error: error instanceof Error ? error.message : "SMS send threw unexpectedly",
      };
    }

    if (smsResult.success) {
      const { error: completeError } = await supabase.rpc(
        "complete_booking_sms_job",
        {
          p_event_key: job.event_key,
          p_provider_sid: smsResult.sid ?? null,
          p_outcome_message: null,
        }
      );

      if (completeError) {
        failedCount += 1;
        logger.error("[CRON_RETRY_BOOKING_SMS_COMPLETE_FAILED]", {
          booking_id: job.booking_id,
          event_key: job.event_key,
          error: completeError.message,
        });
      } else {
        sentCount += 1;
      }
      continue;
    }

    failedCount += 1;
    const errorMessage = smsResult.error ?? "SMS delivery failed";
    logger.error("[CRON_RETRY_BOOKING_SMS_SEND_FAILED]", {
      booking_id: job.booking_id,
      event_key: job.event_key,
      attempts: job.attempts,
      max_attempts: SMS_RETRY_MAX_ATTEMPTS,
      error: errorMessage,
    });

    const { error: failError } = await supabase.rpc("fail_booking_sms_job", {
      p_event_key: job.event_key,
      p_error: errorMessage,
    });

    if (failError) {
      logger.error("[CRON_RETRY_BOOKING_SMS_FAIL_MARK_FAILED]", {
        booking_id: job.booking_id,
        event_key: job.event_key,
        error: failError.message,
      });
    }
  }

  logger.info("[CRON_SUCCESS]", {
    job: "retry-booking-sms",
    duration_ms: Date.now() - start,
    claimed_count: jobs.length,
    sent_count: sentCount,
    failed_count: failedCount,
    max_attempts: SMS_RETRY_MAX_ATTEMPTS,
  });

  return NextResponse.json({
    status: "ok",
    claimed_count: jobs.length,
    sent_count: sentCount,
    failed_count: failedCount,
    max_attempts: SMS_RETRY_MAX_ATTEMPTS,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyVercelCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return retryBookingSMSJobs();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!verifyWebhookSecret(request)) {
    const auth = await validateAdminAuth();
    if (!auth.valid) {
      return auth.error;
    }
    // BE-M1: webhook secret was absent/wrong but admin auth succeeded — log for ops visibility
    logger.warn("[CRON_AUTH_FALLBACK]", { source: "webhook", fellBackTo: "admin_auth" });
  }

  return retryBookingSMSJobs();
}
