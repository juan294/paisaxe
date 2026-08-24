import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import {
  ElevenLabsSignedSessionError,
  isElevenLabsCredentialFailure,
  probeElevenLabsVoiceAgents,
} from "@/lib/elevenlabs-signed-session";
import { verifyVercelCron } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

const JOB = "elevenlabs-voice-canary";
const MONITOR_CONFIG = {
  schedule: { type: "crontab" as const, value: "*/15 * * * *" },
  checkinMargin: 5,
  maxRuntime: 1,
  failureIssueThreshold: 1,
  recoveryThreshold: 1,
};

/**
 * Shared-key sentinel. Pelayo Visitor is enough to detect a rejected runtime
 * credential every 15 minutes; the release deep-health gate checks all five
 * owned agents without multiplying scheduled provider traffic.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyVercelCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  try {
    const result = await probeElevenLabsVoiceAgents(
      ["pelayo"],
      "scheduled-canary"
    );
    Sentry.captureCheckIn(
      { monitorSlug: JOB, status: "ok" },
      MONITOR_CONFIG
    );
    logger.info("[CRON_SUCCESS]", {
      job: JOB,
      duration_ms: Date.now() - start,
    });
    return NextResponse.json(
      {
        provider: result.provider,
        fingerprint: result.fingerprint,
        fingerprint_matches: result.fingerprintMatches,
        agents: result.agents,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const known =
      error instanceof ElevenLabsSignedSessionError ? error : undefined;
    const event = isElevenLabsCredentialFailure(error)
      ? "[ELEVENLABS_CREDENTIAL_REJECTED]"
      : "[ELEVENLABS_PROVIDER_UNAVAILABLE]";

    Sentry.captureCheckIn(
      { monitorSlug: JOB, status: "error" },
      MONITOR_CONFIG
    );
    Sentry.captureMessage(event, {
      level: "error",
      tags: { source: "scheduled-canary" },
      extra: {
        failure_class: known?.code ?? "unknown",
        provider_status: known?.providerStatus ?? null,
        fingerprint: known?.fingerprint ?? null,
        fingerprint_matches: known?.fingerprintMatches ?? false,
      },
    });
    logger.error("[CRON_FAILURE]", {
      job: JOB,
      duration_ms: Date.now() - start,
      failure_class: known?.code ?? "unknown",
    });
    return NextResponse.json(
      { error: "voice_provider_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
