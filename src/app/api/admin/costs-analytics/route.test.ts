import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

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
  formatForHogQL: vi.fn((isoString: string) => {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 19).replace("T", " ");
  }),
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
import { queryPostHog, formatForHogQL } from "@/lib/posthog-query";
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

  it("should include manual costs with unique service IDs alongside API costs", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    const manualCustomCost: ServiceCost = {
      serviceId: "custom-hosting",
      serviceName: "Custom Hosting",
      category: "infrastructure",
      costUsd: 15.0,
      costFormatted: "$15.00",
      source: "manual",
      billingPeriodStart: "2026-02-01",
      billingPeriodEnd: "2026-02-06",
    };

    vi.mocked(fetchAnthropicCosts).mockResolvedValue(mockAnthropicCost);
    vi.mocked(fetchTwilioCosts).mockResolvedValue(null);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(null);
    vi.mocked(fetchManualCosts).mockResolvedValue([manualCustomCost]);
    vi.mocked(generateRecurringCosts).mockReturnValue([]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should include both API cost and the unique manual cost
    expect(data.data.services).toHaveLength(2);
    const customHosting = data.data.services.find(
      (s: ServiceCost) => s.serviceId === "custom-hosting"
    );
    expect(customHosting).toBeDefined();
    expect(customHosting.costUsd).toBe(15.0);
    expect(customHosting.source).toBe("manual");
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

  it("should fall back to config agent IDs when no Paisaxe-named agents found via API", async () => {
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

    // Return agents that do NOT start with "Paisaxe" — this triggers the fallback
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            agents: [
              { agent_id: "agent_other_1", name: "Other Agent" },
              { agent_id: "agent_other_2", name: "Another Non-Paisaxe Agent" },
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
                // This agent_id matches the config fallback (pelayo)
                agent_id: "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
                start_time_unix_secs: Math.floor(new Date("2026-02-03").getTime() / 1000),
                call_duration_secs: 60,
              },
              {
                // This agent_id does NOT match any config ID
                agent_id: "agent_unknown_xyz",
                start_time_unix_secs: Math.floor(new Date("2026-02-04").getTime() / 1000),
                call_duration_secs: 300,
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
    // Should count 1 conversation (pelayo config ID match), not the unknown one
    expect(data.data.usageMetrics.voiceConversations).toBe(1);
    expect(data.data.usageMetrics.voiceMinutes).toBe(1);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should fall back to config agent IDs when agents API returns non-ok response", async () => {
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

    // Agents API returns non-ok (e.g. 500) — so paisaxeAgentIds stays empty, triggers fallback
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: false,
          status: 500,
        });
      }
      if (url.includes("/convai/conversations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conversations: [
              {
                agent_id: "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
                start_time_unix_secs: Math.floor(new Date("2026-02-03").getTime() / 1000),
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
    // Should match pelayo via config fallback
    expect(data.data.usageMetrics.voiceConversations).toBe(1);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should skip falsy agent IDs when building the config fallback set", async () => {
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

    // Simulate a config with a falsy agent ID entry (e.g. unset for a new
    // replication) to exercise the `if (id)` guard's false branch when
    // building the fallback ID set from ELEVENLABS_AGENT_IDS.
    vi.doMock("@/config/elevenlabs-agents", () => ({
      ELEVENLABS_API_BASE: "https://api.elevenlabs.io/v1",
      ELEVENLABS_AGENT_IDS: {
        pelayo: "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
        xander: "",
      },
    }));
    vi.resetModules();
    const { GET: GetWithMockedConfig } = await import("./route");

    // Agents API returns non-ok — so paisaxeAgentIds stays empty, triggers
    // the config fallback loop that includes the falsy `xander` entry.
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      if (url.includes("/convai/conversations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conversations: [
              {
                agent_id: "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
                start_time_unix_secs: Math.floor(new Date("2026-02-03").getTime() / 1000),
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
    const response = await GetWithMockedConfig(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.usageMetrics).toBeDefined();
    // pelayo (truthy) is added to the fallback set and matches the conversation
    expect(data.data.usageMetrics.voiceConversations).toBe(1);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.doUnmock("@/config/elevenlabs-agents");
    vi.resetModules();
  });

  it("should return undefined usageMetrics when outer catch is triggered in fetchUsageMetrics", async () => {
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

    // Set PostHog env vars so the if-branch at line 209 is entered
    vi.stubEnv("POSTHOG_PROJECT_ID", "test-project");
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phk_test");
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    // Make formatForHogQL throw — it's called at line 210 OUTSIDE the inner try,
    // so the error propagates to the outer catch (lines 325-327)
    vi.mocked(formatForHogQL).mockImplementation(() => {
      throw new Error("Unexpected formatting error");
    });

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?includeUsage=true&from=2026-02-01&to=2026-02-06"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // The outer catch returns undefined, so usageMetrics should be absent
    expect(data.data.usageMetrics).toBeUndefined();

    // Restore the default implementation for other tests
    vi.mocked(formatForHogQL).mockImplementation((isoString: string) => {
      const date = new Date(isoString);
      return date.toISOString().slice(0, 19).replace("T", " ");
    });
    vi.unstubAllEnvs();
  });

  it("should handle ElevenLabs conversations response not ok (line 285 branch)", async () => {
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

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            agents: [
              { agent_id: "agent_pelayo", name: "Paisaxe - Pelayo" },
            ],
          }),
        });
      }
      if (url.includes("/convai/conversations")) {
        // Return non-ok response for conversations
        return Promise.resolve({
          ok: false,
          status: 500,
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
    // Voice data should be 0 since conversations response was not ok
    expect(data.data.usageMetrics.voiceConversations).toBe(0);
    expect(data.data.usageMetrics.voiceMinutes).toBe(0);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should handle conversations with missing call_duration_secs (line 307 || 0)", async () => {
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

    const paisaxeAgentId = "agent_pelayo_123";
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            agents: [
              { agent_id: paisaxeAgentId, name: "Paisaxe - Pelayo" },
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
                // call_duration_secs is missing (undefined) — should default to 0
              },
              {
                agent_id: paisaxeAgentId,
                start_time_unix_secs: Math.floor(new Date("2026-02-04").getTime() / 1000),
                call_duration_secs: 0, // explicitly 0
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
    expect(data.data.usageMetrics.voiceConversations).toBe(2);
    expect(data.data.usageMetrics.voiceMinutes).toBe(0);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should filter conversations by date range (lines 298-300)", async () => {
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

    const paisaxeAgentId = "agent_pelayo_range";
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            agents: [
              { agent_id: paisaxeAgentId, name: "Paisaxe - Pelayo" },
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
                call_duration_secs: 60,
              },
              {
                // Outside date range — should be filtered out
                agent_id: paisaxeAgentId,
                start_time_unix_secs: Math.floor(new Date("2026-01-15").getTime() / 1000),
                call_duration_secs: 300,
              },
              {
                // Missing start_time — start_time_unix_secs defaults to 0, outside range
                agent_id: paisaxeAgentId,
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
    // Only the first conversation is within the date range
    expect(data.data.usageMetrics.voiceConversations).toBe(1);
    expect(data.data.usageMetrics.voiceMinutes).toBe(1);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should handle PostHog results with empty/null values (line 232 || 0)", async () => {
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

    vi.stubEnv("POSTHOG_PROJECT_ID", "test-project");
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phk_test");
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    // Return results with empty arrays (no data)
    vi.mocked(queryPostHog)
      .mockResolvedValueOnce({ results: [[]] })    // visitors — empty inner array
      .mockResolvedValueOnce({ results: [] })       // chats — empty results
      .mockResolvedValueOnce({ results: [[null]] }); // events — null value

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?includeUsage=true&from=2026-02-01&to=2026-02-06"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.usageMetrics).toBeDefined();
    expect(data.data.usageMetrics.visitors).toBe(0);
    expect(data.data.usageMetrics.chatConversations).toBe(0);
    expect(data.data.usageMetrics.posthogEvents).toBe(0);

    vi.unstubAllEnvs();
  });

  it("should skip recurring costs when service ID already covered by API or manual cost (line 91 else)", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "user-1",
    });

    // Anthropic is returned from API
    vi.mocked(fetchAnthropicCosts).mockResolvedValue(mockAnthropicCost);
    vi.mocked(fetchTwilioCosts).mockResolvedValue(null);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(null);
    vi.mocked(fetchManualCosts).mockResolvedValue([]);
    // Recurring costs include one with same serviceId as the API cost ("anthropic")
    const recurringAnthropicCost: ServiceCost = {
      serviceId: "anthropic",
      serviceName: "Anthropic (recurring)",
      category: "ai",
      costUsd: 50.0,
      costFormatted: "$50.00",
      source: "recurring",
      billingPeriodStart: "2026-02-01",
      billingPeriodEnd: "2026-02-06",
    };
    vi.mocked(generateRecurringCosts).mockReturnValue([recurringAnthropicCost]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should only have the API anthropic cost, not the duplicate recurring one
    expect(data.data.services).toHaveLength(1);
    expect(data.data.services[0].source).toBe("api");
    expect(data.data.services[0].costUsd).toBe(12.5);
  });

  it("should handle ElevenLabs agents response with missing agents array (line 257 fallback)", async () => {
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

    // Return response where agents key is missing entirely (triggers || [])
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}), // no "agents" key at all
        });
      }
      if (url.includes("/convai/conversations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            conversations: [
              {
                agent_id: "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
                start_time_unix_secs: Math.floor(new Date("2026-02-03").getTime() / 1000),
                call_duration_secs: 60,
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
    // Agents array was missing, fallback to config IDs, should still match pelayo
    expect(data.data.usageMetrics.voiceConversations).toBe(1);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should handle conversations response with missing conversations array (line 291 fallback)", async () => {
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

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            agents: [
              { agent_id: "agent_pelayo", name: "Paisaxe - Pelayo" },
            ],
          }),
        });
      }
      if (url.includes("/convai/conversations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({}), // no "conversations" key
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
    // Conversations array was missing, should default to []
    expect(data.data.usageMetrics.voiceConversations).toBe(0);
    expect(data.data.usageMetrics.voiceMinutes).toBe(0);

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("should handle conversations with missing agent_id (line 300 || fallback)", async () => {
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

    const paisaxeAgentId = "agent_pelayo_missing_id";
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            agents: [
              { agent_id: paisaxeAgentId, name: "Paisaxe - Pelayo" },
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
                // agent_id is missing/undefined — triggers || "" fallback on line 300
                start_time_unix_secs: Math.floor(new Date("2026-02-03").getTime() / 1000),
                call_duration_secs: 60,
              },
              {
                agent_id: paisaxeAgentId,
                start_time_unix_secs: Math.floor(new Date("2026-02-03").getTime() / 1000),
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
    // Only the conversation with a valid agent_id should match
    expect(data.data.usageMetrics.voiceConversations).toBe(1);
    expect(data.data.usageMetrics.voiceMinutes).toBe(2);

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

  // -----------------------------------------------------------------------
  // PE-L2: server-side external API fetches without timeouts (#816)
  // -----------------------------------------------------------------------

  it("PE-L2: includes an AbortSignal timeout on ElevenLabs usage-metrics fetches (#816)", async () => {
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

    const capturedInits: (RequestInit | undefined)[] = [];
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedInits.push(init);
      return Promise.resolve({
        ok: true,
        json: async () => ({ agents: [], conversations: [] }),
      });
    }) as unknown as typeof fetch;

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?includeUsage=true&from=2026-02-01&to=2026-02-06"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(capturedInits.length).toBeGreaterThanOrEqual(2);
    for (const init of capturedInits) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("PE-L2: logs a distinct timed_out marker when the ElevenLabs usage fetch aborts (#816)", async () => {
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

    const timeoutError = new DOMException("The operation was aborted", "TimeoutError");
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(timeoutError) as unknown as typeof fetch;

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?includeUsage=true&from=2026-02-01&to=2026-02-06"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      "[ELEVENLABS_PROVIDER_UNAVAILABLE]",
      expect.objectContaining({ failure_class: "upstream_timeout" })
    );

    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("stops usage collection after one request and one canonical event on ElevenLabs 401", async () => {
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
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "http://localhost/api/admin/costs-analytics?includeUsage=true&from=2026-02-01&to=2026-02-06"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "[ELEVENLABS_CREDENTIAL_REJECTED]",
      expect.objectContaining({ provider_status: 401 })
    );
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

  // -----------------------------------------------------------------------
  // SE-M3 / DO-H3: logger migration — uses structured logger, not console
  // -----------------------------------------------------------------------

  it("should use logger.error (not console.error) on unhandled GET error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "user-1" });
    vi.mocked(fetchAnthropicCosts).mockRejectedValue(new Error("unexpected"));
    vi.mocked(fetchTwilioCosts).mockResolvedValue(null);
    vi.mocked(fetchElevenLabsCosts).mockResolvedValue(null);
    vi.mocked(fetchManualCosts).mockResolvedValue([]);
    vi.mocked(fetchAnthropicCostsByDay).mockResolvedValue([]);
    vi.mocked(generateRecurringCosts).mockReturnValue([]);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new NextRequest("http://localhost/api/admin/costs-analytics");
    const response = await GET(request);

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
