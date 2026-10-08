import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

/**
 * Create an authenticated Supabase server client using cookies.
 * Shared across API routes that need cookie-based Supabase access.
 */
export async function getSupabaseClient(request: NextRequest) {
  const cookieStore = await cookies();
  const authHeader = request.headers.get("Authorization");
  const bearerHeaders = authHeader?.startsWith("Bearer ")
    ? { global: { headers: { Authorization: authHeader } } }
    : {};

  return createServerClient(
    getSupabaseUrl() ?? "",
    getSupabaseAnonKey() ?? "",
    {
      ...bearerHeaders,
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
            // Ignore in server component context
          }
        },
      },
    }
  );
}

/**
 * Extract and validate a user from the request.
 *
 * Strategy (cookie-first, bearer fallback):
 * 1. If an `Authorization: Bearer <token>` header is present, validate it
 *    directly — this serves API clients (mobile apps, scripts).
 * 2. Otherwise try the cookie-bound session — this serves browser users who
 *    never send an explicit Authorization header.
 *
 * Returns the Supabase user object if authenticated, or null.
 */
export async function getUserFromRequest(request: NextRequest) {
  const supabase = await getSupabaseClient(request);

  const authHeader = request.headers.get("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    // Bearer-token path (API clients)
    const token = authHeader.substring(7);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user;
  }

  // Cookie-session path (browser users)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}
