import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

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

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: [] }),
        }),
        eq: () => ({
          select: () => Promise.resolve({ count: 10 }),
        }),
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
  });
});
