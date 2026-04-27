import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyVercelCron: vi.fn(),
  verifyWebhookSecret: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase";
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
