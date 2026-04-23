import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { GET, POST } from "./route";
import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("fail stale translations cron", () => {
  const mockRpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("WEBHOOK_SECRET", "webhook-secret");

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") {
        return Promise.resolve({ data: true, error: null });
      }
      if (fn === "fail_stale_story_translations") {
        return Promise.resolve({ data: 2, error: null });
      }
      if (fn === "pg_advisory_unlock") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>);

    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "admin-123",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("rejects unauthorized GET requests", async () => {
    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations");

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("processes authorized GET requests and passes the expected cutoff", async () => {
    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: {
        authorization: "Bearer cron-secret",
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe("ok");
    expect(json.failed_count).toBe(2);
    expect(mockRpc).toHaveBeenCalledWith("fail_stale_story_translations", {
      p_cutoff: "2026-04-23T11:30:00.000Z",
    });
  });

  it("allows webhook-secret POST requests without admin auth", async () => {
    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      method: "POST",
      headers: {
        "x-webhook-secret": "webhook-secret",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(validateAdminAuth).not.toHaveBeenCalled();
  });

  it("falls back to admin auth for POST when webhook secret is missing", async () => {
    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(validateAdminAuth).toHaveBeenCalled();
  });

  it("returns 409 when the advisory lock is already held", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: {
        authorization: "Bearer cron-secret",
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toEqual({ status: "skipped", reason: "lock_held" });
  });

  it("returns 500 when the stale-translation RPC fails", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "pg_try_advisory_lock") {
        return Promise.resolve({ data: true, error: null });
      }
      if (fn === "fail_stale_story_translations") {
        return Promise.resolve({
          data: null,
          error: { message: "rpc failed" },
        });
      }
      if (fn === "pg_advisory_unlock") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: {
        authorization: "Bearer cron-secret",
      },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to fail stale translations");
  });

  it("always releases the advisory lock", async () => {
    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: {
        authorization: "Bearer cron-secret",
      },
    });

    await GET(request);

    expect(mockRpc).toHaveBeenCalledWith("pg_advisory_unlock", {
      lockid: 1006,
    });
  });
});
