import { NextRequest, NextResponse } from "next/server";
import { handleCanonicalDomain } from "@/lib/proxy/canonical-domain";
import { handleStoryRewrite } from "@/lib/proxy/story-rewrite";
import { handleMaintenanceMode } from "@/lib/proxy/maintenance";
import { handleRootRedirect } from "@/lib/proxy/root-redirect";
import { handleCORS, addCORSHeaders } from "@/lib/proxy/cors";
import { handleCsrfValidation, setCsrfCookie } from "@/lib/proxy/csrf-proxy";
import { buildCspHeader } from "@/lib/proxy/csp";
import { refreshAuthSession } from "@/lib/proxy/auth-refresh";

// Re-export symbols that other modules depend on (backwards compatibility)
export {
  shouldBypassMaintenanceMode,
  isMaintenanceModeEnabled,
} from "@/lib/proxy/maintenance";
export { buildCspHeader } from "@/lib/proxy/csp";
export { hasSupabaseAuthCookies, AUTH_REFRESH_TIMEOUT_MS, isTokenNearExpiry } from "@/lib/proxy/auth-refresh";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // 0a. Redirect alternate domains to canonical domain (single hop)
  const canonicalRedirect = handleCanonicalDomain(request);
  if (canonicalRedirect) return canonicalRedirect;

  // 0b. Rewrite /story/:slug → /immersive?story=:slug (before maintenance check)
  const storyRewrite = handleStoryRewrite(request);
  if (storyRewrite) return storyRewrite;

  // 1. Check maintenance mode (applies to all routes)
  const maintenanceResponse = await handleMaintenanceMode(request);
  if (maintenanceResponse) return maintenanceResponse;

  // 2. Redirect root path to /immersive
  const rootRedirect = handleRootRedirect(request);
  if (rootRedirect) return rootRedirect;

  // 3. Handle CORS preflight for API routes
  const corsResponse = handleCORS(request);
  if (corsResponse) return corsResponse;

  // 4. Validate CSRF token + Origin check for state-changing API requests
  const csrfResponse = handleCsrfValidation(request);
  if (csrfResponse) return csrfResponse;

  // 5. Refresh auth session if needed (handles expired tokens)
  const response = await refreshAuthSession(request);

  // 6. Set static CSP header (unsafe-inline is intentional; see csp.ts)
  response.headers.set("Content-Security-Policy", buildCspHeader());

  // 7. Set CSRF cookie on page requests (if not already set)
  setCsrfCookie(request, response);

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
