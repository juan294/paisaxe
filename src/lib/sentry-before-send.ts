import type { ErrorEvent, RequestEventData, TransactionEvent } from "@sentry/core";
import { redactCapabilityPath, redactCapabilityPathsDeep } from "./redact-capability-path";
import { getRequestId } from "./request-context";

const REDACTED = "[REDACTED]";

function redactHeaders(headers?: RequestEventData["headers"]) {
  if (!headers) {
    return headers;
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      ["authorization", "cookie", "x-api-key"].includes(key.toLowerCase()) ? REDACTED : value,
    ]),
  ) as Record<string, string>;
}

async function hashEmail(email: string) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function extractRequestId(headers?: RequestEventData["headers"]) {
  const requestId = headers?.["x-request-id"] ?? headers?.["X-Request-ID"];
  return typeof requestId === "string" ? requestId : undefined;
}

/**
 * Normalizes a request URL to its path only, stripping the query string
 * (which can carry user-scoped values on some routes), fragment, and
 * origin. The path is kept because it's useful for grouping errors by
 * route in Sentry.
 */
function normalizeUrlToPath(url?: string): string | undefined {
  if (!url) {
    return url;
  }

  try {
    return new URL(url).pathname;
  } catch {
    // Relative URL (no valid base) — strip query string/fragment manually.
    return url.split("?")[0]?.split("#")[0];
  }
}

export async function sanitizeSentryEvent(event: ErrorEvent): Promise<ErrorEvent> {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;

    if (event.request.url) {
      const path = normalizeUrlToPath(event.request.url);
      event.request.url = path === undefined ? path : redactCapabilityPath(path);
    }

    if (event.request.headers) {
      event.request.headers = redactHeaders(event.request.headers);
    }
  }

  if (event.user) {
    if (event.user.email) {
      event.user.email = await hashEmail(event.user.email);
    }

    if (event.user.ip_address) {
      event.user.ip_address = null;
    }
  }

  // F05: capability links (booking and operator pages) never reach Sentry.
  if (event.transaction) event.transaction = redactCapabilityPath(event.transaction);
  if (event.breadcrumbs) event.breadcrumbs = redactCapabilityPathsDeep(event.breadcrumbs);

  const requestId = getRequestId() ?? extractRequestId(event.request?.headers);
  if (requestId) {
    event.tags = {
      ...event.tags,
      request_id: requestId,
    };
  }

  return event;
}

/**
 * beforeSendTransaction: performance events carry the page URL, the
 * transaction name, span descriptions and breadcrumbs; scrub capability links
 * from all of them (F05).
 */
export function sanitizeSentryTransaction(event: TransactionEvent): TransactionEvent {
  // The SDK's own bookkeeping (scopes, the client) is passed through by reference.
  const { sdkProcessingMetadata, ...rest } = event;
  const redacted = redactCapabilityPathsDeep(rest);
  return sdkProcessingMetadata === undefined ? redacted : { ...redacted, sdkProcessingMetadata };
}
