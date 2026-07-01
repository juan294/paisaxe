import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

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

vi.mock("@/lib/cron-auth", () => ({
  verifyVercelCron: vi.fn(),
  verifyWebhookSecret: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase-admin";
import { validateAdminAuth } from "@/lib/admin-auth";
import { verifyVercelCron, verifyWebhookSecret } from "@/lib/cron-auth";

const mockRpc = vi.fn();

describe("GET /api/cron/fail-stale-bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>);
    mockRpc.mockResolvedValue({ data: 0, error: null });
  });

  it("returns 401 when Vercel-Cron header is missing", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(false);

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "GET",
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it("calls fail_stale_initiating_bookings RPC with p_stale_minutes=5", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    mockRpc.mockResolvedValue({ data: 0, error: null });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(mockRpc).toHaveBeenCalledWith("fail_stale_initiating_bookings", {
      p_stale_minutes: 5,
    });
  });

  it("returns failed_count from RPC response", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    mockRpc.mockResolvedValue({ data: 3, error: null });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(data.failed_count).toBe(3);
  });

  it("returns 500 when RPC fails", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    mockRpc.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "GET",
    });

    const response = await GET(request);
    expect(response.status).toBe(500);
  });

  it("falls back to failed_count=0 when RPC data is not a number (line 42 else branch)", async () => {
    vi.mocked(verifyVercelCron).mockReturnValue(true);
    // RPC succeeded (no error) but returned a non-numeric payload — exercises the
    // `typeof data === "number" ? data : 0` else branch.
    mockRpc.mockResolvedValue({ data: null, error: null });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.failed_count).toBe(0);
  });
});

describe("POST /api/cron/fail-stale-bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>);
    mockRpc.mockResolvedValue({ data: 0, error: null });
  });

  it("accepts requests with valid webhook secret", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(true);

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "POST",
      headers: { "x-webhook-secret": "test-secret" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
  });

  it("accepts authenticated admin requests without webhook secret", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  // BE-M1: When webhook secret is missing/wrong but admin auth succeeds, emit a warn
  it("BE-M1: emits [CRON_AUTH_FALLBACK] warn when falling back from webhook secret to admin auth", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "admin-user",
    });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "POST",
    });

    await POST(request);

    expect(logger.warn).toHaveBeenCalledWith(
      "[CRON_AUTH_FALLBACK]",
      expect.objectContaining({
        source: "webhook",
        fellBackTo: "admin_auth",
      })
    );
  });

  it("returns 401 when neither webhook secret nor admin auth is valid", async () => {
    vi.mocked(verifyWebhookSecret).mockReturnValue(false);
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "POST",
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});

describe("CRON_SUCCESS/CRON_FAILURE telemetry — fail-stale-bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: mockRpc,
    } as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(verifyVercelCron).mockReturnValue(true);
  });

  it("emits [CRON_SUCCESS] with job name and duration_ms on success", async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "GET",
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    expect(logger.info).toHaveBeenCalledWith(
      "[CRON_SUCCESS]",
      expect.objectContaining({
        job: "fail-stale-bookings",
        duration_ms: expect.any(Number),
      })
    );
  });

  it("emits [CRON_FAILURE] with job name and error message when RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "DB connection lost" } });

    const request = new NextRequest("http://localhost/api/cron/fail-stale-bookings", {
      method: "GET",
    });

    const response = await GET(request);
    expect(response.status).toBe(500);

    expect(logger.error).toHaveBeenCalledWith(
      "[CRON_FAILURE]",
      expect.objectContaining({
        job: "fail-stale-bookings",
        error: expect.stringContaining("DB connection lost"),
      })
    );
  });
});
