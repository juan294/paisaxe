import { NextRequest, NextResponse } from "next/server";
import { withAdminSession } from "@/lib/admin-auth";
import {
  ElevenLabsSignedSessionError,
  getElevenLabsSignedUrl,
  isAdminVoiceAgentKey,
} from "@/lib/elevenlabs-signed-session";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return withAdminSession(async () => {

    const body = (await request.json().catch(() => null)) as {
      agentKey?: unknown;
    } | null;
    if (!isAdminVoiceAgentKey(body?.agentKey)) {
      return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
    }

    try {
      const signedUrl = await getElevenLabsSignedUrl(body.agentKey, "admin-session");
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
        { status: 503 }
      );
    }

  }, request);
}
