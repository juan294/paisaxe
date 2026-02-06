import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

vi.mock("@/lib/costs", () => ({
  fetchAnthropicCosts: vi.fn(),
  fetchAnthropicCostsByDay: vi.fn(),
  fetchTwilioCosts: vi.fn(),
  fetchElevenLabsCosts: vi.fn(),
  fetchManualCosts: vi.fn(),
  createManualCost: vi.fn(),
  generateRecurringCosts: vi.fn(),
}));

vi.mock("@/lib/posthog-query", () => ({
  queryPostHog: vi.fn(),
}));

import { validateAdminAuth } from "@/lib/admin-auth";
import {
  fetchAnthropicCosts,
  fetchAnthropicCostsByDay,
  fetchTwilioCosts,
  fetchElevenLabsCosts,
  fetchManualCosts,
  createManualCost,
  generateRecurringCosts,
} from "@/lib/costs";
import { GET, POST } from "./route";
import type { ServiceCost } from "@/types/costs-analytics";

const mockAnthropicCost: ServiceCost = {
  serviceId: "anthropic",
  serviceName: "Anthropic Claude",
  category: "ai",
  costUsd: 12.5,
  costFormatted: "$12.50",
  source: "api",
  billingPeriodStart: "2026-02-01",
  billingPeriodEnd: "2026-02-06",
};

const mockTwilioCost: ServiceCost = {
  serviceId: "twilio",
  serviceName: "Twilio",
  category: "communications",
  costUsd: 3.2,
  costFormatted: "$3.20",
  source: "api",
  billingPeriodStart: "2026-02-01",
  billingPeriodEnd: "2026-02-06",
};

describe("GET /api/admin/costs-analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("should aggregate costs from all services", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    vi.mocked(fetchAnthropicCosts).mockResolvedValue(mockAnthropicCost);
    vi.mocked(fetchTwilioCosts).mockResolvedValue(mockTwilioCost);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(null);
    vi.mocked(fetchManualCosts).mockResolvedValue([]);
    vi.mocked(generateRecurringCosts).mockReturnValue([]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([
      { date: "2026-02-01", costUsd: 5.0 },
      { date: "2026-02-02", costUsd: 7.5 },
    ]);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary.totalMonthlyUsd).toBeCloseTo(15.7, 1);
    expect(data.data.services).toHaveLength(2);
    // Should be sorted by cost descending
    expect(data.data.services[0].serviceId).toBe("anthropic");
    expect(data.data.services[1].serviceId).toBe("twilio");
    expect(data.data.summary.automatedServices).toBe(2);
    expect(data.data.costsByDay.length).toBeGreaterThan(0);
  });

  it("should handle all service fetches returning null", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    vi.mocked(fetchAnthropicCosts).mockResolvedValue(null);
    vi.mocked(fetchTwilioCosts).mockResolvedValue(null);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(null);
    vi.mocked(fetchManualCosts).mockResolvedValue([]);
    vi.mocked(generateRecurringCosts).mockReturnValue([]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary.totalMonthlyUsd).toBe(0);
    expect(data.data.services).toEqual([]);
  });

  it("should deduplicate manual costs when API data exists", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const manualAnthropicCost: ServiceCost = {
      serviceId: "anthropic",
      serviceName: "Anthropic (manual)",
      category: "ai",
      costUsd: 10.0,
      costFormatted: "$10.00",
      source: "manual",
      billingPeriodStart: "2026-02-01",
      billingPeriodEnd: "2026-02-06",
    };

    vi.mocked(fetchAnthropicCosts).mockResolvedValue(mockAnthropicCost);
    vi.mocked(fetchTwilioCosts).mockResolvedValue(null);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(null);
    vi.mocked(fetchManualCosts).mockResolvedValue([manualAnthropicCost]);
    vi.mocked(generateRecurringCosts).mockReturnValue([]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should only include API cost, not duplicated manual
    expect(data.data.services).toHaveLength(1);
    expect(data.data.services[0].source).toBe("api");
  });

  it("should accept from/to query params", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    vi.mocked(fetchAnthropicCosts).mockResolvedValue(null);
    vi.mocked(fetchTwilioCosts).mockResolvedValue(null);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(null);
    vi.mocked(fetchManualCosts).mockResolvedValue([]);
    vi.mocked(generateRecurringCosts).mockReturnValue([]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([]);

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?from=2026-01-01&to=2026-01-31"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.dateRange.from).toBe("2026-01-01");
    expect(data.data.dateRange.to).toBe("2026-01-31");
    expect(fetchAnthropicCosts).toHaveBeenCalledWith("2026-01-01", "2026-01-31");
  });

  it("should return 500 when an unexpected error occurs", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    vi.mocked(fetchAnthropicCosts).mockRejectedValue(new Error("Connection failed"));

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch costs data");
  });

  it("should set Cache-Control header", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    vi.mocked(fetchAnthropicCosts).mockResolvedValue(null);
    vi.mocked(fetchTwilioCosts).mockResolvedValue(null);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(null);
    vi.mocked(fetchManualCosts).mockResolvedValue([]);
    vi.mocked(generateRecurringCosts).mockReturnValue([]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);

    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=120, stale-while-revalidate=300"
    );
  });
});

describe("POST /api/admin/costs-analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }) as never,
    });

    const request = new NextRequest("http://localhost/api/admin/costs-analytics", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 400 when required fields are missing", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const request = new NextRequest("http://localhost/api/admin/costs-analytics", {
      method: "POST",
      body: JSON.stringify({ serviceId: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing required fields");
  });

  it("should create a manual cost entry", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockEntry = {
      id: "entry-1",
      serviceId: "custom-service",
      serviceName: "Custom Service",
      category: "infrastructure" as const,
      costUsd: 25.0,
      billingPeriodStart: "2026-02-01",
      billingPeriodEnd: "2026-02-28",
      notes: null,
      createdBy: "user-1",
      createdAt: "2026-02-06T10:00:00Z",
      updatedAt: "2026-02-06T10:00:00Z",
    };

    vi.mocked(createManualCost).mockResolvedValue(mockEntry);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics", {
      method: "POST",
      body: JSON.stringify({
        serviceId: "custom-service",
        serviceName: "Custom Service",
        category: "infrastructure",
        costUsd: 25.0,
        billingPeriodStart: "2026-02-01",
        billingPeriodEnd: "2026-02-28",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.id).toBe("entry-1");
    expect(createManualCost).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: "custom-service",
        costUsd: 25.0,
      }),
      "user-1"
    );
  });

  it("should return 500 when createManualCost returns null", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    vi.mocked(createManualCost).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics", {
      method: "POST",
      body: JSON.stringify({
        serviceId: "test",
        serviceName: "Test",
        category: "ai",
        costUsd: 10,
        billingPeriodStart: "2026-02-01",
        billingPeriodEnd: "2026-02-28",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create cost entry");
  });
});
