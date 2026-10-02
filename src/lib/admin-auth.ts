import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "./supabase-admin";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import { logger } from "@/lib/logger";
import { withRequestContext } from "@/lib/request-context";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthResult =
  | { valid: true; userId: string }
  | { valid: false; error: NextResponse };

/** BE-M2: In-process cache keyed by user_id. 30-second TTL. */
const ROLE_CACHE_TTL_MS = 30_000;

/**
 * BE-L7 (#800): Bound the cache so a high-cardinality user population can't
 * grow it unboundedly — entries were previously only ever overwritten, never
 * removed. Mirrors the prune-then-shed pattern used by the in-memory
 * rate-limit store (src/lib/rate-limit.ts: checkInMemory).
 */
export const ROLE_CACHE_MAX_ENTRIES = 2_000;
const roleCache = new Map<string, { role: string; expiresAt: number }>();

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Test-only visibility into the cache size (mirrors getRateLimitStore()). */
export function getRoleCacheSize(): number {
  return roleCache.size;
}

/**
 * SE-M4 (#848): Escape hatch to evict a single user's cached role immediately.
 * Call this wherever a role changes so the change takes effect before the
 * 30s TTL would otherwise expire.
 *
 * Regression risk: the cache is per-instance (module-level Map), so this only
 * clears the instance that handles the call — it is NOT a global revocation
 * mechanism across every warm Vercel instance. A demoted user's other warm
 * instances keep honoring their own cached entry until its TTL lapses. No
 * in-app flow currently mutates user_profiles.role (role changes are applied
 * directly in Supabase today), so this is the documented hook for whenever
 * such a flow is added.
 */
export function invalidateRoleCache(userId: string): void {
  roleCache.delete(userId);
}

function pruneExpiredRoleCacheEntries(now: number): void {
  for (const [key, entry] of roleCache) {
    if (entry.expiresAt <= now) {
      roleCache.delete(key);
    }
  }
}

function setRoleCache(userId: string, role: string): void {
  const now = Date.now();
  if (!roleCache.has(userId) && roleCache.size >= ROLE_CACHE_MAX_ENTRIES) {
    pruneExpiredRoleCacheEntries(now);
    if (roleCache.size >= ROLE_CACHE_MAX_ENTRIES) {
      // Still full after pruning expired entries — shed the oldest 10%
      // (Map iteration order = insertion order), same load-shed behavior
      // as the rate-limit in-memory store.
      const keysToDelete = Array.from(roleCache.keys()).slice(
        0,
        Math.floor(ROLE_CACHE_MAX_ENTRIES * 0.1)
      );
      for (const key of keysToDelete) {
        roleCache.delete(key);
      }
    }
  }
  roleCache.set(userId, { role, expiresAt: now + ROLE_CACHE_TTL_MS });
}

/**
 * Validates admin authentication via Supabase session cookie + role check.
 * Reads cookies internally - no request parameter needed.
 *
 * BE-M2: The user_profiles DB lookup is skipped on cache hit (30s TTL).
 * Non-PGRST116 errors from the profile query log [ADMIN_PROFILE_LOOKUP_FAILED]
 * and return 500 rather than silently returning 401/403.
 *
 * SE-M4 (#848): Pass `{ skipCache: true }` (as withAdmin/withAdminRead do for
 * mutating HTTP methods) to force a fresh DB check instead of trusting a
 * cached role that may be up to 30s stale.
 */
