import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { getSupabaseClient, getUserFromRequest } from "@/lib/supabase-auth";
import type { VoiceAccessResponse } from "@/types/voice-access";

export type { VoiceAccessResponse };

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

  // Query for active voice purchase — maybeSingle() returns {data: null, error: null}
  // when no row is found (no PGRST116 needed)
  const { data, error } = await supabase
    .from("voice_purchases")
    .select("id, purchase_type, expires_at")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("[VOICE_ACCESS_FETCH_FAILED]", { user_id: user.id, error });
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
