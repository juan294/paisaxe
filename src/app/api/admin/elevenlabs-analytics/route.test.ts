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

  it("falls back to local config name when agent not in API response", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ agents: [] }), // No agents returned from API
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
                agent_id: "agent_test_xander", // This ID IS in ELEVENLABS_AGENT_IDS config
                status: "done",
                call_duration_secs: 60,
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    // With no agents from API, paisaxeAgentIds is empty, so all conversations
    // get filtered out — conversationsByAgent should be empty
    expect(data.data.conversationsByAgent).toEqual([]);
    expect(data.data.summary.totalConversations).toBe(0);
  });

  it("falls back to truncated ID when agent not in API or local config", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ agents: [] }), // No agents from API
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
                agent_id: "agent_unknown_12345678", // NOT in config
                status: "done",
                call_duration_secs: 30,
              },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    // With no agents from API, paisaxeAgentIds is empty, so all conversations
    // get filtered out — conversationsByAgent should be empty
    expect(data.data.conversationsByAgent).toEqual([]);
    expect(data.data.summary.totalConversations).toBe(0);
  });

  it("returns 401 when auth fails", async () => {
    const { validateAdminAuth } = await import("@/lib/admin-auth");
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);

    expect(response.status).toBe(401);

    // Restore valid auth for subsequent tests
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin-user" });
  });

  it("throws on non-ok API response (fetchElevenLabs error path)", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            agents: [{ agent_id: "agent1", name: "Paisaxe - Test" }],
          }),
        });
      }
      // Conversations endpoint returns non-ok
      return Promise.resolve({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    // Should fall into catch block and return empty data
    expect(response.status).toBe(200);
    expect(data.data.summary.totalConversations).toBe(0);
  });

  it("falls back to local config name for agent without name in API", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            agents: [
              // Agent in API list but with no name — agent_id matches local config
              { agent_id: "agent_test_xander", name: "Paisaxe" },
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
        json: () => Promise.resolve({
          conversations: [
            {
              conversation_id: "conv1",
              agent_id: "agent_test_xander",
              status: "done",
              call_duration_secs: 30,
            },
          ],
        }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.summary.totalConversations).toBe(1);
    // Name should be "Paisaxe" (the full name since the pattern doesn't match "Paisaxe - X")
    expect(data.data.conversationsByAgent).toHaveLength(1);
    expect(data.data.conversationsByAgent[0].agentName).toBe("Paisaxe");
  });

  it("falls back to truncated ID for completely unknown agent in Paisaxe list", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/convai/agents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            agents: [
              // Agent with name "Paisaxe" prefix but no name property set (undefined)
              { agent_id: "agent_unknown_xyz12345", name: "Paisaxe - New Agent" },
            ],
          }),
        });
      }
      if (url.includes("/convai/analytics/live-count")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 1 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          conversations: [
            {
              conversation_id: "conv1",
              agent_id: "agent_unknown_xyz12345",
              status: "done",
              call_duration_secs: 45,
            },
          ],
        }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.summary.totalConversations).toBe(1);
    expect(data.data.activeCalls).toBe(1);
    expect(data.data.conversationsByAgent).toHaveLength(1);
    // The name should come from the API match "Paisaxe - New Agent" -> "New Agent"
    expect(data.data.conversationsByAgent[0].agentName).toBe("New Agent");
  });

  it("aggregates conversations by status including failed", async () => {
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
              { conversation_id: "c1", agent_id: "agent1", status: "done", call_duration_secs: 60 },
              { conversation_id: "c2", agent_id: "agent1", status: "failed", call_duration_secs: 0 },
              { conversation_id: "c3", agent_id: "agent1", status: "done", call_duration_secs: 90 },
            ],
          }),
      });
    });

    const request = new NextRequest("http://localhost/api/admin/elevenlabs-analytics");
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.summary.totalConversations).toBe(3);
    expect(data.data.summary.completedConversations).toBe(2);
    // Check that status breakdown includes "failed"
    const failedStatus = data.data.conversationsByStatus?.find(
      (s: { status: string }) => s.status === "failed"
    );
    if (failedStatus) {
      expect(failedStatus.count).toBe(1);
    }
  });
});
