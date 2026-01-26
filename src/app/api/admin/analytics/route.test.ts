import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
    });

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("should return analytics summary with totalEvents, totalSessions, featureBreakdown", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const mockEvents = [
      { feature_flag: "contextual_prompts", session_id: "sess-1" },
      { feature_flag: "contextual_prompts", session_id: "sess-2" },
      { feature_flag: "related_stories", session_id: "sess-1" },
      { feature_flag: null, session_id: "sess-3" },
    ];

    // Mock for the count query: .from().select().gte().lte()
    const mockCountLte = vi.fn().mockResolvedValue({ count: 42, error: null });
    const mockCountGte = vi.fn().mockReturnValue({ lte: mockCountLte });
    const mockCountSelect = vi.fn().mockReturnValue({ gte: mockCountGte });

    // Mock for the events query: .from().select().gte().lte()
    const mockEventsLte = vi.fn().mockResolvedValue({ data: mockEvents, error: null });
    const mockEventsGte = vi.fn().mockReturnValue({ lte: mockEventsLte });
    const mockEventsSelect = vi.fn().mockReturnValue({ gte: mockEventsGte });

    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockEventsSelect };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary.totalEvents).toBe(42);
    expect(data.data.summary.totalSessions).toBe(3);
    expect(data.data.summary.featureBreakdown).toHaveLength(2);

    const cpBreakdown = data.data.summary.featureBreakdown.find(
      (f: { featureFlag: string }) => f.featureFlag === "contextual_prompts"
    );
    expect(cpBreakdown).toBeDefined();
    expect(cpBreakdown.eventCount).toBe(2);
    expect(cpBreakdown.uniqueSessions).toBe(2);

    const rsBreakdown = data.data.summary.featureBreakdown.find(
      (f: { featureFlag: string }) => f.featureFlag === "related_stories"
    );
    expect(rsBreakdown).toBeDefined();
    expect(rsBreakdown.eventCount).toBe(1);
    expect(rsBreakdown.uniqueSessions).toBe(1);

    expect(data.data.dateRange).toBeDefined();
    expect(data.data.dateRange.from).toBeDefined();
    expect(data.data.dateRange.to).toBeDefined();
  });

  it("should accept from/to query params", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const fromDate = "2025-01-01T00:00:00Z";
    const toDate = "2025-01-31T23:59:59Z";

    const mockCountLte = vi.fn().mockResolvedValue({ count: 10, error: null });
    const mockCountGte = vi.fn().mockReturnValue({ lte: mockCountLte });
    const mockCountSelect = vi.fn().mockReturnValue({ gte: mockCountGte });

    const mockEventsLte = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEventsGte = vi.fn().mockReturnValue({ lte: mockEventsLte });
    const mockEventsSelect = vi.fn().mockReturnValue({ gte: mockEventsGte });

    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockEventsSelect };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest(
      `http://localhost:3000/api/admin/analytics?from=${fromDate}&to=${toDate}`
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.dateRange.from).toBe(fromDate);
    expect(data.data.dateRange.to).toBe(toDate);
    expect(mockCountGte).toHaveBeenCalledWith("created_at", fromDate);
    expect(mockCountLte).toHaveBeenCalledWith("created_at", toDate);
    expect(mockEventsGte).toHaveBeenCalledWith("created_at", fromDate);
    expect(mockEventsLte).toHaveBeenCalledWith("created_at", toDate);
  });

  it("should return 500 when count query fails", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const mockCountLte = vi.fn().mockResolvedValue({
      count: null,
      error: { message: "Count failed" },
    });
    const mockCountGte = vi.fn().mockReturnValue({ lte: mockCountLte });
    const mockCountSelect = vi.fn().mockReturnValue({ gte: mockCountGte });

    const mockFrom = vi.fn().mockReturnValue({ select: mockCountSelect });
    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch analytics");
  });

  it("should return 500 when events query fails", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const mockCountLte = vi.fn().mockResolvedValue({ count: 5, error: null });
    const mockCountGte = vi.fn().mockReturnValue({ lte: mockCountLte });
    const mockCountSelect = vi.fn().mockReturnValue({ gte: mockCountGte });

    const mockEventsLte = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Events query failed" },
    });
    const mockEventsGte = vi.fn().mockReturnValue({ lte: mockEventsLte });
    const mockEventsSelect = vi.fn().mockReturnValue({ gte: mockEventsGte });

    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockEventsSelect };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch analytics");
  });

  it("should return 500 on unexpected error", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("should handle empty events gracefully", async () => {
    vi.mocked(validateAdminAuth).mockReturnValue({ valid: true });

    const mockCountLte = vi.fn().mockResolvedValue({ count: 0, error: null });
    const mockCountGte = vi.fn().mockReturnValue({ lte: mockCountLte });
    const mockCountSelect = vi.fn().mockReturnValue({ gte: mockCountGte });

    const mockEventsLte = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEventsGte = vi.fn().mockReturnValue({ lte: mockEventsLte });
    const mockEventsSelect = vi.fn().mockReturnValue({ gte: mockEventsGte });

    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { select: mockCountSelect };
      }
      return { select: mockEventsSelect };
    });

    vi.mocked(createAdminClient).mockReturnValue({ from: mockFrom } as never);

    const request = new NextRequest("http://localhost:3000/api/admin/analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary.totalEvents).toBe(0);
    expect(data.data.summary.totalSessions).toBe(0);
    expect(data.data.summary.featureBreakdown).toEqual([]);
  });
});
