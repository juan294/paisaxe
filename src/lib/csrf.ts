import { randomBytes } from "crypto";
import { safeEqual } from "@/lib/safe-equal";

export const CSRF_COOKIE_NAME = "__csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * HTTP methods that change server state and require a present Origin header (SE-M2).
 */
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Returns true when the runtime environment should use secure cookies (SE-M5).
 *
 * Covers:
 * - `NODE_ENV === "production"` — standard Node.js production flag
 * - `VERCEL_ENV === "production"` — Vercel production deployment
 * - `VERCEL_ENV === "preview"` — Vercel preview deployments (HTTPS, secure cookies required)
 */
export function isSecureRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

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
 * cron uses webhook secret or admin auth. The admin-auth fallback is a
 * browser-cookie session, so it is NOT exempt from CSRF in practice —
 * cron route handlers call `validateCsrfForAdminFallback` (below) on that
 * branch specifically (BE-H5 / SE-M1). This prefix list only controls the
 * proxy-level short-circuit for the machine-to-machine paths (webhook
 * secret, Vercel Cron bearer token) that never send Origin or a CSRF
 * cookie.
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
 * Defense-in-depth layer for CSRF (SE-L2 / SE-M2):
 * - If an Origin header is present: must match the allowed list.
 * - If Origin is absent on a state-changing method (POST/PUT/PATCH/DELETE):
 *   reject — browsers always send Origin for cross-origin state-changing requests,
 *   so absence on these methods indicates a potential bypass attempt.
 * - If Origin is absent on GET/HEAD: check Referer as a weaker fallback.
 *   Non-browser clients (curl, mobile, server-to-server) may omit both headers
 *   on safe methods and should pass through unchallenged.
 *
 * @param request        The incoming request
 * @param allowedOrigins List of fully-qualified origin strings (e.g. ["https://paisaxe.es"])
 * @returns true if origin check passes, false if rejected
 */
export function validateOrigin(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get("origin");

  if (origin) {
    return allowedOrigins.includes(origin);
  }

  // No Origin header — on state-changing methods this is not allowed (SE-M2)
  if (STATE_CHANGING_METHODS.has(request.method.toUpperCase())) {
    return false;
  }

  // Safe method without Origin header — check Referer as a weaker fallback
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return allowedOrigins.includes(refererOrigin);
    } catch {
      return false;
    }
  }

  // Neither Origin nor Referer present on a safe method — allow (non-browser/server-to-server)
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

  // DO-H6: safeEqual compares byte length before timingSafeEqual, so
  // multibyte tokens can't trigger an unhandled RangeError.
  return safeEqual(headerToken, cookieToken);
}

/**
 * Validate CSRF token + Origin for the admin-cookie-session fallback on
 * `/api/cron/*` routes (BE-H5 / SE-M1).
 *
 * Cron routes are CSRF-exempt at the proxy layer because pg_cron and Vercel
 * Cron authenticate via `x-webhook-secret` / a bearer `CRON_SECRET` and never
 * send an Origin header or a CSRF cookie. But those same routes also accept
 * `validateAdminAuth()` (a browser session cookie) as a fallback when the
 * webhook secret is absent or wrong — exactly the request shape CSRF
 * protection exists for. Route handlers must call this on that fallback
 * branch specifically, before trusting the admin session, so a hostile page
 * can't ride a logged-in admin's cookies to trigger a cron job cross-site.
 *
 * Legitimate webhook-secret / Vercel-Cron callers never reach this check —
 * it only runs after the webhook-secret check has already failed.
 */
export function validateCsrfForAdminFallback(
  request: Request,
  allowedOrigins: string[]
): boolean {
  return validateOrigin(request, allowedOrigins) && validateCsrfToken(request);
}
