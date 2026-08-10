import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import { getEnv } from "@/lib/env";

// Module-level flag: warn once per process start if cron secrets are missing in production.
let _cronAuthWarningEmitted = false;

if (
  process.env.NODE_ENV === "production" &&
  !process.env.CRON_SECRET?.trim() &&
  !process.env.WEBHOOK_SECRET?.trim() &&
  !_cronAuthWarningEmitted
) {
  _cronAuthWarningEmitted = true;
  logger.error(
    "[CRON_AUTH_MISSING] No CRON_SECRET or WEBHOOK_SECRET configured — all cron jobs will return 401"
  );
}

/**
 * Reasons a cron-auth attempt may be rejected.
 *
 * - `missing_secret`: the CRON_SECRET / WEBHOOK_SECRET env var is unset or empty.
 *   The most common cause of "silent" cron failures (BE-B1).
 * - `header_missing`: the request did not include the auth header at all.
 * - `mismatch`: the header was present but its value did not match the secret.
 */
export type CronAuthRejectReason = "missing_secret" | "header_missing" | "mismatch";

/**
 * Emit a structured `[CRON_AUTH_REJECTED]` log so misconfigurations and
 * unauthorized callers are observable in Vercel log drains.
 *
 * Never logs the secret itself.
 */
function logRejection(
  reason: CronAuthRejectReason,
  meta: Record<string, unknown> = {}
): void {
  logger.warn("[CRON_AUTH_REJECTED]", { reason, ...meta });
}

/**
 * Verify that a request comes from Vercel Cron.
 *
 * Vercel Cron sends GET requests with `Authorization: Bearer <CRON_SECRET>`.
 * Returns true if the header matches the CRON_SECRET env var.
 *
 * Every rejection emits a `[CRON_AUTH_REJECTED]` log with a `reason` field
 * so that silent misconfigurations (e.g. missing CRON_SECRET in Vercel)
 * are immediately visible — see BE-B1.
 */
export function verifyVercelCron(request: NextRequest): boolean {
  const cronSecret = getEnv("CRON_SECRET");
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    logRejection("missing_secret", { source: "vercel_cron" });
    return false;
  }

  if (!authHeader) {
    logRejection("header_missing", {
      source: "vercel_cron",
      expected_header: "authorization",
    });
    return false;
  }

  const expected = `Bearer ${cronSecret}`;
  if (
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    logRejection("mismatch", { source: "vercel_cron" });
    return false;
  }

  return true;
}

/**
 * Verify that a request comes from pg_cron (Supabase) via webhook secret.
 *
 * pg_cron sends POST requests with `x-webhook-secret` header.
 *
 * Every rejection emits a `[CRON_AUTH_REJECTED]` log with a `reason` field
 * so misconfigurations are observable — see BE-B1.
 */
export function verifyWebhookSecret(request: NextRequest): boolean {
  const expectedSecret = getEnv("WEBHOOK_SECRET");
  const secret = request.headers.get("x-webhook-secret");

  if (!expectedSecret) {
    logRejection("missing_secret", { source: "webhook" });
    return false;
  }

  if (!secret) {
    logRejection("header_missing", {
      source: "webhook",
      expected_header: "x-webhook-secret",
    });
    return false;
  }

  if (
    secret.length !== expectedSecret.length ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
  ) {
    logRejection("mismatch", { source: "webhook" });
    return false;
  }

  return true;
}