export async function validateAdminAuth(options?: {
  skipCache?: boolean;
}): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      getSupabaseUrl() ?? "",
      getSupabaseAnonKey() ?? "",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Called from a Server Component - can be ignored
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        valid: false,
        error: NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        ),
      };
    }

    // BE-M2: Check the in-process cache before hitting the DB.
    // SE-M4 (#848): mutating requests explicitly opt out (see withAdmin /
    // withAdminRead) so a stale cached role can't authorize a write.
    const skipCache = options?.skipCache ?? false;
    const cached = skipCache ? undefined : roleCache.get(user.id);
    if (cached && cached.expiresAt > Date.now()) {
      if (cached.role !== "admin") {
        return {
          valid: false,
          error: NextResponse.json(
            { error: "Admin access required" },
            { status: 403 }
          ),
        };
      }
      return { valid: true, userId: user.id };
    }

    // Check admin role in user_profiles
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      // PGRST116 = "no rows returned" — treat as a missing profile (403).
      // Any other error is unexpected and should surface as 500.
      const code = (profileError as { code?: string }).code;
      if (code !== "PGRST116") {
        logger.error("[ADMIN_PROFILE_LOOKUP_FAILED]", {
          userId: user.id,
          code,
          error: profileError.message,
        });
        return {
          valid: false,
          error: NextResponse.json(
            { error: "Authentication failed" },
            { status: 500 }
          ),
        };
      }
      return {
        valid: false,
        error: NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        ),
      };
    }

    if (!profile || profile.role !== "admin") {
      // Populate cache even for non-admin so repeat lookups are fast.
      if (profile) {
        setRoleCache(user.id, profile.role);
      }
      return {
        valid: false,
        error: NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        ),
      };
    }

    // Populate cache for admin user.
    setRoleCache(user.id, profile.role);

    return { valid: true, userId: user.id };
  } catch (error) {
    // BE-L7 (#800): a total auth failure was previously silent — logger.error
    // routes through the sanitizer (src/lib/logger-sanitize.ts), which is
    // required here since Supabase auth errors can carry token fragments.
    logger.error("[ADMIN_AUTH_UNHANDLED_ERROR]", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 }
      ),
    };
  }
}

/**
 * SE-M4 (#848): true when `request.method` is a write verb, so callers can
 * skip the 30s role cache and check the DB fresh before allowing a mutation.
 */
function isMutatingRequest(request?: Pick<Request, "method">): boolean {
  return Boolean(request?.method && MUTATING_METHODS.has(request.method.toUpperCase()));
}

/**
 * Higher-order function that enforces admin authentication structurally.
 *
 * Calls validateAdminAuth() first. If auth fails, returns the 401/403/500
 * error response immediately — the handler is never invoked. If auth succeeds,
 * calls handler with a service-key Supabase client (createAdminClient()).
 *
 * Use for mutations (INSERT/UPDATE/DELETE) that need to bypass RLS.
 */
export async function withAdmin<T>(
  handler: (supabase: SupabaseClient) => Promise<T>,
  request?: Pick<Request, "headers" | "method">
): Promise<T | NextResponse> {
  const run = async (): Promise<T | NextResponse> => {
    const auth = await validateAdminAuth({ skipCache: isMutatingRequest(request) });
    if (!auth.valid) {
      return auth.error;
    }
    return handler(createAdminClient());
  };

  return request ? withRequestContext(request, run) : run();
}

/**
 * Like withAdmin but passes a cookie-scoped Supabase client that respects RLS.
 *
 * Use for read-only admin operations — the authenticated admin user's session
 * is subject to Row-Level Security policies, limiting blast radius if the
 * account is compromised. Mutations that need cross-user access should use
 * withAdmin (service-role) instead.
 */
export async function withAdminRead<T>(
  handler: (supabase: SupabaseClient) => Promise<T>,
  request?: Pick<Request, "headers" | "method">
): Promise<T | NextResponse> {
  const run = async (): Promise<T | NextResponse> => {
    const auth = await validateAdminAuth({ skipCache: isMutatingRequest(request) });
    if (!auth.valid) {
      return auth.error;
    }
    const cookieStore = await cookies();
    const supabase = createServerClient(
      getSupabaseUrl() ?? "",
      getSupabaseAnonKey() ?? "",
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component context — can be ignored
            }
          },
        },
      }
    );
    return handler(supabase);
  };

  return request ? withRequestContext(request, run) : run();
}
