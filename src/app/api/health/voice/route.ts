import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  ELEVENLABS_VOICE_AGENT_KEYS,
  ElevenLabsSignedSessionError,
  isElevenLabsCredentialFailure,
  probeElevenLabsVoiceAgents,
} from "@/lib/elevenlabs-signed-session";
import { safeEqual } from "@/lib/safe-equal";

type VoiceProviderState = "ok" | "credential_rejected" | "unavailable";

interface VoiceHealthResponse {
  provider: VoiceProviderState;
  fingerprint: string | null;
  fingerprint_matches: boolean;
  agents: readonly string[];
  deployment_commit: string | null;
}

function deploymentCommit(): string | null {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  return commit && /^[0-9a-f]{40}$/i.test(commit) ? commit : null;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = getEnv("HEALTH_PROBE_SECRET");
  const provided = request.headers.get("authorization");
  return Boolean(
    secret && provided && safeEqual(provided, `Bearer ${secret}`)
  );
}

function response(
  body: VoiceHealthResponse,
  status: number
): NextResponse<VoiceHealthResponse> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Authorized deep health for the five Paisaxe-owned ElevenLabs agents.
 * Signed URLs are requested and discarded inside the shared probe helper.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await probeElevenLabsVoiceAgents(
      ELEVENLABS_VOICE_AGENT_KEYS,
      "authorized-health"
    );
    return response(
      {
        provider: result.provider,
        fingerprint: result.fingerprint,
        fingerprint_matches: result.fingerprintMatches,
        agents: result.agents,
        deployment_commit: deploymentCommit(),
      },
      200
    );
  } catch (error) {
    const known =
      error instanceof ElevenLabsSignedSessionError ? error : undefined;
    return response(
      {
        provider: isElevenLabsCredentialFailure(error)
          ? "credential_rejected"
          : "unavailable",
        fingerprint: known?.fingerprint ?? null,
        fingerprint_matches: known?.fingerprintMatches ?? false,
        agents: [],
        deployment_commit: deploymentCommit(),
      },
      503
    );
  }
}
