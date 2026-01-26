import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("crypto", () => ({
  default: {
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => "abcdef1234567890abcdef1234567890"),
      })),
    })),
  },
}));

import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rate-limit";

describe("POST /api/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should insert event and return 201", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60000,
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const request = new NextRequest("http://localhost:3000/api/analytics", {
      method: "POST",
      body: JSON.stringify({
        eventName: "page_view",
        featureFlag: "contextual_prompts",
        sessionId: "session-123",
        metadata: { page: "/home" },
      }),
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "user-agent": "Mozilla/5.0",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("analytics_events");
    expect(mockInsert).toHaveBeenCalledWith({
      event_name: "page_view",
      feature_flag: "contextual_prompts",
      session_id: "session-123",
      metadata: { page: "/home" },
      user_agent: "Mozilla/5.0",
      ip_hash: "abcdef1234567890",
    });
  });

  it("should return 400 if eventName is missing", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60000,
    });

    const request = new NextRequest("http://localhost:3000/api/analytics", {
      method: "POST",
      body: JSON.stringify({
        featureFlag: "contextual_prompts",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("eventName is required");
  });

  it("should return 400 if eventName is not a string", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60000,
    });

    const request = new NextRequest("http://localhost:3000/api/analytics", {
      method: "POST",
      body: JSON.stringify({
        eventName: 123,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("eventName is required");
  });

  it("should return 429 when rate limited", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      limit: 60,
      remaining: 0,
      resetAt: Date.now() + 30000,
      retryAfter: 30,
    });

    const request = new NextRequest("http://localhost:3000/api/analytics", {
      method: "POST",
      body: JSON.stringify({
        eventName: "page_view",
      }),
      headers: {
        "x-forwarded-for": "192.168.1.1",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe("Too many requests");
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("should return 500 when database insert fails", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60000,
    });

    const mockInsert = vi.fn().mockResolvedValue({
      error: { message: "Insert failed" },
    });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const request = new NextRequest("http://localhost:3000/api/analytics", {
      method: "POST",
      body: JSON.stringify({
        eventName: "page_view",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to record event");
  });

  it("should handle missing optional fields gracefully", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60000,
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const request = new NextRequest("http://localhost:3000/api/analytics", {
      method: "POST",
      body: JSON.stringify({
        eventName: "page_view",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_name: "page_view",
        feature_flag: null,
        session_id: null,
        metadata: {},
      })
    );
  });

  it("should use ip from x-forwarded-for header for rate limiting", async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60000,
    });

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    vi.mocked(supabase.from).mockImplementation(mockFrom);

    const request = new NextRequest("http://localhost:3000/api/analytics", {
      method: "POST",
      body: JSON.stringify({ eventName: "click" }),
      headers: {
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      },
    });

    await POST(request);

    expect(checkRateLimit).toHaveBeenCalledWith(
      "analytics:10.0.0.1",
      expect.objectContaining({
        windowMs: 60_000,
        maxRequests: 60,
      })
    );
  });

  it("should return 500 on unexpected error", async () => {
    vi.mocked(checkRateLimit).mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const request = new NextRequest("http://localhost:3000/api/analytics", {
      method: "POST",
      body: JSON.stringify({ eventName: "page_view" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
