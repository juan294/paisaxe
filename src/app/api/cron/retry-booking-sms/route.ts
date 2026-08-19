import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendSMS } from "@/lib/twilio-sms";
import { validateCsrfForAdminFallback } from "@/lib/csrf";
import { ALLOWED_ORIGINS } from "@/lib/proxy/cors";

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
      p_max_attempts: SMS_RETRY_MAX_ATTEMPTS,
    });

    if (failError) {
      logger.error("[CRON_RETRY_BOOKING_SMS_FAIL_MARK_FAILED]", {
        booking_id: job.booking_id,
        event_key: job.event_key,
        error: failError.message,
      });
    }
  }

  // BE-M11: claim_retryable_booking_sms_jobs (088/100) never reclaims a job
  // once its attempts reach SMS_RETRY_MAX_ATTEMPTS, but fail_booking_sms_job
  // (109) now retires it to a terminal `dead` status instead of the
  // retryable `failed`, so it stops being silently indistinguishable from a
  // job that will still retry. Surface that count with a scoped query --
  // mirrors the dead-letter pattern already used by
  // fail-stale-translations/route.ts (BE-B1) for the analogous
  // translate_webhook_events queue. Scoped to `updated_at >= sweepStartedAt`
  // (this invocation only, with a small clock-skew buffer) rather than an
  // all-time count, which would stay > 0 forever after the first job ever
  // died and fire on every run regardless of whether anything new died.
  const sweepStartedAt = new Date(start - 5_000).toISOString();
  const { count: deadLetterCount, error: deadCountError } = await supabase
    .from("booking_sms_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "dead")
    .gte("updated_at", sweepStartedAt);

  const deadLetterCountResult = deadCountError ? undefined : (deadLetterCount ?? 0);

  if (deadCountError) {
    logger.error("[CRON_RETRY_BOOKING_SMS_DEAD_COUNT_FAILED]", {
      error: deadCountError.message,
    });
  } else if (deadLetterCountResult) {
    logger.warn("[CRON_RETRY_BOOKING_SMS_DEAD]", { dead_letter_count: deadLetterCountResult });
  }

  logger.info("[CRON_SUCCESS]", {
    job: "retry-booking-sms",
    duration_ms: Date.now() - start,
    claimed_count: jobs.length,
    sent_count: sentCount,
    failed_count: failedCount,
    dead_letter_count: deadLetterCountResult,
    max_attempts: SMS_RETRY_MAX_ATTEMPTS,
  });

  return NextResponse.json({
    status: "ok",
    claimed_count: jobs.length,
    sent_count: sentCount,
    failed_count: failedCount,
    dead_letter_count: deadLetterCountResult,
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
    // BE-H5/SE-M1: admin-cookie fallback is exactly the CSRF attack surface —
    // require a valid CSRF token + Origin before trusting the session cookie.
    if (!validateCsrfForAdminFallback(request, ALLOWED_ORIGINS)) {
      return NextResponse.json(
        { error: "CSRF token missing or invalid" },
        { status: 403 }
      );
    }
    // BE-M1: webhook secret was absent/wrong but admin auth succeeded — log for ops visibility
    logger.warn("[CRON_AUTH_FALLBACK]", { source: "webhook", fellBackTo: "admin_auth" });
  }

  return retryBookingSMSJobs();
}
