import type { ErrorEvent, RequestEventData } from "@sentry/core";
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
      event.request.url = normalizeUrlToPath(event.request.url);
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

  const requestId = getRequestId() ?? extractRequestId(event.request?.headers);
  if (requestId) {
    event.tags = {
      ...event.tags,
      request_id: requestId,
    };
  }

  return event;
}
