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

export async function sanitizeSentryEvent(event: ErrorEvent): Promise<ErrorEvent> {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;

    if (event.request.headers) {
      event.request.headers = redactHeaders(event.request.headers);
    }
  }

  if (event.user?.email) {
    event.user.email = await hashEmail(event.user.email);
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
