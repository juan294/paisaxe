// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  EXPECTED_VOICE_AGENTS,
  checkElevenLabsVoicePreflight,
} from "./check-elevenlabs-voice-preflight.mjs";

const HEALTH = {
  provider: "ok",
  fingerprint: "sha256:1234567890abcdef",
  fingerprint_matches: true,
  agents: EXPECTED_VOICE_AGENTS,
  deployment_commit: "0123456789abcdef0123456789abcdef01234567",
};

const DEFAULT_OPTIONS = {
  baseUrl: "https://paisaxe.example",
  healthProbeSecret: "health-secret",
  expectedDeploymentCommit:
    "0123456789abcdef0123456789abcdef01234567",
  githubDeploymentId: "123456",
  now: () => new Date("2026-08-24T12:00:00.000Z"),
};

function response(body: Record<string, unknown> = HEALTH, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("checkElevenLabsVoicePreflight", () => {
  it("accepts exact five-agent, bound, secret-safe evidence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response());

    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        bypassSecret: "bypass-secret",
        fetchImpl,
      })
    ).resolves.toEqual({
      ...HEALTH,
      custom_llm: "not_applicable",
      target_url: "https://paisaxe.example",
      response_url: "https://paisaxe.example/api/health/voice",
      github_deployment_id: "123456",
      checked_at: "2026-08-24T12:00:00.000Z",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://paisaxe.example/api/health/voice",
      expect.objectContaining({
        redirect: "error",
        signal: expect.any(AbortSignal),
        headers: {
          authorization: "Bearer health-secret",
          "cache-control": "no-cache",
          "x-vercel-protection-bypass": "bypass-secret",
        },
      })
    );
  });

  it.each([
    [{ ...HEALTH, provider: "credential_rejected" }, /provider.*credential_rejected/i],
    [{ ...HEALTH, fingerprint: "not-a-fingerprint" }, /fingerprint.*malformed/i],
    [{ ...HEALTH, fingerprint_matches: false }, /fingerprint.*not bound/i],
    [{ ...HEALTH, agents: ["pelayo"] }, /agent coverage/i],
  ])("fails closed for incomplete evidence", async (body, message) => {
    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        fetchImpl: vi.fn().mockResolvedValue(response(body)),
      })
    ).rejects.toThrow(message);
  });

  it("rejects non-JSON and non-success responses", async () => {
    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        fetchImpl: vi.fn().mockResolvedValue(new Response("nope", { status: 503 })),
      })
    ).rejects.toThrow(/non-JSON/i);

    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        fetchImpl: vi.fn().mockResolvedValue(response(HEALTH, 503)),
      })
    ).rejects.toThrow(/status 503/i);
  });

  it.each([
    [{ ...HEALTH, signed_url: "wss://signed.example/secret" }, /unsafe/i],
    [{ ...HEALTH, api_key: "sk_runtime_secret" }, /unsafe/i],
    [{ ...HEALTH, authorization: "Bearer secret" }, /unsafe/i],
  ])("rejects unsafe evidence", async (body, message) => {
    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        fetchImpl: vi.fn().mockResolvedValue(response(body)),
      })
    ).rejects.toThrow(message);
  });

  it("requires an explicit target and probe secret", async () => {
    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        baseUrl: "",
      })
    ).rejects.toThrow(/RELEASE_TARGET_URL is required/);

    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        healthProbeSecret: "",
      })
    ).rejects.toThrow(/HEALTH_PROBE_SECRET is required/);
  });

  it("rejects non-TLS deployed targets and redirects", async () => {
    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        baseUrl: "http://paisaxe.example",
      })
    ).rejects.toThrow(/must use HTTPS/i);

    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        fetchImpl: vi.fn().mockRejectedValue(new TypeError("redirect")),
      })
    ).rejects.toThrow(/request failed/i);
  });

  it("fails closed on a timeout or deployment identity mismatch", async () => {
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        fetchImpl: vi.fn().mockRejectedValue(timeout),
      })
    ).rejects.toThrow(/timed out/i);

    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        fetchImpl: vi.fn().mockResolvedValue(
          response({ ...HEALTH, deployment_commit: "f".repeat(40) })
        ),
      })
    ).rejects.toThrow(/deployment commit.*candidate/i);
  });

  it("requires exact candidate and deployment identifiers", async () => {
    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        expectedDeploymentCommit: "short",
      })
    ).rejects.toThrow(/full commit hash/i);

    await expect(
      checkElevenLabsVoicePreflight({
        ...DEFAULT_OPTIONS,
        githubDeploymentId: "",
      })
    ).rejects.toThrow(/RELEASE_GITHUB_DEPLOYMENT_ID is required/i);
  });
});
