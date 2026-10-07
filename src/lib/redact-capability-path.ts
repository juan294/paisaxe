/**
 * Capability links (/booking/<id>.<token>, /operator/<id>.<token>) grant
 * access to whoever holds them, so they must not reach telemetry (PayPal
 * hackathon plan, F05). This rewrites every capability in a path, a full URL
 * or free text to `[redacted]`, keeps any sub-path (`/return`) and fragment,
 * and drops the query string after it (PayPal's return adds the order and
 * payer ids there). Everything else is returned unchanged.
 *
 * Used by PostHog (page views and every event), Sentry (requests,
 * transactions, breadcrumbs) and Vercel Analytics / Speed Insights.
 */
// A capability is "<uuid>.<base64url HMAC>" (src/lib/booking/links.ts), on
// pages (/booking/…, /operator/…) and API routes (/api/booking/bookings/…).
// Matching its shape rather than a path prefix leaves other routes intact.
const CAPABILITY_URL =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{20,}((?:\/[^?#\s"']*)?)(?:\?[^#\s"']*)?/gi;

export function redactCapabilityPath(text: string): string {
  // Fast path for the many strings on every event that cannot hold one.
  return text.includes(".") ? text.replace(CAPABILITY_URL, "[redacted]$1") : text;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Applies redactCapabilityPath to every string inside plain objects and
 * arrays. Anything else (a Date, an SDK's scope or client) is returned as it
 * is: telemetry SDKs put live objects on events, and their graphs are cyclic.
 */
export function redactCapabilityPathsDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value === "string") return redactCapabilityPath(value) as T;
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactCapabilityPathsDeep(item, seen)) as T;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactCapabilityPathsDeep(item, seen)])) as T;
}
