import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function getSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
            // Ignore in server component context
          }
        },
      },
    }
  );
}

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

export interface VoiceAccessResponse {
  hasAccess: boolean;
  expiresAt: string | null;
  purchaseType: string | null;
}

/**
 * GET /api/voice-access
 *
 * Check if the authenticated user has active voice access.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabase = await getSupabaseClient();

  // Query for active voice purchase
  const { data, error } = await supabase
    .from("voice_purchases")
    .select("id, purchase_type, expires_at")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("[voice-access] Error fetching access:", error);
    return NextResponse.json(
      { error: "Failed to check access" },
      { status: 500 }
    );
  }

  const response: VoiceAccessResponse = {
    hasAccess: !!data,
    expiresAt: data?.expires_at ?? null,
    purchaseType: data?.purchase_type ?? null,
  };

  return NextResponse.json(response);
}
