// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  validateAdminAuth: vi.fn(),
  getElevenLabsSignedUrl: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: mocks.validateAdminAuth,
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

function request(agentKey: string) {
  return new NextRequest("http://localhost/api/admin/voice-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentKey }),
  });
}

describe("POST /api/admin/voice-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateAdminAuth.mockResolvedValue({
      valid: true,
      userId: "admin-1",
    });
    mocks.getElevenLabsSignedUrl.mockResolvedValue(
      "wss://signed.example/admin"
    );
  });

  it("returns the repository admin auth response unchanged", async () => {
    mocks.validateAdminAuth.mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    });
    const response = await POST(request("penny"));
    expect(response.status).toBe(403);
    expect(mocks.getElevenLabsSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects visitor, booking, and arbitrary agent keys", async () => {
    for (const agentKey of ["pelayo", "booking", "agent_attacker"]) {
      const response = await POST(request(agentKey));
      expect(response.status).toBe(400);
    }
    expect(mocks.getElevenLabsSignedUrl).not.toHaveBeenCalled();
  });

  it.each(["penny", "iris", "xander"])(
    "returns a signed session for allowlisted admin agent %s",
    async (agentKey) => {
      const response = await POST(request(agentKey));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        signedUrl: "wss://signed.example/admin",
      });
      expect(mocks.getElevenLabsSignedUrl).toHaveBeenCalledWith(agentKey);
    }
  );

  it("returns a sanitized provider failure", async () => {
    mocks.getElevenLabsSignedUrl.mockRejectedValue(
      new ElevenLabsSignedSessionError("upstream_rate_limited", 503)
    );
    const response = await POST(request("penny"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "upstream_rate_limited",
    });
  });
});
