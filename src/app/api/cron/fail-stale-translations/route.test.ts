import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { GET, POST } from "./route";
import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";

function mockDeadCountFrom(result: { count: number | null; error: { message: string } | null }) {
  return vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue(result),
      }),
    }),
  });
}

describe("fail stale translations cron", () => {
  const mockRpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("WEBHOOK_SECRET", "webhook-secret");

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "fail_stale_story_translations_locked") {
        return Promise.resolve({ data: 2, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
      from: mockDeadCountFrom({ count: 0, error: null }),
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
    expect(mockRpc).toHaveBeenCalledWith(
      "fail_stale_story_translations_locked",
      { p_cutoff: "2026-04-23T11:30:00.000Z" }
    );
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

  it("falls back to admin auth for POST when webhook secret is missing, given a valid CSRF token + Origin", async () => {
    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      method: "POST",
      headers: {
        origin: "https://paisaxe.es",
        "x-csrf-token": "test-csrf-token",
        cookie: "__csrf=test-csrf-token",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(validateAdminAuth).toHaveBeenCalled();
  });

  // BE-H5/SE-M1: the admin-cookie fallback is exactly the CSRF attack
  // surface — a hostile cross-site page riding a logged-in admin's session
  // cookie must NOT be able to trigger this job without a valid CSRF token
  // and Origin.
  it("BE-H5/SE-M1: rejects admin-session fallback requests with no CSRF token or Origin", async () => {
    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalledWith(
      "fail_stale_story_translations_locked",
      expect.anything()
    );
  });

  it("returns 401 for POST when webhook secret missing and admin auth invalid (line 73)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as unknown as Awaited<ReturnType<typeof validateAdminAuth>>);

    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 409 when the advisory lock is already held", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "fail_stale_story_translations_locked") {
        return Promise.resolve({ data: -1, error: null });
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

    expect(response.status).toBe(409);
    expect(json).toEqual({ status: "skipped", reason: "lock_held" });
  });

  it("returns 500 when the stale-translation RPC fails", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "fail_stale_story_translations_locked") {
        return Promise.resolve({
          data: null,
          error: { message: "rpc failed" },
        });
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

  it("falls back to failed_count=0 when RPC data is not a number (line 46 else branch)", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "fail_stale_story_translations_locked") {
        // RPC succeeded (no error) but returned a non-numeric, non-(-1) payload —
        // exercises the `typeof data === "number" ? data : 0` else branch.
        return Promise.resolve({ data: null, error: null });
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

    expect(response.status).toBe(200);
    expect(json.failed_count).toBe(0);
  });

  it("performs the work in a single RPC call (no separate lock/unlock round-trips)", async () => {
    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: {
        authorization: "Bearer cron-secret",
      },
    });

    await GET(request);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalledWith(
      "pg_try_advisory_lock",
      expect.anything()
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      "pg_advisory_unlock",
      expect.anything()
    );
  });

  it("includes dead_count in the response and does not warn when there are no dead jobs (BE-B1)", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
      from: mockDeadCountFrom({ count: 0, error: null }),
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: { authorization: "Bearer cron-secret" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.dead_count).toBe(0);
    expect(logger.warn).not.toHaveBeenCalledWith(
      "[CRON_FAIL_STALE_TRANSLATIONS_DEAD]",
      expect.anything()
    );
  });

  it("includes dead_count in the response and warns when translation jobs were retired to dead (BE-B1)", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
      from: mockDeadCountFrom({ count: 3, error: null }),
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: { authorization: "Bearer cron-secret" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.dead_count).toBe(3);
    expect(logger.warn).toHaveBeenCalledWith(
      "[CRON_FAIL_STALE_TRANSLATIONS_DEAD]",
      expect.objectContaining({ dead_count: 3 })
    );
  });

  it("logs an error but still returns 200 when the dead_count query itself fails (BE-B1)", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
      from: mockDeadCountFrom({ count: null, error: { message: "count query failed" } }),
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: { authorization: "Bearer cron-secret" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.dead_count).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "[CRON_FAIL_STALE_TRANSLATIONS_DEAD_COUNT_FAILED]",
      expect.objectContaining({ error: "count query failed" })
    );
  });
});

describe("CRON_SUCCESS/CRON_FAILURE telemetry — fail-stale-translations", () => {
  const mockRpc2 = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00.000Z"));
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("WEBHOOK_SECRET", "webhook-secret");

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc2,
      from: mockDeadCountFrom({ count: 0, error: null }),
    } as unknown as ReturnType<typeof createAdminClient>);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("emits [CRON_SUCCESS] with job name and duration_ms on success", async () => {
    mockRpc2.mockImplementation((fn: string) => {
      if (fn === "fail_stale_story_translations_locked") {
        return Promise.resolve({ data: 3, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: { authorization: "Bearer cron-secret" },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    expect(logger.info).toHaveBeenCalledWith(
      "[CRON_SUCCESS]",
      expect.objectContaining({
        job: "fail-stale-translations",
        duration_ms: expect.any(Number),
      })
    );
  });

  it("emits [CRON_FAILURE] with job name and error message when RPC fails", async () => {
    mockRpc2.mockImplementation((fn: string) => {
      if (fn === "fail_stale_story_translations_locked") {
        return Promise.resolve({ data: null, error: { message: "DB error" } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-translations", {
      headers: { authorization: "Bearer cron-secret" },
    });

    const response = await GET(request);
    expect(response.status).toBe(500);

    expect(logger.error).toHaveBeenCalledWith(
      "[CRON_FAILURE]",
      expect.objectContaining({
        job: "fail-stale-translations",
        error: expect.stringContaining("DB error"),
      })
    );
  });
});
