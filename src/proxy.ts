import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCATION_CONFIG } from "@/config/location";
import { getEnvironment } from "@/lib/environment";

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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
 * Add CORS headers to a response for API routes.
 */
function addCORSHeaders(request: NextRequest, response: NextResponse): void {
  const origin = request.headers.get("origin");
  const { pathname } = request.nextUrl;

  // Only add CORS headers to API routes with allowed origins
  if (pathname.startsWith("/api") && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin!);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }
}

/**
 * Refresh Supabase auth session if expired.
 * This ensures the client and server auth states stay in sync.
 * Returns a response with updated cookies if session was refreshed.
 */
async function refreshAuthSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip if Supabase not configured
  if (!supabaseUrl || !supabaseKey) {
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

    // This will refresh the session if expired and update cookies
    await supabase.auth.getUser();
  } catch (error) {
    // Log but don't fail the request if session refresh fails
    console.error("Error refreshing auth session:", error);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  // 1. Check maintenance mode first (applies to all routes)
  const maintenanceResponse = await handleMaintenanceMode(request);
  if (maintenanceResponse) {
    return maintenanceResponse;
  }

  // 2. Handle CORS preflight for API routes
  const corsResponse = handleCORS(request);
  if (corsResponse) {
    return corsResponse;
  }

  // 3. Refresh auth session if needed (handles expired tokens)
  const response = await refreshAuthSession(request);

  // 4. Add CORS headers if needed
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
