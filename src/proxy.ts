import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCATION_CONFIG } from "@/config/location";
import { getEnvironment } from "@/lib/environment";
import crypto from "crypto";
import {
  generateCsrfToken,
  validateCsrfToken,
  isExemptFromCsrf,
  csrfCookieOptions,
  CSRF_COOKIE_NAME,
} from "@/lib/csrf";

// LOCATION-SPECIFIC: Build allowed origins from config domains
const ALLOWED_ORIGINS: string[] = [];

// Add primary domain
ALLOWED_ORIGINS.push(`https://${LOCATION_CONFIG.domain}`);
ALLOWED_ORIGINS.push(`https://www.${LOCATION_CONFIG.domain}`);

// Add alternate domain if configured
if (LOCATION_CONFIG.alternateDomain) {
  ALLOWED_ORIGINS.push(`https://${LOCATION_CONFIG.alternateDomain}`);
  ALLOWED_ORIGINS.push(`https://www.${LOCATION_CONFIG.alternateDomain}`);
}

// Allow localhost in development
if (process.env.NODE_ENV === "development") {
  ALLOWED_ORIGINS.push("http://localhost:3000");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-csrf-token",
  "Access-Control-Max-Age": "86400",
};

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Routes that bypass maintenance mode.
 * Used by shouldBypassMaintenanceMode() to determine if a request
 * should be allowed through when maintenance mode is enabled.
 */
const MAINTENANCE_BYPASS_PREFIXES = [
  "/a",            // PostHog reverse proxy (analytics)
  "/admin",        // Admin panel
  "/api",          // API routes (health checks, webhooks)
  "/auth",         // OAuth callbacks for admin sign-in
  "/coming-soon",  // The coming soon page itself
  "/pricing",      // Purchase flow (includes /pricing/success)
  "/immersive",    // Main app (for testing purchase flow)
  "/_next",        // Next.js internals
];

/**
 * Static asset patterns that bypass maintenance mode.
 */
const MAINTENANCE_BYPASS_PATTERNS = [
  /^\/favicon/,
  /^\/icon/,
  /^\/apple-touch-icon/,
  /^\/manifest\.json$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/,
];

/**
 * Check if a pathname should bypass maintenance mode.
 * Exported for testing.
 */
export function shouldBypassMaintenanceMode(pathname: string): boolean {
  return (
    MAINTENANCE_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    MAINTENANCE_BYPASS_PATTERNS.some((pattern) => pattern.test(pathname))
  );
}

/**
 * Check if maintenance mode is enabled.
 * Priority: ENV var override > Database flag
 *
 * - If MAINTENANCE_MODE env var is "true", maintenance is always on
 * - If MAINTENANCE_MODE env var is "false", check database flag
 * - If env var is not set, check database flag
 */
async function isMaintenanceModeEnabled(): Promise<boolean> {
  // ENV var "true" is an override - always enable maintenance
  if (process.env.MAINTENANCE_MODE === "true") {
    return true;
  }

  // ENV var "false" disables maintenance regardless of database
  // This allows quick override without touching database
  if (process.env.MAINTENANCE_MODE === "false") {
    return false;
  }

  // No env var set - check database
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // No Supabase config - default to off
      return false;
    }

    // Fetch maintenance_mode flag directly from Supabase REST API
    // Using fetch with cache for Edge runtime compatibility
    // Filter by current environment so localhost maintenance mode doesn't affect production
    const environment = getEnvironment();

    // In development, don't cache so changes take effect immediately
    // In production, cache for 30 seconds to reduce database hits
    const isDev = environment === "development";

    const response = await fetch(
      `${supabaseUrl}/rest/v1/feature_flags?flag_key=eq.maintenance_mode&environment=eq.${environment}&select=enabled`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 30 } }
        ),
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch maintenance mode flag:", response.status);
      return false;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].enabled === true;
    }

    // Flag not found in database - default to off
    return false;
  } catch (error) {
    console.error("Error checking maintenance mode:", error);
    // On error, default to off to avoid blocking users
    return false;
  }
}

/**
 * Handle maintenance mode redirect.
 * Returns a redirect response if maintenance mode is enabled and
 * the route should not bypass it. Returns null otherwise.
 */
async function handleMaintenanceMode(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  // Check bypass routes first (fast path)
  if (shouldBypassMaintenanceMode(pathname)) {
    return null;
  }

  // Check if maintenance mode is enabled
  const maintenanceEnabled = await isMaintenanceModeEnabled();

  if (!maintenanceEnabled) {
    return null;
  }

  // Redirect to coming soon page
  return NextResponse.redirect(new URL("/coming-soon", request.url));
}

/**
 * Handle CORS for API routes.
 * Returns a response with CORS headers for preflight requests,
 * or null to continue with normal processing.
 */
