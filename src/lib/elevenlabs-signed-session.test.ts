import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ElevenLabsSignedSessionError,
  ELEVENLABS_VOICE_AGENT_KEYS,
  getElevenLabsSignedUrl,
  isAdminVoiceAgentKey,
  isVisitorVoiceAgentKey,
  probeElevenLabsVoiceAgents,
} from "./elevenlabs-signed-session";
import { fingerprintElevenLabsApiKey } from "./elevenlabs-credentials";
import { logger } from "./logger";

describe("ElevenLabs signed sessions", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.stubEnv("ELEVENLABS_API_KEY", "server-secret");
    vi.stubEnv("ELEVENLABS_API_KEY_FINGERPRINT", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv(
      "ELEVENLABS_BOOKING_AGENT_ID",
      "agent_5201kgm2956ge8ct95yxjas867z5"
    );
  });

  it("uses a fixed Paisaxe allowlist instead of accepting arbitrary agent IDs", () => {
    expect(isVisitorVoiceAgentKey("pelayo")).toBe(true);
    expect(isVisitorVoiceAgentKey("agent_attacker")).toBe(false);
    expect(isAdminVoiceAgentKey("penny")).toBe(true);
    expect(isAdminVoiceAgentKey("iris")).toBe(true);
    expect(isAdminVoiceAgentKey("xander")).toBe(true);
    expect(isAdminVoiceAgentKey("pelayo")).toBe(false);
  });

  it("fails closed when the server API key is missing", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    await expect(getElevenLabsSignedUrl("pelayo")).rejects.toMatchObject({
      code: "missing_api_key",
      status: 503,
    });
  });

  it("does not call ElevenLabs when the configured fingerprint is malformed", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY_FINGERPRINT", "not-a-fingerprint");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getElevenLabsSignedUrl("pelayo")).rejects.toMatchObject({
      code: "malformed_api_key_fingerprint",
      status: 503,
      fingerprintMatches: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call ElevenLabs when the configured fingerprint does not match", async () => {
    vi.stubEnv(
      "ELEVENLABS_API_KEY_FINGERPRINT",
      "sha256:0000000000000000"
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getElevenLabsSignedUrl("pelayo")).rejects.toMatchObject({
      code: "api_key_fingerprint_mismatch",
      status: 503,
      fingerprint: fingerprintElevenLabsApiKey("server-secret"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a bound fingerprint in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getElevenLabsSignedUrl("pelayo")).rejects.toMatchObject({
      code: "missing_api_key_fingerprint",
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests a signed URL without exposing the API key in the URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ signed_url: "wss://signed.example/session" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getElevenLabsSignedUrl("pelayo")).resolves.toBe(
      "wss://signed.example/session"
    );

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("agent_id")).toMatch(/^agent_/);
    expect(url.toString()).not.toContain("server-secret");
    expect(init.headers).toEqual({ "xi-api-key": "server-secret" });
  });

  it.each([
    [401, "upstream_authentication_failed", 503],
    [403, "upstream_authentication_failed", 503],
    [429, "upstream_rate_limited", 503],
    [500, "upstream_unavailable", 503],
  ] as const)(
    "maps ElevenLabs %s without forwarding provider response bodies",
    async (providerStatus, code, status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response("provider detail that must not be forwarded", {
            status: providerStatus,
          })
        )
      );

      const error = await getElevenLabsSignedUrl("pelayo").catch(
        (caught: unknown) => caught
      );
      expect(error).toBeInstanceOf(ElevenLabsSignedSessionError);
      expect(error).toMatchObject({ code, status });
      expect(String(error)).not.toContain("provider detail");
    }
  );

  it("parses the signed URL and rejects a wss prefix without a hostname", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ signed_url: "wss://" }), { status: 200 })
      )
    );

    await expect(getElevenLabsSignedUrl("pelayo")).rejects.toMatchObject({
      code: "invalid_upstream_response",
      status: 503,
    });
  });

  it("checks and discards signed URLs for all five owned voice agents", async () => {
    const fingerprint = fingerprintElevenLabsApiKey("server-secret");
    vi.stubEnv("ELEVENLABS_API_KEY_FINGERPRINT", fingerprint);
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ signed_url: "wss://signed.example/session" }),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(probeElevenLabsVoiceAgents()).resolves.toEqual({
      provider: "ok",
      fingerprint,
      fingerprintMatches: true,
      agents: ELEVENLABS_VOICE_AGENT_KEYS,
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("attributes one aggregate probe failure to the agent that failed", async () => {
    const fingerprint = fingerprintElevenLabsApiKey("server-secret");
    vi.stubEnv("ELEVENLABS_API_KEY_FINGERPRINT", fingerprint);
    const logSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: URL) =>
        Promise.resolve(
          url.searchParams.get("agent_id") ===
            "agent_5901kg4wgebce0abca4ssyav3684"
            ? new Response("rejected", { status: 401 })
            : new Response(
                JSON.stringify({
                  signed_url: "wss://signed.example/session",
                }),
                { status: 200 }
              )
        )
      )
    );

    await expect(probeElevenLabsVoiceAgents()).rejects.toMatchObject({
      code: "upstream_authentication_failed",
    });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      "[ELEVENLABS_CREDENTIAL_REJECTED]",
      expect.objectContaining({ agent_key: "xander" })
    );
  });

  it("rejects booking identity drift before any provider request", async () => {
    vi.stubEnv("ELEVENLABS_BOOKING_AGENT_ID", "agent_wrong");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      probeElevenLabsVoiceAgents(["booking"])
    ).rejects.toMatchObject({
      code: "agent_identity_mismatch",
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles fetch network errors by throwing upstream_unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network timeout")));

    const error = await getElevenLabsSignedUrl("pelayo").catch(
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(ElevenLabsSignedSessionError);
    expect(error).toMatchObject({
      code: "upstream_unavailable",
      status: 503,
    });
  });

  it.each([
    ["missing signed_url field", { name: "Alice" }],
    ["signed_url is not a string", { signed_url: 123 }],
    ["signed_url does not start with wss://", { signed_url: "https://insecure.example" }],
    ["response JSON is invalid", "not-json"],
    ["response is null", null],
  ] as const)(
    "rejects %s from ElevenLabs API",
    async (_desc, payload) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            typeof payload === "string" || payload === null
              ? payload || ""
              : JSON.stringify(payload),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      );

      const error = await getElevenLabsSignedUrl("pelayo").catch(
        (caught: unknown) => caught
      );
      expect(error).toBeInstanceOf(ElevenLabsSignedSessionError);
      expect(error).toMatchObject({
        code: "invalid_upstream_response",
        status: 503,
      });
    }
  );
});
