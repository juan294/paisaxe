// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  probe: vi.fn(),
  captureCheckIn: vi.fn(),
  captureMessage: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@/lib/elevenlabs-signed-session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/elevenlabs-signed-session")>();
  return {
    ...actual,
    probeElevenLabsVoiceAgents: mocks.probe,
  };
});

vi.mock("@sentry/nextjs", () => ({
  captureCheckIn: mocks.captureCheckIn,
  captureMessage: mocks.captureMessage,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
    warn: vi.fn(),
  },
}));

import { GET } from "./route";
import { ElevenLabsSignedSessionError } from "@/lib/elevenlabs-signed-session";

const FINGERPRINT = "sha256:1234567890abcdef";

function request(secret?: string) {
  return new NextRequest("http://localhost/api/cron/elevenlabs-voice-canary", {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("GET /api/cron/elevenlabs-voice-canary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mocks.probe.mockResolvedValue({
      provider: "ok",
      fingerprint: FINGERPRINT,
      fingerprintMatches: true,
      agents: ["pelayo"],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects unauthenticated requests before provider I/O", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mocks.probe).not.toHaveBeenCalled();
    expect(mocks.captureCheckIn).not.toHaveBeenCalled();
  });

  it("checks only the shared-key Pelayo sentinel and records success", async () => {
    const response = await GET(request("cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      provider: "ok",
      fingerprint: FINGERPRINT,
      fingerprint_matches: true,
      agents: ["pelayo"],
    });
    expect(mocks.probe).toHaveBeenCalledWith(["pelayo"], "scheduled-canary");
    expect(mocks.captureCheckIn).toHaveBeenCalledWith(
      { monitorSlug: "elevenlabs-voice-canary", status: "ok" },
      expect.objectContaining({
        schedule: { type: "crontab", value: "*/15 * * * *" },
      })
    );
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      "[CRON_SUCCESS]",
      expect.objectContaining({ job: "elevenlabs-voice-canary" })
    );
  });

  it("records a monitor failure and explicit Sentry alert event", async () => {
    mocks.probe.mockRejectedValue(
      new ElevenLabsSignedSessionError(
        "upstream_authentication_failed",
        503,
        {
          providerStatus: 401,
          fingerprint: FINGERPRINT,
          fingerprintMatches: true,
        }
      )
    );

    const response = await GET(request("cron-secret"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "voice_provider_unavailable",
    });
    expect(mocks.captureCheckIn).toHaveBeenCalledWith(
      { monitorSlug: "elevenlabs-voice-canary", status: "error" },
      expect.any(Object)
    );
    expect(mocks.captureMessage).toHaveBeenCalledWith(
      "[ELEVENLABS_CREDENTIAL_REJECTED]",
      expect.objectContaining({
        level: "error",
        extra: expect.objectContaining({
          fingerprint: FINGERPRINT,
          provider_status: 401,
          failure_class: "upstream_authentication_failed",
        }),
      })
    );
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "[CRON_FAILURE]",
      expect.objectContaining({ job: "elevenlabs-voice-canary" })
    );
  });
});
