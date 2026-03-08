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
  formatForHogQL: (isoString: string) => {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 19).replace("T", " ");
  },
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
import { queryPostHog } from "@/lib/posthog-query";
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

  it("should include ElevenLabs cost when returned", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const mockElevenLabsCost: ServiceCost = {
      serviceId: "elevenlabs",
      serviceName: "ElevenLabs",
      category: "ai",
      costUsd: 5.0,
      costFormatted: "$5.00",
      source: "api",
      billingPeriodStart: "2026-02-01",
      billingPeriodEnd: "2026-02-06",
    };

    vi.mocked(fetchAnthropicCosts).mockResolvedValue(mockAnthropicCost);
    vi.mocked(fetchTwilioCosts).mockResolvedValue(mockTwilioCost);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(mockElevenLabsCost);
    vi.mocked(fetchManualCosts).mockResolvedValue([]);
    vi.mocked(generateRecurringCosts).mockReturnValue([]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.services).toHaveLength(3);
    const elevenLabs = data.data.services.find(
      (s: ServiceCost) => s.serviceId === "elevenlabs"
    );
    expect(elevenLabs).toBeDefined();
    expect(elevenLabs.costUsd).toBe(5.0);
    expect(elevenLabs.source).toBe("api");
    expect(data.data.summary.totalMonthlyUsd).toBeCloseTo(20.7, 1);
  });

  it("should add recurring costs for uncovered services", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const recurringVercelCost: ServiceCost = {
      serviceId: "vercel",
      serviceName: "Vercel",
      category: "infrastructure",
      costUsd: 20.0,
      costFormatted: "$20.00",
      source: "recurring",
      billingPeriodStart: "2026-02-01",
      billingPeriodEnd: "2026-02-06",
    };

    vi.mocked(fetchAnthropicCosts).mockResolvedValue(mockAnthropicCost);
    vi.mocked(fetchTwilioCosts).mockResolvedValue(null);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(null);
    vi.mocked(fetchManualCosts).mockResolvedValue([]);
    vi.mocked(generateRecurringCosts).mockReturnValue([recurringVercelCost]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.services).toHaveLength(2);
    const vercel = data.data.services.find(
      (s: ServiceCost) => s.serviceId === "vercel"
    );
    expect(vercel).toBeDefined();
    expect(vercel.costUsd).toBe(20.0);
    expect(vercel.source).toBe("recurring");
    expect(data.data.summary.totalMonthlyUsd).toBeCloseTo(32.5, 1);
  });

  it("should include usageMetrics when includeUsage=true", async () => {
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

    // Stub env vars required by fetchUsageMetrics
    vi.stubEnv("POSTHOG_PROJECT_ID", "test-project");
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phk_test");
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-test");

    // Mock PostHog queries (visitors, chats, events)
    vi.mocked(queryPostHog)
      .mockResolvedValueOnce({ results: [[42]] })   // visitors
      .mockResolvedValueOnce({ results: [[10]] })   // chat conversations
      .mockResolvedValueOnce({ results: [[500]] }); // total events

    // Mock global fetch for ElevenLabs agents + conversations API
    const paisaxeAgentId = "agent_1201kgqhsdzxfkk9x7m1bjaew9mv"; // pelayo
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            agents: [
              { agent_id: paisaxeAgentId, name: "Paisaxe - Pelayo (Visitor Guide)" },
            ],
          }),
        });
      }
      if (url.includes("/convai/conversations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conversations: [
              {
                agent_id: paisaxeAgentId,
                start_time_unix_secs: Math.floor(new Date("2026-02-03").getTime() / 1000),
                call_duration_secs: 180,
              },
              {
                agent_id: paisaxeAgentId,
                start_time_unix_secs: Math.floor(new Date("2026-02-04").getTime() / 1000),
                call_duration_secs: 120,
              },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?includeUsage=true&from=2026-02-01&to=2026-02-06"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.usageMetrics).toBeDefined();
    expect(data.data.usageMetrics.visitors).toBe(42);
    expect(data.data.usageMetrics.chatConversations).toBe(10);
    expect(data.data.usageMetrics.posthogEvents).toBe(500);
    expect(data.data.usageMetrics.voiceConversations).toBe(2);
    expect(data.data.usageMetrics.voiceMinutes).toBeGreaterThan(0);
    expect(data.data.usageMetrics.periodDays).toBeGreaterThanOrEqual(1);

    // Verify PostHog was called 3 times
    expect(vi.mocked(queryPostHog)).toHaveBeenCalledTimes(3);

    // Verify ElevenLabs fetch was called for both agents and conversations
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/convai/agents"),
      expect.objectContaining({
        headers: { "xi-api-key": "xi-test" },
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/convai/conversations"),
      expect.objectContaining({
        headers: { "xi-api-key": "xi-test" },
      })
    );

    // Restore original fetch
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should gracefully handle ElevenLabs fetch failure in usage metrics", async () => {
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

    vi.stubEnv("POSTHOG_PROJECT_ID", "");
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-test");

    // Make ElevenLabs fetch throw an error
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("ElevenLabs connection failed")) as unknown as typeof fetch;

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?includeUsage=true&from=2026-02-01&to=2026-02-06"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Usage metrics should still be returned (with 0 voice data) since the catch is graceful
    expect(data.data.usageMetrics).toBeDefined();
    expect(data.data.usageMetrics.voiceConversations).toBe(0);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should return undefined usageMetrics when outer fetchUsageMetrics fails", async () => {
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

    // Stub env vars with getters that throw to trigger outer catch
    vi.stubEnv("POSTHOG_PROJECT_ID", "test-project");
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phk_test");
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-test");

    // Make PostHog query throw to test the inner PostHog catch
    vi.mocked(queryPostHog).mockRejectedValue(new Error("PostHog connection failed"));

    // Also make ElevenLabs fetch throw
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Network down")) as unknown as typeof fetch;

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?includeUsage=true&from=2026-02-01&to=2026-02-06"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // The inner catches are graceful, so usageMetrics should still be defined with zeros
    expect(data.data.usageMetrics).toBeDefined();
    expect(data.data.usageMetrics.visitors).toBe(0);
    expect(data.data.usageMetrics.voiceConversations).toBe(0);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should only count voice minutes from Paisaxe agents, not all account conversations", async () => {
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

    vi.stubEnv("POSTHOG_PROJECT_ID", "");
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
    vi.stubEnv("ELEVENLABS_API_KEY", "xi-test");

    const paisaxeId = "agent_1201kgqhsdzxfkk9x7m1bjaew9mv"; // pelayo
    const nonPaisaxeId = "agent_other_project_12345";

    const originalFetch2 = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            agents: [
              { agent_id: paisaxeId, name: "Paisaxe - Pelayo (Visitor Guide)" },
              { agent_id: nonPaisaxeId, name: "Other Project Agent" },
            ],
          }),
        });
      }
      if (url.includes("/convai/conversations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conversations: [
              {
                agent_id: paisaxeId,
                start_time_unix_secs: Math.floor(new Date("2026-02-03").getTime() / 1000),
                call_duration_secs: 180, // 3 min - Paisaxe agent
              },
              {
                agent_id: nonPaisaxeId,
                start_time_unix_secs: Math.floor(new Date("2026-02-04").getTime() / 1000),
                call_duration_secs: 600, // 10 min - NOT Paisaxe agent
              },
              {
                agent_id: paisaxeId,
                start_time_unix_secs: Math.floor(new Date("2026-02-05").getTime() / 1000),
                call_duration_secs: 120, // 2 min - Paisaxe agent
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    }) as unknown as typeof fetch;

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?includeUsage=true&from=2026-02-01&to=2026-02-06"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.usageMetrics).toBeDefined();
    // Should only count Paisaxe agent conversations (3 + 2 = 5 min)
    expect(data.data.usageMetrics.voiceConversations).toBe(2);
    expect(data.data.usageMetrics.voiceMinutes).toBe(5);

    global.fetch = originalFetch2;
    vi.unstubAllEnvs();
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

  it("should return 500 when createManualCost throws an exception", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    vi.mocked(createManualCost).mockRejectedValue(
      new Error("Database connection lost")
    );

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
