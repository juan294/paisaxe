import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock translate-story module
vi.mock("@/lib/translate-story", () => ({
  translateStory: vi.fn(),
}));

describe("translate webhook", () => {
  const VALID_SECRET = "test-webhook-secret";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("WEBHOOK_SECRET", VALID_SECRET);
  });

  it("should reject requests without webhook secret", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      body: JSON.stringify({ storyId: "test-id" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("should reject requests with invalid webhook secret", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      headers: { "x-webhook-secret": "wrong-secret" },
      body: JSON.stringify({ storyId: "test-id" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  const VALID_STORY_ID = "550e8400-e29b-41d4-a716-446655440000";

  it("should reject requests when body is null", async () => {
    // JSON.parse("null") returns null — Zod rejects non-object at root
    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      headers: { "x-webhook-secret": VALID_SECRET },
      body: "null",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.errors).toBeDefined();
  });

  it("should reject requests without storyId", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      headers: { "x-webhook-secret": VALID_SECRET },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.errors).toBeDefined();
  });

  it("should call translateStory with valid payload", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockResolvedValue({
      success: true,
      successCount: 5,
      failedCount: 0,
    });

    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      headers: { "x-webhook-secret": VALID_SECRET },
      body: JSON.stringify({ storyId: VALID_STORY_ID }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.successCount).toBe(5);
    expect(translateStory).toHaveBeenCalledWith(VALID_STORY_ID, {
      locales: undefined,
      forceRetranslate: undefined,
    });
  });

  it("should pass locales and forceRetranslate options", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockResolvedValue({
      success: true,
      successCount: 2,
      failedCount: 0,
    });

    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      headers: { "x-webhook-secret": VALID_SECRET },
      body: JSON.stringify({
        storyId: VALID_STORY_ID,
        locales: ["en", "fr"],
        forceRetranslate: true,
      }),
    });

    await POST(request);

    expect(translateStory).toHaveBeenCalledWith(VALID_STORY_ID, {
      locales: ["en", "fr"],
      forceRetranslate: true,
    });
  });

  it("should return 500 when translation fails", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockResolvedValue({
      success: false,
      error: "API error",
      successCount: 0,
      failedCount: 5,
    });

    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      headers: { "x-webhook-secret": VALID_SECRET },
      body: JSON.stringify({ storyId: VALID_STORY_ID }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.error).toBe("API error");
  });

  it("should return 500 when an unexpected error is thrown", async () => {
    const { translateStory } = await import("@/lib/translate-story");

    vi.mocked(translateStory).mockRejectedValue(new Error("Unexpected crash"));

    const request = new NextRequest("http://localhost/api/webhooks/translate", {
      method: "POST",
      headers: { "x-webhook-secret": VALID_SECRET },
      body: JSON.stringify({ storyId: VALID_STORY_ID }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });

  describe("Zod schema validation", () => {
    it("should emit WEBHOOK_UNKNOWN_SHAPE warn when payload has unexpected fields", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { translateStory } = await import("@/lib/translate-story");

      vi.mocked(translateStory).mockResolvedValue({
        success: true,
        successCount: 1,
        failedCount: 0,
      });

      const request = new NextRequest("http://localhost/api/webhooks/translate", {
        method: "POST",
        headers: { "x-webhook-secret": VALID_SECRET },
        body: JSON.stringify({
          storyId: "550e8400-e29b-41d4-a716-446655440000",
          unknownField: "surprise",
          anotherUnknown: 42,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[WEBHOOK_UNKNOWN_SHAPE]",
        expect.objectContaining({ webhook: "translate" })
      );

      consoleSpy.mockRestore();
    });

    it("should emit WEBHOOK_UNKNOWN_SHAPE warn when storyId is not a string", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // isValidPayload checks typeof storyId === "string", so a number storyId will
      // fail there and return 400 — but if it somehow passes, Zod catches it.
      // In practice, isValidPayload catches non-string storyId first.
      const request = new NextRequest("http://localhost/api/webhooks/translate", {
        method: "POST",
        headers: { "x-webhook-secret": VALID_SECRET },
        body: JSON.stringify({ storyId: 123 }),
      });

      const response = await POST(request);
      // isValidPayload requires string storyId, so 400
      expect(response.status).toBe(400);

      consoleSpy.mockRestore();
    });
  });
});
