import type { ErrorEvent, Integration, RequestEventData, StreamedSpanJSON } from "@sentry/core";
import { redactCapabilityPath, redactCapabilityPathsDeep } from "./redact-capability-path";
import { getRequestId } from "./request-context";

const REDACTED = "[REDACTED]";
const SENSITIVE_HEADERS = ["authorization", "cookie", "x-api-key"];

function redactHeaders(headers?: RequestEventData["headers"]) {
  if (!headers) {
    return headers;
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      SENSITIVE_HEADERS.includes(key.toLowerCase()) ? REDACTED : value,
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

/** Span attributes that carry PII or credentials (the SDK copies the scope's user onto every span). */
const SENSITIVE_SPAN_ATTRIBUTES = [
  "user.email",
  "user.ip_address",
  ...SENSITIVE_HEADERS.map((header) => `http.request.header.${header}`),
  "http.response.header.set-cookie",
  "http.request.body.data",
];

/**
 * beforeSendSpan: v11 streams spans instead of sending transactions, so this
 * replaces beforeSendTransaction (#1033). Span names and attributes carry the
 * page URL, the route and outgoing request URLs; scrub capability links from
 * all of them (F05) and redact credentials and the user's email and IP.
 */
export function sanitizeSentrySpan(span: StreamedSpanJSON): StreamedSpanJSON {
  const redacted = redactCapabilityPathsDeep(span);
  for (const key of SENSITIVE_SPAN_ATTRIBUTES) {
    if (key in redacted.attributes) redacted.attributes[key] = REDACTED;
  }
  return redacted;
}

/**
 * The trace context (envelope headers and the `baggage` header of outgoing
 * requests) names the root span, which can hold a capability link (F05).
 * A plain object, not defineIntegration, so the client keeps no static
 * import of the SDK (#818).
 */
export const redactCapabilityTraceContext: Integration = {
  name: "RedactCapabilityTraceContext",
  setup(client) {
    client.on("createDsc", (dsc) => {
      if (dsc.transaction) dsc.transaction = redactCapabilityPath(dsc.transaction);
    });
  },
};

/** Sessions bypass beforeSend and may copy an email into their distinct ID. */
export const redactSessionUserInfo: Integration = {
  name: "RedactSessionUserInfo",
  setup(client) {
    client.on("beforeSendSession", (session) => {
      if ("aggregates" in session) {
        if (session.attrs) delete session.attrs.ip_address;
      } else {
        delete session.ipAddress;
        delete session.did;
      }
    });
  },
};
