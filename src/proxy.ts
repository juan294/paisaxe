import { NextRequest, NextResponse } from "next/server";
import { handleCanonicalDomain } from "@/lib/proxy/canonical-domain";
import { handleStoryRewrite } from "@/lib/proxy/story-rewrite";
import { handleMaintenanceMode } from "@/lib/proxy/maintenance";
import { handleRootRedirect } from "@/lib/proxy/root-redirect";
import { handleCORS, addCORSHeaders } from "@/lib/proxy/cors";
import { handleCsrfValidation, setCsrfCookie } from "@/lib/proxy/csrf-proxy";
import { buildCspHeader } from "@/lib/proxy/csp";
import { refreshAuthSession } from "@/lib/proxy/auth-refresh";
import { getOrCreateRequestId, getRequestIdHeaderName } from "@/lib/proxy/request-id";


export async function proxy(request: NextRequest): Promise<NextResponse> {
  const requestIdHeader = getRequestIdHeaderName();
  const requestId = getOrCreateRequestId(request);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(requestIdHeader, requestId);

  // 0a. Redirect alternate domains to canonical domain (single hop)
  const canonicalRedirect = handleCanonicalDomain(request);
  if (canonicalRedirect) {
    canonicalRedirect.headers.set("X-Request-ID", requestId);
    return canonicalRedirect;
  }

  // 0b. Rewrite /story/:slug → /immersive?story=:slug (before maintenance check)
  const storyRewrite = handleStoryRewrite(request);
  if (storyRewrite) {
    storyRewrite.headers.set("X-Request-ID", requestId);
    return storyRewrite;
  }

  // 1. Redirect root path to /immersive. Checked ahead of the
  //    maintenance-mode lookup (PE-H2, #805): / always forwards to
  //    /immersive, which itself bypasses maintenance mode
  //    (MAINTENANCE_BYPASS_PREFIXES in lib/proxy/maintenance.ts), so
  //    evaluating maintenance status for / before redirecting was a wasted
  //    Supabase round-trip (60-330ms) on every first-time visit. The
  //    maintenance-mode check below still applies, unchanged, to every
  //    other route.
  const rootRedirect = handleRootRedirect(request);
  if (rootRedirect) {
    rootRedirect.headers.set("X-Request-ID", requestId);
    return rootRedirect;
  }

  // 2. Check maintenance mode (applies to all other routes)
  const maintenanceResponse = await handleMaintenanceMode(request);
  if (maintenanceResponse) {
    maintenanceResponse.headers.set("X-Request-ID", requestId);
    return maintenanceResponse;
  }

  // 3. Handle CORS preflight for API routes
  const corsResponse = handleCORS(request);
  if (corsResponse) {
    corsResponse.headers.set("X-Request-ID", requestId);
    return corsResponse;
  }

  // 4. Validate CSRF token + Origin check for state-changing API requests
  const csrfResponse = handleCsrfValidation(request);
  if (csrfResponse) {
    csrfResponse.headers.set("X-Request-ID", requestId);
    return csrfResponse;
  }

  // 5. Refresh auth session if needed (handles expired tokens)
  const response = await refreshAuthSession(request, forwardedHeaders);

  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  // 6. Set static CSP header on page responses only.
  //    API responses (incl. high-frequency /api/chat/stream, /api/feature-flags) do not
  //    need CSP — it is a browser page protection header. Skipping the string-build on
  //    every API call avoids pointless work on hot paths (PE-M2).
  if (!isApiRoute) {
    response.headers.set("Content-Security-Policy", buildCspHeader());

    // 7. Set CSRF cookie on page requests (if not already set).
    //    setCsrfCookie already guards against API paths internally, but hoisting the
    //    check here avoids the function-call overhead on API routes entirely.
    setCsrfCookie(request, response);
  }

  response.headers.set("X-Request-ID", requestId);

  // 8. Add CORS headers to the response
  addCORSHeaders(request, response);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
