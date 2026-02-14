import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Verify that a request comes from Vercel Cron.
 *
 * Vercel Cron sends GET requests with `Authorization: Bearer <CRON_SECRET>`.
 * Returns true if the header matches the CRON_SECRET env var.
 */
export function verifyVercelCron(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!authHeader || !cronSecret) return false;

  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

/**
 * Verify that a request comes from pg_cron (Supabase) via webhook secret.
 *
 * pg_cron sends POST requests with `x-webhook-secret` header.
 */
export function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = request.headers.get("x-webhook-secret");
  const expectedSecret = process.env.WEBHOOK_SECRET?.trim();

  if (!secret || !expectedSecret) return false;
  if (secret.length !== expectedSecret.length) return false;

  return timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret));
}
