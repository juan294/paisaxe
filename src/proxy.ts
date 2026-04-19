import { NextRequest, NextResponse } from "next/server";
import { handleCanonicalDomain } from "@/lib/proxy/canonical-domain";
import { handleStoryRewrite } from "@/lib/proxy/story-rewrite";
import { handleMaintenanceMode } from "@/lib/proxy/maintenance";
import { handleRootRedirect } from "@/lib/proxy/root-redirect";
import { handleCORS, addCORSHeaders } from "@/lib/proxy/cors";
import { handleCsrfValidation, setCsrfCookie } from "@/lib/proxy/csrf-proxy";
import { generateNonce, buildCspHeader } from "@/lib/proxy/csp";
import { refreshAuthSession } from "@/lib/proxy/auth-refresh";

// Re-export symbols that other modules depend on (backwards compatibility)
export {
  shouldBypassMaintenanceMode,
  isMaintenanceModeEnabled,
} from "@/lib/proxy/maintenance";
export { buildCspHeader } from "@/lib/proxy/csp";
export { hasSupabaseAuthCookies, AUTH_REFRESH_TIMEOUT_MS } from "@/lib/proxy/auth-refresh";

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

  // 5. Generate CSP nonce and forward it to downstream server components
  const nonce = generateNonce();
  request.headers.set("x-csp-nonce", nonce);

  // 6. Refresh auth session if needed (handles expired tokens)
  const response = await refreshAuthSession(request);

  // 7. Set per-request CSP header
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce));

  // 8. Set CSRF cookie on page requests (if not already set)
  setCsrfCookie(request, response);

  // 9. Add CORS headers to the response
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
