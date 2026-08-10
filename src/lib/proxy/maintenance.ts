import { NextRequest, NextResponse } from "next/server";
import { getEnvironment } from "@/lib/environment";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Routes that bypass maintenance mode.
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

// ─── In-memory TTL cache (30s) ────────────────────────────────────────────────
// Avoids hitting Supabase on every non-exempt request while still picking up
// flag changes within 30 seconds in production.
let maintenanceCacheValue: boolean | null = null;
let maintenanceCacheExpiry = 0;
let maintenanceCacheUrl: string | null = null;

/** Reset the maintenance-mode cache (for tests). */
export function resetMaintenanceModeCache(): void {
  maintenanceCacheValue = null;
  maintenanceCacheExpiry = 0;
  maintenanceCacheUrl = null;
}

/**
 * Check if maintenance mode is enabled.
 * Priority: ENV var override > in-memory cache > Database flag
 *
 * - MAINTENANCE_MODE=true  → always on
 * - MAINTENANCE_MODE=false → always off
 * - unset → check DB (cached for 30s in production, uncached in development)
 */
export async function isMaintenanceModeEnabled(): Promise<boolean> {
  const envFlag = getEnv("MAINTENANCE_MODE");

  if (envFlag === "true") return true;
  if (envFlag === "false") return false;

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) return false;

  const environment = getEnvironment();
  // Disable in-memory cache in non-production environments (dev, test)
  const isDev = environment === "development" || process.env.NODE_ENV === "test";

  // Return cached value if still fresh (production only) and from the same Supabase project
  if (
    !isDev &&
    maintenanceCacheValue !== null &&
    Date.now() < maintenanceCacheExpiry &&
    maintenanceCacheUrl === supabaseUrl
  ) {
    return maintenanceCacheValue;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/feature_flags?flag_key=eq.maintenance_mode&environment=eq.${environment}&select=enabled`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        signal: AbortSignal.timeout(8_000),
        ...(isDev
          ? { cache: "no-store" as const }
          : { next: { revalidate: 30 } }
        ),
      }
    );

    if (!response.ok) {
      logger.error("Failed to fetch maintenance mode flag", {
        status: response.status,
      });
      return false;
    }

    const data = await response.json();
    const enabled = Array.isArray(data) && data.length > 0 ? data[0].enabled === true : false;

    if (!isDev) {
      maintenanceCacheValue = enabled;
      maintenanceCacheExpiry = Date.now() + 30_000;
      maintenanceCacheUrl = supabaseUrl;
    }

    return enabled;
  } catch (error) {
    logger.error("Error checking maintenance mode", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Handle maintenance mode redirect.
 * Returns a redirect response if maintenance mode is enabled and the route
 * should not bypass it. Returns null otherwise.
 */
export async function handleMaintenanceMode(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;

  if (shouldBypassMaintenanceMode(pathname)) return null;

  const maintenanceEnabled = await isMaintenanceModeEnabled();
  if (!maintenanceEnabled) return null;

  return NextResponse.redirect(new URL("/coming-soon", request.url));
}
