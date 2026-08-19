import { NextRequest, NextResponse } from "next/server";
import {
  ElevenLabsSignedSessionError,
  getElevenLabsSignedUrl,
  isVisitorVoiceAgentKey,
} from "@/lib/elevenlabs-signed-session";
import { getSupabaseClient, getUserFromRequest } from "@/lib/supabase-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildRateLimitHeaders } from "@/lib/chat-route-utils";
import { logger } from "@/lib/logger";

// BE-S2 (#803): this route mints a signed ElevenLabs URL per call — a
// per-caller ceiling on a metered upstream — with no rate limiting at all
// before this fix. Keyed on the authenticated user id (not IP): every
// caller here has already passed auth, so the user id is a stable,
// unspoofable identifier and avoids the shared-bucket problems IP-keying
// has for NAT'd/mobile clients (BE-M1). 10 req/60s is generous enough for
// legitimate reconnects while bounding abuse of the signed-URL mint.
const VOICE_SESSION_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 10,
  maxEntries: 10_000,
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(
    `voice-session:${user.id}`,
    VOICE_SESSION_RATE_LIMIT
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: buildRateLimitHeaders(rateLimit, true) }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    agentKey?: unknown;
  } | null;
  if (!isVisitorVoiceAgentKey(body?.agentKey)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
  }

  const supabase = await getSupabaseClient(request);
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