function handleCORS(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const { pathname } = request.nextUrl;

  // Only apply CORS handling to API routes
  if (!pathname.startsWith("/api")) {
    return null;
  }

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    if (isAllowedOrigin(origin)) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin!,
          ...CORS_HEADERS,
        },
      });
    }
    // Unknown origin preflight - respond without CORS headers
    return new NextResponse(null, { status: 204 });
  }

  return null;
}

/**
 * Generate a CSP nonce for per-request script authorization.
 * Uses crypto.randomBytes for cryptographic randomness, base64url-encoded.
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Build the Content-Security-Policy header value with a per-request nonce.
 *
 * - script-src uses 'self' + nonce for same-origin and inline script authorization.
 *   Note: 'strict-dynamic' is intentionally NOT used because PPR (cacheComponents)
 *   prebuilds HTML at build time without nonces. In CSP Level 3, 'strict-dynamic'
 *   overrides 'self', which would block all scripts when nonces aren't in the HTML.
 *   Without 'strict-dynamic', 'self' allows same-origin scripts (including dynamic
 *   imports), and the nonce authorizes any inline scripts.
 * - style-src keeps 'unsafe-inline' because Tailwind/Next.js CSS-in-JS requires it.
 * - blob: is required in script-src for ElevenLabs AudioWorklet processor.
 * - https://js.stripe.com is explicitly listed for Stripe checkout.
 */
export function buildCspHeader(_nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' blob: https://js.stripe.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.elevenlabs.io https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.stripe.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src https://js.stripe.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Add CORS headers to a response for API routes.
 */
function addCORSHeaders(request: NextRequest, response: NextResponse): void {
  const origin = request.headers.get("origin");
  const { pathname } = request.nextUrl;

  // Only add CORS headers to API routes with allowed origins
  if (pathname.startsWith("/api") && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin!);
    response.headers.set("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
    response.headers.set("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);
  }
}

/**
 * Check if the request has Supabase auth cookies.
 * Supabase stores auth tokens in cookies named `sb-{projectRef}-auth-token`
 * or chunked as `sb-{projectRef}-auth-token.0`, `.1`, etc.
 * Returns false for anonymous visitors (no auth cookies).
 * Exported for testing.
 */
export function hasSupabaseAuthCookies(request: NextRequest): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
 * Timeout for auth session refresh in milliseconds.
 * Prevents the proxy from hanging when Supabase is unreachable.
 * Exported for testing.
 */
export const AUTH_REFRESH_TIMEOUT_MS = 1_500;

/**
 * Refresh Supabase auth session if expired.
 * This ensures the client and server auth states stay in sync.
 * Returns a response with updated cookies if session was refreshed.
 *
 * Includes a timeout to prevent hanging when Supabase is unreachable
 * (e.g., during CI with dummy credentials, or production outages).
 */
async function refreshAuthSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip if Supabase not configured or using dummy credentials (CI/E2E).
  // Real Supabase anon keys are JWTs that start with 'eyJ'.
  if (!supabaseUrl || !supabaseKey || !supabaseKey.startsWith("eyJ")) {
    return response;
  }

  // Skip auth refresh if no auth cookies exist (anonymous visitor)
  if (!hasSupabaseAuthCookies(request)) {
    return response;
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
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Race getUser() against a timeout to prevent hanging
    // when Supabase is unreachable (DNS hang, network issues)
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
    // Timeout or connection error — continue without refreshing.
    // Only log actual errors, not timeouts (expected in CI).
    if (
      error instanceof Error &&
      error.message !== "Auth refresh timeout"
    ) {
      console.error("Error refreshing auth session:", error);
    }
  }

  return response;
}

/**
 * Canonical domain: redirect alternate/www domains to the primary domain.
 *
 * Defense-in-depth: vercel.json "redirects" perform this same redirect at the
 * CDN edge before the app boots. This proxy-level handler is the second layer,
 * catching any requests that bypass CDN redirects (preview deployments, direct
 * IP access, future domain additions not yet in vercel.json).
 *
 * Prevents double-redirect chains like:
 *   paisaxe.com/ → 308 → paisaxe.com/immersive → 308 → paisaxe.es/immersive
 * Instead:
 *   paisaxe.com/ → 308 → paisaxe.es/
 *
 * Uses 308 (permanent, preserves method).
 */
function handleCanonicalDomain(request: NextRequest): NextResponse | null {
  const canonicalDomain = LOCATION_CONFIG.domain; // paisaxe.es
  const hostname = request.nextUrl.hostname;

  // Already on canonical domain
  if (hostname === canonicalDomain) return null;

  // Don't redirect localhost (development)
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;

  // Check if this is an alternate domain we should redirect
  const alternateDomains = [
    `www.${canonicalDomain}`,
    LOCATION_CONFIG.alternateDomain,
    LOCATION_CONFIG.alternateDomain ? `www.${LOCATION_CONFIG.alternateDomain}` : null,
  ].filter(Boolean);

  if (!alternateDomains.includes(hostname)) return null;

  const url = request.nextUrl.clone();
  url.host = canonicalDomain;
  url.port = "";
  url.protocol = "https";

  return NextResponse.redirect(url, 308);
}

/**
 * Redirect root path to /immersive.
 *
 * This replaces the next.config.ts redirect (which ran at CDN level
 * before the proxy, bypassing canonical domain checks).
 * Uses 308 (permanent, preserves method) — /immersive is the canonical landing page.
 */
function handleRootRedirect(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== "/") return null;

  const url = request.nextUrl.clone();
  url.pathname = "/immersive";
  return NextResponse.redirect(url, 308);
}

