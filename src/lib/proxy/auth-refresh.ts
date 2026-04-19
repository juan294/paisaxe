import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

/**
 * Timeout for auth session refresh in milliseconds.
 * Prevents the proxy from hanging when Supabase is unreachable.
 * Exported for testing.
 */
export const AUTH_REFRESH_TIMEOUT_MS = 1_500;

/**
 * Returns true if the JWT is expired or expires within `thresholdSeconds`.
 * Exported for testing.
 */
export function isTokenNearExpiry(token: string | undefined, thresholdSeconds = 300): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.exp - Date.now() / 1000) < thresholdSeconds;
  } catch {
    return true;
  }
}

/**
 * Check if the request has Supabase auth cookies.
 * Returns false for anonymous visitors (no auth cookies).
 * Exported for testing.
 */
export function hasSupabaseAuthCookies(request: NextRequest): boolean {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseUrl) return false;
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const prefix = `sb-${projectRef}-auth-token`;
    return request.cookies.getAll().some(
      (c) => c.name === prefix || c.name.startsWith(`${prefix}.`)
    );
  } catch {
    return false;
  }
}

/**
 * Emit a PostHog event for auth-refresh timeout failures (DO-M3).
 * Fire-and-forget — never awaited to keep the hot path fast.
 */
function emitAuthRefreshTimeoutEvent(): void {
  const posthogKey = getEnv("NEXT_PUBLIC_POSTHOG_KEY");
  const posthogHost = getEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");

  if (!posthogKey) return;

  fetch(`${posthogHost}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: posthogKey,
      event: "auth_refresh_timeout",
      properties: {
        distinct_id: "server",
        timestamp: new Date().toISOString(),
      },
    }),
  }).catch(() => {
    // Intentionally swallowed — PostHog is non-critical observability
  });
}

/**
 * Refresh Supabase auth session if expired.
 * Returns a response with updated cookies if session was refreshed.
 *
 * Includes a timeout to prevent hanging when Supabase is unreachable.
 * On timeout/error: logs a structured error (DO-M3), emits PostHog event,
 * and continues without refreshing.
 */
export async function refreshAuthSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  // Skip if Supabase not configured or using dummy credentials (CI/E2E).
  // Real Supabase anon keys are JWTs that start with 'eyJ'.
  if (!supabaseUrl || !supabaseKey || !supabaseKey.startsWith("eyJ")) {
    return response;
  }

  // Skip auth refresh if no auth cookies exist (anonymous visitor)
  if (!hasSupabaseAuthCookies(request)) {
    return response;
  }

  // Skip getUser() if the session access token still has more than 5 minutes remaining.
  // This avoids a 100-400ms Supabase round-trip on every authenticated page request.
  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    const prefix = `sb-${projectRef}-auth-token`;
    const sessionCookie =
      request.cookies.get(prefix)?.value ??
      request.cookies.get(`${prefix}.0`)?.value;
    const decoded = decodeURIComponent(sessionCookie ?? "");
    const parsed = JSON.parse(decoded) as { access_token?: string };
    if (!isTokenNearExpiry(parsed.access_token)) {
      return response;
    }
  } catch {
    // Cannot parse session — fall through and call getUser() (fail safe)
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Auth refresh timeout")),
          AUTH_REFRESH_TIMEOUT_MS
        )
      ),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "Auth refresh timeout") {
      // DO-M3: structured log + PostHog event for rate-tracking auth-refresh failures
      console.error("[AUTH_REFRESH_TIMEOUT]", {
        message: error.message,
        timeout_ms: AUTH_REFRESH_TIMEOUT_MS,
        timestamp: new Date().toISOString(),
      });
      emitAuthRefreshTimeoutEvent();
    } else if (error instanceof Error) {
      // Unexpected real error (not a timeout) — log for debugging
      console.error("Error refreshing auth session:", error);
    }
    // Non-Error thrown values are silently swallowed (e.g., strings, numbers)
  }

  return response;
}
