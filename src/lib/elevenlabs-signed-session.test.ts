import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ElevenLabsSignedSessionError,
  getElevenLabsSignedUrl,
  isAdminVoiceAgentKey,
  isVisitorVoiceAgentKey,
} from "./elevenlabs-signed-session";

describe("ElevenLabs signed sessions", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.stubEnv("ELEVENLABS_API_KEY", "server-secret");
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
    [401, "upstream_authentication_failed", 502],
    [403, "upstream_authentication_failed", 502],
    [429, "upstream_rate_limited", 503],
    [500, "upstream_unavailable", 502],
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

  it("handles fetch network errors by throwing upstream_unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network timeout")));

    const error = await getElevenLabsSignedUrl("pelayo").catch(
      (caught: unknown) => caught
    );
    expect(error).toBeInstanceOf(ElevenLabsSignedSessionError);
    expect(error).toMatchObject({
      code: "upstream_unavailable",
      status: 502,
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
        status: 502,
      });
    }
  );
});
