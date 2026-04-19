import { randomBytes, timingSafeEqual } from "crypto";

export const CSRF_COOKIE_NAME = "__csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generate a cryptographically random CSRF token (32 bytes, hex-encoded).
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Cookie options for the CSRF token.
 * httpOnly=false so client-side JS can read the cookie value.
 * SameSite=Strict to prevent cross-origin requests from including the cookie.
 */
export function csrfCookieOptions(isProduction: boolean) {
  return {
    httpOnly: false,
    sameSite: "strict" as const,
    secure: isProduction,
    path: "/",
  };
}

/**
 * Paths exempt from CSRF validation.
 * Webhooks use signature verification, MCP uses secret verification,
 * cron uses webhook secret or admin auth.
 */
const CSRF_EXEMPT_PREFIXES = [
  "/api/webhooks/",
  "/api/mcp/",
  "/api/cron/",
  "/api/health",
];

/**
 * Check if a pathname is exempt from CSRF protection.
 */
export function isExemptFromCsrf(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Parse a specific cookie value from a raw Cookie header string.
 */
function parseCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [cookieName, ...rest] = cookie.split("=");
    if (cookieName.trim() === name) {
      return rest.join("=").trim();
    }
  }
  return null;
}

/**
 * Validate the Origin (or Referer fallback) header against a list of allowed origins.
 *
 * Defense-in-depth layer for CSRF (SE-L2): if an Origin header is present and
 * doesn't match the allowed list, the request is rejected regardless of the
 * HMAC/double-submit token. Referer is used as a fallback only when Origin is
 * absent — non-browser clients (curl, mobile, server-to-server) omit Origin
 * and should pass through unchallenged.
 *
 * @param request     The incoming request
 * @param allowedOrigins  List of fully-qualified origin strings (e.g. ["https://paisaxe.es"])
 * @returns true if origin is allowed (or absent without Referer), false if rejected
 */
export function validateOrigin(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get("origin");

  if (origin) {
    return allowedOrigins.includes(origin);
  }

  // No Origin header — check Referer as a weaker fallback
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.includes(refererOrigin);
    } catch {
      return false;
    }
  }

  // Neither Origin nor Referer present — allow (non-browser/server-to-server)
  return true;
}

/**
 * Validate CSRF token using double-submit cookie pattern.
 * Compares the x-csrf-token header against the __csrf cookie using
 * timing-safe comparison.
 */
export function validateCsrfToken(request: Request): boolean {
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  const cookieHeader = request.headers.get("cookie");
  const cookieToken = parseCookieValue(cookieHeader, CSRF_COOKIE_NAME);

  if (!headerToken || !cookieToken) return false;
  if (headerToken.length !== cookieToken.length) return false;

  return timingSafeEqual(
    Buffer.from(headerToken),
    Buffer.from(cookieToken)
  );
}
