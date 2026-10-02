// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  probe: vi.fn(),
}));

vi.mock("@/lib/elevenlabs-signed-session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/elevenlabs-signed-session")>();
  return {
    ...actual,
    probeElevenLabsVoiceAgents: mocks.probe,
  };
});

import { GET } from "./route";
import { ElevenLabsSignedSessionError } from "@/lib/elevenlabs-signed-session";

const FINGERPRINT = "sha256:1234567890abcdef";
const AGENTS = ["pelayo", "booking", "penny", "iris", "xander"];

function request(secret?: string) {
  return new NextRequest("http://localhost/api/health/voice", {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("GET /api/health/voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HEALTH_PROBE_SECRET", "health-secret");
    vi.stubEnv(
      "VERCEL_GIT_COMMIT_SHA",
      "0123456789abcdef0123456789abcdef01234567"
    );
    mocks.probe.mockResolvedValue({
      provider: "ok",
      fingerprint: FINGERPRINT,
      fingerprintMatches: true,
      agents: AGENTS,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a missing or invalid health-probe bearer without provider I/O", async () => {
    for (const candidate of [undefined, "wrong-secret"]) {
      const response = await GET(request(candidate));
      expect(response.status).toBe(401);
    }
    expect(mocks.probe).not.toHaveBeenCalled();
  });

  it("fails closed when HEALTH_PROBE_SECRET is not configured", async () => {
    vi.stubEnv("HEALTH_PROBE_SECRET", "");

    const response = await GET(request("health-secret"));

    expect(response.status).toBe(401);
    expect(mocks.probe).not.toHaveBeenCalled();
  });

  it("returns only safe five-agent provider evidence", async () => {
    const response = await GET(request("health-secret"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      provider: "ok",
      fingerprint: FINGERPRINT,
      fingerprint_matches: true,
      agents: AGENTS,
      deployment_commit: "0123456789abcdef0123456789abcdef01234567",
    });
    expect(mocks.probe).toHaveBeenCalledWith(AGENTS, "authorized-health");
  });

  it("classifies credential failures and preserves only the safe fingerprint", async () => {
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

    const response = await GET(request("health-secret"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      provider: "credential_rejected",
      fingerprint: FINGERPRINT,
      fingerprint_matches: true,
      agents: [],
      deployment_commit: "0123456789abcdef0123456789abcdef01234567",
    });
    expect(JSON.stringify(body)).not.toMatch(/wss:\/\/|signed_url|api[_-]?key/i);
  });

  it("classifies provider outages without returning raw errors", async () => {
    mocks.probe.mockRejectedValue(
      new ElevenLabsSignedSessionError("upstream_unavailable", 503, {
        providerStatus: 500,
        fingerprint: FINGERPRINT,
        fingerprintMatches: true,
      })
    );

    const response = await GET(request("health-secret"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      provider: "unavailable",
      fingerprint: FINGERPRINT,
      fingerprint_matches: true,
      agents: [],
      deployment_commit: "0123456789abcdef0123456789abcdef01234567",
    });
  });
});
