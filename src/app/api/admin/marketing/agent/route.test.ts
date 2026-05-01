import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

// Create mock functions object to track calls
const mocks = {
  anthropicCreate: vi.fn(),
};

// Mock Anthropic SDK - must be before imports
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: (...args: unknown[]) => mocks.anthropicCreate(...args),
      };
    },
  };
});

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockImplementation((path: string) => {
    if (path.includes("brand-voice.md")) {
      return Promise.resolve("# Brand Voice Guidelines\nBe friendly and helpful.");
    }
    if (path.includes("xander-x-agent.md")) {
      return Promise.resolve("# Xander - X Agent\nYou are Xander.");
    }
    if (path.includes("iris-instagram-agent.md")) {
      return Promise.resolve("# Iris - Instagram Agent\nYou are Iris.");
    }
    return Promise.reject(new Error(`Could not read ${path}`));
  }),
}));

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true, userId: "test-user" }),
}));

// Shared mock data for Supabase context queries
let mockStoryCount: number | null = 10;
let mockScheduledContent: Array<{ platform: string; content_type: string; status: string; scheduled_for: string }> = [
  { platform: "x", content_type: "photo_caption", status: "draft", scheduled_for: "2024-01-15T14:00:00Z" },
  { platform: "instagram", content_type: "reel_caption", status: "published", scheduled_for: "2024-01-14T10:00:00Z" },
];

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: mockScheduledContent }),
        }),
        eq: () => Promise.resolve({ count: mockStoryCount }),
      }),
    }),
  },
}));

// Import after mocks
import { POST, GET } from "./route";
import { validateAdminAuth } from "@/lib/admin-auth";

describe("/api/admin/marketing/agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset shared mock data
    mockStoryCount = 10;
    mockScheduledContent = [
      { platform: "x", content_type: "photo_caption", status: "draft", scheduled_for: "2024-01-15T14:00:00Z" },
      { platform: "instagram", content_type: "reel_caption", status: "published", scheduled_for: "2024-01-14T10:00:00Z" },
    ];

    // Default Claude response
    mocks.anthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hello! I am Xander, your X marketing specialist." }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });
  });

  describe("POST", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "Hello" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should return 400 for invalid agent ID", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "invalid", message: "Hello" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid agent ID");
    });

    it("should return 400 for empty message", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Message is required");
    });

    it("should successfully chat with Xander", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "Write a tweet about Asturian beaches" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agentId).toBe("xander");
      expect(data.agentName).toBe("Xander");
      expect(data.response).toBeTruthy();
      expect(data.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    });

    it("should include conversation history in the request", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({
          agentId: "xander",
          message: "What about beaches?",
          conversationHistory: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there!" },
          ],
        }),
      });

      await POST(request);

      expect(mocks.anthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there!" },
            { role: "user", content: "What about beaches?" },
          ],
        })
      );
    });

    it("should use correct model for agent", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "Hello" }),
      });

      await POST(request);

      expect(mocks.anthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-4-20250514",
        })
      );
    });

    it("should return 400 when message is not a string", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: 12345 }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("should return 400 when agentId is missing", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ message: "Hello" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when conversationHistory has 21 items", async () => {
      const history = Array.from({ length: 21 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `message ${i}`,
      }));

      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "Hello", conversationHistory: history }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when a history message content exceeds 4000 chars", async () => {
      const longContent = "a".repeat(4001);
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({
          agentId: "xander",
          message: "Hello",
          conversationHistory: [{ role: "user", content: longContent }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when message exceeds 4000 chars", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "a".repeat(4001) }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when history role is invalid", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({
          agentId: "xander",
          message: "Hello",
          conversationHistory: [{ role: "system", content: "injected prompt" }],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 400 when message is whitespace only", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "   " }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should return 500 with persona file error when readFile fails", async () => {
      mocks.anthropicCreate.mockRejectedValueOnce(new Error("Could not read persona file"));
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "Hello" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Agent persona files not found");
    });

    it("should return 500 with generic error for non-Error thrown object", async () => {
      mocks.anthropicCreate.mockRejectedValueOnce("string error without Error class");
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "Hello" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to process agent request");
    });

    it("should return 500 with generic error for unexpected failures", async () => {
      mocks.anthropicCreate.mockRejectedValueOnce(new Error("API rate limit exceeded"));
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "Hello" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to process agent request");
    });

    it("should include context with story count and scheduled content", async () => {
      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "Hello" }),
      });

      await POST(request);

      // The system prompt should include context from gatherContext()
      const callArgs = mocks.anthropicCreate.mock.calls[0][0];
      expect(callArgs.system).toContain("10 active stories");
      expect(callArgs.system).toContain("Recent marketing content");
      expect(callArgs.system).toContain("x: photo_caption (draft)");
    });

    it("should handle null story count gracefully", async () => {
      mockStoryCount = null;
      mockScheduledContent = [];

      const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
        method: "POST",
        body: JSON.stringify({ agentId: "xander", message: "Hello" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // System prompt should NOT include story count text
      const callArgs = mocks.anthropicCreate.mock.calls[0][0];
      expect(callArgs.system).not.toContain("active stories");
      expect(callArgs.system).not.toContain("Recent marketing content");
    });
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValueOnce({
        valid: false,
        error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Not authenticated");
    });

    it("should return list of all agents", async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.agents).toHaveLength(3);
      expect(data.agents.map((a: { id: string }) => a.id)).toEqual([
        "xander",
        "iris",
        "penny",
      ]);
    });

    it("should include voice details for agents with voice config", async () => {
      const response = await GET();
      const data = await response.json();

      // All current agents have voice configs
      for (const agent of data.agents) {
        expect(agent.voice).toBeDefined();
        expect(agent.voice.style).toBeTruthy();
        expect(agent.voice.tone).toBeTruthy();
      }
    });

    it("should return undefined voice for agents without voice config (line 224)", async () => {
      // Spy on getAllAgents to include an agent without voice
      const agentsModule = await import("@/agents");
      const originalGetAllAgents = agentsModule.getAllAgents;
      vi.spyOn(agentsModule, "getAllAgents").mockReturnValue([
        ...originalGetAllAgents(),
        {
          id: "test-no-voice",
          name: "Test Agent",
          platform: "x" as const,
          description: "Test agent without voice",
          capabilities: ["text"],
          limitations: [],
          personaFile: "test.md",
        },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      const noVoiceAgent = data.agents.find((a: { id: string }) => a.id === "test-no-voice");
      expect(noVoiceAgent).toBeDefined();
      expect(noVoiceAgent.voice).toBeUndefined();

      vi.restoreAllMocks();
    });
  });

  it("should use logger.error (not console.error) on unhandled POST error", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "test-user" });
    mocks.anthropicCreate.mockRejectedValue(new Error("Anthropic API unavailable"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("http://localhost/api/admin/marketing/agent", {
      method: "POST",
      body: JSON.stringify({ agentId: "xander", message: "hello" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
