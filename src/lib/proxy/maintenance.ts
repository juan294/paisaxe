import { NextRequest, NextResponse } from "next/server";
import { getEnvironment } from "@/lib/environment";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Routes that bypass maintenance mode.
 */
const MAINTENANCE_BYPASS_PREFIXES = [
  "/a/",           // PostHog reverse proxy (analytics) — exact segment, see next.config.ts rewrites
  "/admin",        // Admin panel
  "/api",          // API routes (health checks, webhooks)
  "/auth",         // OAuth callbacks for admin sign-in
  "/coming-soon",  // The coming soon page itself
  "/pricing",      // Purchase flow (includes /pricing/success)
  "/_next",        // Next.js internals
  // NOTE: /immersive (the main app) is intentionally NOT bypassed — maintenance mode
  // must gate the primary surface, or the control does nothing (DO-H3).
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
 * Fall back to the last successfully-fetched value for this Supabase project when a
 * DB refresh genuinely fails (DO-H3), regardless of whether that value is still
 * within its 30s freshness window. Defaults to `false` when there is no known-good
 * value yet (e.g. first request, or a different project) — logging in both cases so
 * the fallback is observable.
 */
function resolveMaintenanceFallback(supabaseUrl: string): boolean {
  if (maintenanceCacheValue !== null && maintenanceCacheUrl === supabaseUrl) {
    logger.error("Serving last-known maintenance mode value after fetch failure", {
      lastKnownValue: maintenanceCacheValue,
    });
    return maintenanceCacheValue;
  }
  return false;
}

/**
 * Check if maintenance mode is enabled.
 * Priority: ENV var override > in-memory cache > Database flag
 *
 * - MAINTENANCE_MODE=true  → always on
 * - MAINTENANCE_MODE=false → always off
 * - unset → check DB (cached for 30s in production, uncached in development)
 *
 * If a DB refresh fails (non-OK response or thrown error) in production, this
 * serves the last successfully-fetched value for the same Supabase project —
 * even if it is past its 30s TTL — rather than defaulting to `false` (DO-H3).
 * Failing open here would defeat the control precisely when it matters most
 * (a database outage); failing closed on any transient blip would be worse
 * (self-amplifying, since checking this flag itself hits the database). With
 * no last-known value yet (e.g. cold start, or a different Supabase project),
 * it defaults to `false`.
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
      return resolveMaintenanceFallback(supabaseUrl);
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
    return resolveMaintenanceFallback(supabaseUrl);
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
