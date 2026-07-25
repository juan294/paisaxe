import { NextRequest, NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";
import {
  ElevenLabsSignedSessionError,
  getElevenLabsSignedUrl,
  isAdminVoiceAgentKey,
} from "@/lib/elevenlabs-signed-session";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth();
  if (!auth.valid) {
    return auth.error;
  }

  const body = (await request.json().catch(() => null)) as {
    agentKey?: unknown;
  } | null;
  if (!isAdminVoiceAgentKey(body?.agentKey)) {
    return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
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
