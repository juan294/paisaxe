/**
 * Webhook signature verification through PayPal's verify-webhook-signature
 * API (PayPal hackathon plan, Phase 4). The SDK has no notifications surface,
 * so this is a plain fetch sharing the adapter's token cache and host guard.
 *
 * "FAILURE" means the request is not a verified PayPal event (the route
 * answers 401). A PaypalError means PayPal could not answer (the route
 * answers 500 so PayPal redelivers).
 */
import "server-only";

import { createPaypalFetch, getAccessToken, httpError, paypalTimeoutMs, paypalTransportError } from "./client";
import { getPaypalConfig } from "./env";
import { PaypalError, PaypalNotConfigured, TRANSMISSION_HEADERS } from "./types";

const VERIFY_PATH = "/v1/notifications/verify-webhook-signature";

/** A JSON object, or null for anything else. */
function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function verifyWebhookSignature(headers: Headers, rawBody: string): Promise<"SUCCESS" | "FAILURE"> {
  const config = getPaypalConfig();
  if (!config.webhookId) throw new PaypalNotConfigured("PAYPAL_WEBHOOK_ID must be set to verify webhooks");

  const transmission: Record<string, string> = {};
  for (const [field, header] of Object.entries(TRANSMISSION_HEADERS)) {
    const value = headers.get(header)?.trim();
    if (!value) return "FAILURE";
    transmission[field] = value;
  }
  const event = parseObject(rawBody);
  if (!event) return "FAILURE";

  const accessToken = await getAccessToken();
  const response = await createPaypalFetch(config.baseUrl)(`${config.baseUrl}${VERIFY_PATH}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...transmission, webhook_id: config.webhookId, webhook_event: event }),
    signal: AbortSignal.timeout(paypalTimeoutMs()),
  }).catch((error: unknown) => {
    throw paypalTransportError(error, "verifyWebhookSignature");
  });

  const text = await response.text().catch(() => "");
  if (!response.ok) throw httpError("verifyWebhookSignature", response, text);

  const status = parseObject(text)?.verification_status;
  if (typeof status !== "string") {
    // PayPal answered 2xx without a verdict: unknown, so the route lets PayPal redeliver.
    throw new PaypalError("PayPal verifyWebhookSignature returned no verification_status", {
      status: response.status,
      debugId: response.headers.get("paypal-debug-id"),
    });
  }
  return status === "SUCCESS" ? "SUCCESS" : "FAILURE";
}
