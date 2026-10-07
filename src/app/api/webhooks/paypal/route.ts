import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase-admin";
import { TRANSMISSION_HEADERS, verifyWebhookSignature } from "@/lib/paypal";
import { normalizePaypalEvent, processAndRecordPaypalEvent } from "@/lib/booking/webhook-events";
import { buildRateLimitHeaders } from "@/lib/chat-route-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-utils";

/**
 * POST /api/webhooks/paypal (PayPal hackathon plan, Phase 4, F03)
 *
 * 1. Verify the signature with PayPal over the raw body: FAILURE -> 401; PayPal
 *    unable to answer (or not configured) -> 500, so PayPal redelivers.
 * 2. Record the event in the inbox (upsert_paypal_event) with its normalized
 *    ids. Already processed -> 200 without reprocessing.
 * 3. Process it and mark it processed -> 200. Processing throws -> the error is
 *    recorded, the row stays unprocessed, 500: PayPal redelivers and the
 *    reconcile-bookings cron replays it from the row alone (R2-04).
 *
 * CSRF-exempt by the /api/webhooks/ prefix (src/lib/csrf.ts). Never logs the
 * raw body or the transmission signature.
 */

/** A request missing any PayPal transmission header cannot be a PayPal delivery: refused before asking PayPal. */
const REQUIRED_HEADERS = Object.values(TRANSMISSION_HEADERS);

const WEBHOOK_RATE_LIMIT = { windowMs: 60_000, maxRequests: 120, maxEntries: 10_000 };

function invalid(reason: string, transmissionId: string | null): NextResponse {
  logger.warn("[PAYPAL_WEBHOOK_INVALID]", { reason, transmissionId });
  return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const transmissionId = request.headers.get("paypal-transmission-id");

  if (REQUIRED_HEADERS.some((header) => !request.headers.get(header)?.trim())) {
    return invalid("missing_transmission_headers", transmissionId);
  }

  // Each request with headers costs a PayPal verification call; PayPal redelivers after a 429.
  const rateLimit = await checkRateLimit(`paypal-webhook:${getClientIp(request)}`, WEBHOOK_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: buildRateLimitHeaders(rateLimit, true) });
  }

  let verification: "SUCCESS" | "FAILURE";
  try {
    verification = await verifyWebhookSignature(request.headers, rawBody);
  } catch (error) {
    logger.error("[PAYPAL_WEBHOOK_VERIFY_FAILED]", {
      transmissionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Signature verification unavailable" }, { status: 500 });
  }
  if (verification !== "SUCCESS") return invalid("verification_failed", transmissionId);

  const event = normalizePaypalEvent(parseJson(rawBody));
  if (!event) {
    logger.error("[PAYPAL_WEBHOOK_INVALID]", { reason: "missing_event_id_or_type", transmissionId });
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const client = createAdminClient();
  const { data: state, error } = await client.rpc("upsert_paypal_event", {
    p_event_id: event.event_id,
    p_event_type: event.event_type,
    p_payload: event.payload,
    p_order_id: event.order_id,
    p_capture_id: event.capture_id,
    p_refund_id: event.refund_id,
    p_custom_id: event.custom_id,
    p_verification: verification,
  });
  if (error) {
    logger.error("[PAYPAL_WEBHOOK_INBOX_FAILED]", { eventId: event.event_id, error: error.message });
    return NextResponse.json({ error: "Event could not be recorded" }, { status: 500 });
  }
  if (state === "processed") {
    logger.info("[PAYPAL_WEBHOOK_DUPLICATE]", { eventId: event.event_id, eventType: event.event_type });
    return NextResponse.json({ status: "duplicate" });
  }

  try {
    const outcome = await processAndRecordPaypalEvent(client, event);
    logger.info("[PAYPAL_WEBHOOK_PROCESSED]", { eventId: event.event_id, eventType: event.event_type, outcome });
    return NextResponse.json({ status: "processed" });
  } catch (processingError) {
    logger.error("[PAYPAL_WEBHOOK_PROCESSING_FAILED]", {
      eventId: event.event_id,
      eventType: event.event_type,
      error: processingError instanceof Error ? processingError.message : String(processingError),
    });
    return NextResponse.json({ error: "Event processing failed" }, { status: 500 });
  }
}
