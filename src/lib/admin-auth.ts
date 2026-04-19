import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type AuthResult =
  | { valid: true; userId: string }
  | { valid: false; error: NextResponse };

/**
 * Validates admin authentication via Supabase session cookie + role check.
 * Reads cookies internally - no request parameter needed.
 */
export async function validateAdminAuth(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // Check admin role in user_profiles
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return {
        valid: false,
        error: NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        ),
      };
    }

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
 * Usage:
 *   return withAdmin(async (supabase) => {
 *     const { data } = await supabase.from("stories").select("*");
 *     return NextResponse.json({ data });
 *   });
 */
export async function withAdmin<T>(
  handler: (supabase: SupabaseClient) => Promise<T>
): Promise<T | NextResponse> {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }
  return handler(createAdminClient());
}