/**
 * Rewrite /story/:slug to /immersive?story=:slug.
 *
 * The /story/[slug] route exists for SEO-friendly sharing URLs, but the
 * server-component redirect() there triggers a React hydration error (#310)
 * because LanguageProvider's early return changes the hook count.
 *
 * By rewriting at the proxy level (before React renders), we avoid the
 * hydration mismatch entirely. Uses 308 (permanent redirect, preserves method).
 */
function handleStoryRewrite(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const match = pathname.match(/^\/story\/([^/]+)$/);

  if (!match || !match[1]) {
    return null;
  }

  const slug = match[1];
  const url = request.nextUrl.clone();
  url.pathname = "/immersive";
  url.searchParams.set("story", slug);

  return NextResponse.redirect(url, 308);
}

/**
 * HTTP methods that require CSRF validation.
 */
const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Validate CSRF token for state-changing API requests.
 * Returns a 403 response if validation fails, null if it passes.
 */
function handleCsrfValidation(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // Only validate API routes
  if (!pathname.startsWith("/api")) return null;

  // Only validate state-changing methods
  if (!CSRF_METHODS.has(request.method)) return null;

  // Skip exempt routes (webhooks, MCP, cron, health)
  if (isExemptFromCsrf(pathname)) return null;

  // Validate token
  if (validateCsrfToken(request)) return null;

  return NextResponse.json(
    { error: "CSRF token missing or invalid" },
    { status: 403 }
  );
}

/**
 * Set CSRF cookie on non-API page requests if one doesn't already exist.
 * The cookie is httpOnly=false so client-side JS can read it.
 */
function setCsrfCookie(request: NextRequest, response: NextResponse): void {
  const { pathname } = request.nextUrl;

  // Don't set cookie on API requests
  if (pathname.startsWith("/api")) return;

  // Don't overwrite existing cookie
  const existingToken = request.cookies.get(CSRF_COOKIE_NAME);
  if (existingToken?.value) return;

  const token = generateCsrfToken();
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set(CSRF_COOKIE_NAME, token, csrfCookieOptions(isProduction));
}

export async function proxy(request: NextRequest) {
  // 0a. Redirect alternate domains to canonical domain (single hop)
  const canonicalRedirect = handleCanonicalDomain(request);
  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  // 0b. Rewrite /story/:slug → /immersive?story=:slug (before maintenance check)
  const storyRewrite = handleStoryRewrite(request);
  if (storyRewrite) {
    return storyRewrite;
  }

  // 1. Check maintenance mode (applies to all routes)
  const maintenanceResponse = await handleMaintenanceMode(request);
  if (maintenanceResponse) {
    return maintenanceResponse;
  }

  // 2. Redirect root path to /immersive (replaces next.config.ts redirect
  //    which ran at CDN level before proxy, bypassing canonical domain checks)
  const rootRedirect = handleRootRedirect(request);
  if (rootRedirect) {
    return rootRedirect;
  }

  // 3. Handle CORS preflight for API routes
  const corsResponse = handleCORS(request);
  if (corsResponse) {
    return corsResponse;
  }

  // 4. Validate CSRF token for state-changing API requests
  const csrfResponse = handleCsrfValidation(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  // 5. Generate CSP nonce and set it on the request for downstream server components
  const nonce = generateNonce();
  request.headers.set("x-csp-nonce", nonce);

  // 6. Refresh auth session if needed (handles expired tokens)
  const response = await refreshAuthSession(request);

  // 7. Set per-request CSP header with nonce (replaces static CSP in next.config.ts)
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce));

  // 8. Set CSRF cookie on page requests (if not already set)
  setCsrfCookie(request, response);

  // 9. Add CORS headers if needed
  addCORSHeaders(request, response);

  return response;
}

export const config = {
  // Match all routes for maintenance mode handling
  // (CORS is only applied to /api/* routes within the proxy function)
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
