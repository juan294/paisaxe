import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true }),
}));

// Mock config
vi.mock("@/config/elevenlabs-agents", () => ({
  ELEVENLABS_API_BASE: "https://api.elevenlabs.io/v1",
  ELEVENLABS_AGENT_IDS: {
    xander: "agent_test_xander",
    iris: "agent_test_iris",
  },
}));

describe("ElevenLabs Analytics API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ELEVENLABS_API_KEY", "test-api-key");
  });

  it("returns 500 when API key is missing", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("ElevenLabs configuration missing");
  });

  it("returns empty data structure on API error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary.totalConversations).toBe(0);
    expect(data.data.conversationsByAgent).toEqual([]);
    expect(data.data.recentConversations).toEqual([]);
  });

  it("parses date range from query params", async () => {
    const capturedUrls: string[] = [];
    global.fetch = vi.fn().mockImplementation((url: string) => {
      capturedUrls.push(url);
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ agents: [] }),
        });
      }
      if (url.includes("/convai/analytics/live-count")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ conversations: [] }),
      });
    });

    const from = "2024-01-01T00:00:00.000Z";
    const to = "2024-01-31T23:59:59.000Z";
    const request = new NextRequest(
      `http://localhost/api/admin/elevenlabs-analytics?from=${from}&to=${to}`
    );
    await GET(request);

    const conversationsUrl = capturedUrls.find((u) => u.includes("/convai/conversations"));
    expect(conversationsUrl).toContain("start_time_unix_gte=");
    expect(conversationsUrl).toContain("start_time_unix_lte=");
  });

  it("aggregates conversations by agent", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              agents: [
                { agent_id: "agent_test_xander", name: "Paisaxe - Xander (X)" },
                { agent_id: "agent_test_iris", name: "Paisaxe - Iris (Instagram)" },
              ],
            }),
        });
      }
      if (url.includes("/convai/analytics/live-count")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            conversations: [
              {
                conversation_id: "conv1",
                agent_id: "agent_test_xander",
                status: "done",
                call_duration_secs: 60,
              },
              {
                conversation_id: "conv2",
                agent_id: "agent_test_xander",
                status: "done",
                call_duration_secs: 120,
              },
              {
                conversation_id: "conv3",
                agent_id: "agent_test_iris",
                status: "done",
                call_duration_secs: 90,
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.summary.totalConversations).toBe(3);
    expect(data.data.conversationsByAgent).toHaveLength(2);
    expect(data.data.conversationsByAgent[0].agentName).toBe("Xander");
    expect(data.data.conversationsByAgent[0].conversationCount).toBe(2);
  });

  it("calculates summary statistics correctly", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              agents: [{ agent_id: "agent1", name: "Paisaxe - Test Agent" }],
            }),
        });
      }
      if (url.includes("/convai/analytics/live-count")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            conversations: [
              {
                conversation_id: "conv1",
                agent_id: "agent1",
                status: "done",
                call_duration_secs: 60,
                analysis: { rating: 5 },
              },
              {
                conversation_id: "conv2",
                agent_id: "agent1",
                status: "done",
                call_duration_secs: 120,
                analysis: { rating: 3 },
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.summary.totalConversations).toBe(2);
    expect(data.data.summary.completedConversations).toBe(2);
    expect(data.data.summary.totalMinutesUsed).toBe(3); // 180 secs = 3 mins
    expect(data.data.summary.averageCallDuration).toBe(90); // 180 / 2
    expect(data.data.summary.averageRating).toBe(4); // (5+3) / 2
  });

  it("aggregates conversations by language", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              agents: [{ agent_id: "agent1", name: "Paisaxe - Test Agent" }],
            }),
        });
      }
      if (url.includes("/convai/analytics/live-count")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            conversations: [
              {
                conversation_id: "conv1",
                agent_id: "agent1",
                status: "done",
                metadata: { detected_language: "en" },
              },
              {
                conversation_id: "conv2",
                agent_id: "agent1",
                status: "done",
                metadata: { detected_language: "es" },
              },
              {
                conversation_id: "conv3",
                agent_id: "agent1",
                status: "done",
                metadata: { detected_language: "en" },
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.conversationsByLanguage).toHaveLength(2);
    expect(data.data.conversationsByLanguage[0].language).toBe("en");
    expect(data.data.conversationsByLanguage[0].count).toBe(2);
  });

  it("returns recent conversations sorted by time", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              agents: [{ agent_id: "agent1", name: "Paisaxe - Test Agent" }],
            }),
        });
      }
      if (url.includes("/convai/analytics/live-count")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            conversations: [
              {
                conversation_id: "conv1",
                agent_id: "agent1",
                status: "done",
                start_time_unix_secs: 1000,
              },
              {
                conversation_id: "conv2",
                agent_id: "agent1",
                status: "done",
                start_time_unix_secs: 3000,
              },
              {
                conversation_id: "conv3",
                agent_id: "agent1",
                status: "done",
                start_time_unix_secs: 2000,
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.recentConversations[0].conversation_id).toBe("conv2");
    expect(data.data.recentConversations[1].conversation_id).toBe("conv3");
    expect(data.data.recentConversations[2].conversation_id).toBe("conv1");
  });

  it("handles conversations without metadata gracefully", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              agents: [{ agent_id: "agent1", name: "Paisaxe - Test Agent" }],
            }),
        });
      }
      if (url.includes("/convai/analytics/live-count")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 0 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            conversations: [
              {
                conversation_id: "conv1",
                agent_id: "agent1",
                status: "done",
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.summary.totalConversations).toBe(1);
    expect(data.data.conversationsByLanguage[0].language).toBe("Unknown");
  });
});
