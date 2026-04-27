import { NextRequest, NextResponse } from "next/server";
import {
  generateCsrfToken,
  validateCsrfToken,
  validateOrigin,
  isExemptFromCsrf,
  isSecureRuntime,
  csrfCookieOptions,
  CSRF_COOKIE_NAME,
} from "@/lib/csrf";
import { ALLOWED_ORIGINS } from "@/lib/proxy/cors";

/**
 * HTTP methods that require CSRF validation.
 */
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Validate CSRF token (double-submit) + Origin/Referer check (SE-L2) for
 * state-changing API requests.
 *
 * Returns 403 if:
 * - Origin/Referer header is present but not in the allowed list
 * - CSRF token is missing or doesn't match the cookie
 *
 * Returns null if validation passes.
 */
export function handleCsrfValidation(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api")) return null;
  if (!CSRF_METHODS.has(request.method)) return null;
  if (isExemptFromCsrf(pathname)) return null;

  // Origin/Referer check (SE-L2): reject requests from disallowed origins
  if (!validateOrigin(request, ALLOWED_ORIGINS)) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403 }
    );
  }

  // Double-submit cookie CSRF check
  if (validateCsrfToken(request)) return null;

  return NextResponse.json(
    { error: "CSRF token missing or invalid" },
    { status: 403 }
  );
}

/**
 * Set CSRF cookie on non-API page requests if one doesn't already exist.
 */
export function setCsrfCookie(request: NextRequest, response: NextResponse): void {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api")) return;

  const existingToken = request.cookies.get(CSRF_COOKIE_NAME);
  if (existingToken?.value) return;

  const token = generateCsrfToken();
  response.cookies.set(CSRF_COOKIE_NAME, token, csrfCookieOptions(isSecureRuntime()));
}
