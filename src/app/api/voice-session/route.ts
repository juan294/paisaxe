import { NextRequest, NextResponse } from "next/server";
import {
  ElevenLabsSignedSessionError,
  getElevenLabsSignedUrl,
  isVisitorVoiceAgentKey,
} from "@/lib/elevenlabs-signed-session";
import { getSupabaseClient, getUserFromRequest } from "@/lib/supabase-auth";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    agentKey?: unknown;
  } | null;
  if (!isVisitorVoiceAgentKey(body?.agentKey)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("voice_purchases")
    .select("id")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("[VOICE_SESSION_ACCESS_CHECK_FAILED]", {
      user_id: user.id,
      code: error.code,
    });
    return NextResponse.json(
      { error: "Failed to check access" },
      { status: 500 }
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Voice access required" },
      { status: 403 }
    );
  }

  try {
    const signedUrl = await getElevenLabsSignedUrl(body.agentKey);
    return NextResponse.json(
      { signedUrl },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof ElevenLabsSignedSessionError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "upstream_unavailable" },
      { status: 502 }
    );
  }
}
