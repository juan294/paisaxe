// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  getSupabaseClient: vi.fn(),
  getElevenLabsSignedUrl: vi.fn(),
}));

vi.mock("@/lib/supabase-auth", () => ({
  getUserFromRequest: mocks.getUserFromRequest,
  getSupabaseClient: mocks.getSupabaseClient,
}));

vi.mock("@/lib/elevenlabs-signed-session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/elevenlabs-signed-session")>();
  return {
    ...actual,
    getElevenLabsSignedUrl: mocks.getElevenLabsSignedUrl,
  };
});

import { POST } from "./route";
import { ElevenLabsSignedSessionError } from "@/lib/elevenlabs-signed-session";

function request(body: unknown = { agentKey: "pelayo" }) {
  return new NextRequest("http://localhost/api/voice-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/voice-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserFromRequest.mockResolvedValue({ id: "visitor-1" });
    mocks.getSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gt: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "purchase-1" },
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })),
      })),
    });
    mocks.getElevenLabsSignedUrl.mockResolvedValue(
      "wss://signed.example/visitor"
    );
  });

  it("rejects unauthenticated visitors", async () => {
    mocks.getUserFromRequest.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.getElevenLabsSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects visitors without current paid voice access", async () => {
    mocks.getSupabaseClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gt: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                })),
              })),
            })),
          })),
        })),
      })),
    });

    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.getElevenLabsSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects arbitrary and admin agent keys", async () => {
    for (const agentKey of ["agent_attacker", "penny"]) {
      const response = await POST(request({ agentKey }));
      expect(response.status).toBe(400);
    }
    expect(mocks.getElevenLabsSignedUrl).not.toHaveBeenCalled();
  });

  it("returns a signed Pelayo session without returning an agent ID", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      signedUrl: "wss://signed.example/visitor",
    });
    expect(mocks.getElevenLabsSignedUrl).toHaveBeenCalledWith("pelayo");
  });

  it.each([
    ["missing_api_key", 503],
    ["upstream_authentication_failed", 502],
    ["upstream_rate_limited", 503],
    ["upstream_unavailable", 502],
  ] as const)("maps %s provider failures to %s", async (code, status) => {
    mocks.getElevenLabsSignedUrl.mockRejectedValue(
      new ElevenLabsSignedSessionError(code, status)
    );
    const response = await POST(request());
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: code });
  });
});
