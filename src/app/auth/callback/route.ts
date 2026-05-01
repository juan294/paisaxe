import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/immersive";

  // Prevent open redirect: only allow relative paths starting with /
  // Reject protocol-relative URLs (//evil.com) and absolute URLs (https://evil.com)
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/immersive";

  if (code) {
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
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have proxy refreshing
              // user sessions.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", "session_exchange_failed");
      logger.error("[AUTH_CALLBACK_FAILURE]", {
        error: error.message,
        code_present: true,
      });
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  // Return to homepage on error
  return NextResponse.redirect(`${origin}/immersive`);
}
