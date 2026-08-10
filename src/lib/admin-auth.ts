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
const roleCache = new Map<string, { role: string; expiresAt: number }>();

/**
 * Validates admin authentication via Supabase session cookie + role check.
 * Reads cookies internally - no request parameter needed.
 *
 * BE-M2: The user_profiles DB lookup is skipped on cache hit (30s TTL).
 * Non-PGRST116 errors from the profile query log [ADMIN_PROFILE_LOOKUP_FAILED]
 * and return 500 rather than silently returning 401/403.
 */
export async function validateAdminAuth(): Promise<AuthResult> {
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
    const cached = roleCache.get(user.id);
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
        roleCache.set(user.id, {
          role: profile.role,
          expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
        });
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
    roleCache.set(user.id, {
      role: profile.role,
      expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
    });

    return { valid: true, userId: user.id };
  } catch {
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
  request?: Pick<Request, "headers">
): Promise<T | NextResponse> {
  const run = async (): Promise<T | NextResponse> => {
    const auth = await validateAdminAuth();
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
  request?: Pick<Request, "headers">
): Promise<T | NextResponse> {
  const run = async (): Promise<T | NextResponse> => {
    const auth = await validateAdminAuth();
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
