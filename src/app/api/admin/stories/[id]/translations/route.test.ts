import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, POST } from "./route";
import { NextRequest } from "next/server";
import { validateAdminAuth } from "@/lib/admin-auth";

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn().mockResolvedValue({ valid: true }),
}));

// Mock translate-story module
vi.mock("@/lib/translate-story", () => ({
  getStoryTranslations: vi.fn(),
  updateStoryTranslation: vi.fn(),
  translateStory: vi.fn(),
  TRANSLATION_LOCALES: ["en", "fr", "de", "pt", "ast"],
}));

describe("translations API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default auth mock (auth failure tests override this)
    vi.mocked(validateAdminAuth).mockResolvedValue({ valid: true, userId: "admin-user" });
  });

  describe("GET /api/admin/stories/[id]/translations", () => {
    it("should return 401 when auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations");
      const response = await GET(request, { params: Promise.resolve({ id: "test-id" }) });

      expect(response.status).toBe(401);
    });

    it("should return 400 when story ID is empty", async () => {
      const request = new NextRequest("http://localhost/api/admin/stories//translations");
      const response = await GET(request, { params: Promise.resolve({ id: "" }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Story ID is required");
    });

    it("should return translations for a story", async () => {
      const { getStoryTranslations } = await import("@/lib/translate-story");

      vi.mocked(getStoryTranslations).mockResolvedValue({
        success: true,
        data: {
          original: {
            title: "Lagos de Covadonga",
            subtitle: "Paraíso glaciar",
            description: "Dos lagos de origen glaciar.",
          },
          translations: {
            en: {
              title: "Lakes of Covadonga",
              subtitle: "Glacial paradise",
              description: "Two glacial lakes.",
            },
          },
          status: {
            en: { status: "complete", updatedAt: "2024-01-01T00:00:00Z" },
          },
          lastTranslatedAt: "2024-01-01T00:00:00Z",
        },
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations");
      const response = await GET(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.storyId).toBe("test-id");
      expect(json.data.original.title).toBe("Lagos de Covadonga");
      expect(json.data.translations.en.title).toBe("Lakes of Covadonga");
    });

    it("should return 404 when story not found", async () => {
      const { getStoryTranslations } = await import("@/lib/translate-story");

      vi.mocked(getStoryTranslations).mockResolvedValue({
        success: false,
        error: "Story not found",
      });

      const request = new NextRequest("http://localhost/api/admin/stories/not-found/translations");
      const response = await GET(request, { params: Promise.resolve({ id: "not-found" }) });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toContain("not found");
    });

    it("should return 404 with default message when no error provided", async () => {
      const { getStoryTranslations } = await import("@/lib/translate-story");

      vi.mocked(getStoryTranslations).mockResolvedValue({
        success: false,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/not-found/translations");
      const response = await GET(request, { params: Promise.resolve({ id: "not-found" }) });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe("Story not found");
    });

    it("should return 404 when result has success true but no data", async () => {
      const { getStoryTranslations } = await import("@/lib/translate-story");

      vi.mocked(getStoryTranslations).mockResolvedValue({
        success: true,
        data: undefined as never,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/missing/translations");
      const response = await GET(request, { params: Promise.resolve({ id: "missing" }) });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe("Story not found");
    });
  });

  describe("PATCH /api/admin/stories/[id]/translations", () => {
    it("should return 401 when auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "PATCH",
        body: JSON.stringify({ locale: "en", translation: { title: "T", subtitle: "S", description: "D" } }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: "test-id" }) });

      expect(response.status).toBe(401);
    });

    it("should return 400 when story ID is empty", async () => {
      const request = new NextRequest("http://localhost/api/admin/stories//translations", {
        method: "PATCH",
        body: JSON.stringify({ locale: "en", translation: { title: "T", subtitle: "S", description: "D" } }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: "" }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Story ID is required");
    });

    it("should return 400 for invalid JSON body", async () => {
      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "PATCH",
        body: "not valid json{{{",
        headers: { "Content-Type": "application/json" },
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Invalid JSON body");
    });

    it("should return 500 when updateStoryTranslation fails", async () => {
      const { updateStoryTranslation } = await import("@/lib/translate-story");

      vi.mocked(updateStoryTranslation).mockResolvedValue({
        success: false,
        error: "Database error",
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "PATCH",
        body: JSON.stringify({
          locale: "en",
          translation: {
            title: "Title",
            subtitle: "Subtitle",
            description: "Description",
          },
        }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe("Database error");
    });

    it("should return 500 with default message when updateStoryTranslation fails without error", async () => {
      const { updateStoryTranslation } = await import("@/lib/translate-story");

      vi.mocked(updateStoryTranslation).mockResolvedValue({
        success: false,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "PATCH",
        body: JSON.stringify({
          locale: "en",
          translation: {
            title: "Title",
            subtitle: "Subtitle",
            description: "Description",
          },
        }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe("Failed to update translation");
    });

    it("should update a single locale translation", async () => {
      const { updateStoryTranslation } = await import("@/lib/translate-story");

      vi.mocked(updateStoryTranslation).mockResolvedValue({ success: true });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "PATCH",
        body: JSON.stringify({
          locale: "en",
          translation: {
            title: "Updated Title",
            subtitle: "Updated Subtitle",
            description: "Updated Description",
          },
        }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.success).toBe(true);
      expect(updateStoryTranslation).toHaveBeenCalledWith("test-id", "en", {
        title: "Updated Title",
        subtitle: "Updated Subtitle",
        description: "Updated Description",
      });
    });

    it("should reject invalid locale", async () => {
      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "PATCH",
        body: JSON.stringify({
          locale: "invalid",
          translation: {
            title: "Title",
            subtitle: "Subtitle",
            description: "Description",
          },
        }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Invalid locale");
    });

    it("should reject missing translation fields", async () => {
      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "PATCH",
        body: JSON.stringify({
          locale: "en",
          translation: {
            title: "Title",
            // Missing subtitle and description
          },
        }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("required");
    });
  });

  describe("POST /api/admin/stories/[id]/translations", () => {
    it("should return 401 when auth fails", async () => {
      vi.mocked(validateAdminAuth).mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) as never,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const response = await POST(request, { params: Promise.resolve({ id: "test-id" }) });

      expect(response.status).toBe(401);
    });

    it("should return 400 when story ID is empty", async () => {
      const request = new NextRequest("http://localhost/api/admin/stories//translations", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const response = await POST(request, { params: Promise.resolve({ id: "" }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Story ID is required");
    });

    it("should return 400 for invalid JSON body", async () => {
      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
        body: "not valid json{{{",
        headers: { "Content-Type": "text/plain" },
      });
      const response = await POST(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("Invalid JSON body");
    });

    it("should return 400 when locales is not an array", async () => {
      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
        body: JSON.stringify({ locales: "en" }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe("locales must be an array");
    });

    it("should return 400 when locales array contains invalid locale", async () => {
      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
        body: JSON.stringify({ locales: ["en", "zz"] }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Invalid locale 'zz'");
    });

    it("should handle empty body (no text) and use defaults", async () => {
      const { translateStory } = await import("@/lib/translate-story");

      vi.mocked(translateStory).mockResolvedValue({
        success: true,
        results: {
          en: { success: true },
        } as Record<string, { success: boolean }>,
        successCount: 1,
        failedCount: 0,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
      });

      const response = await POST(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(translateStory).toHaveBeenCalledWith("test-id", {
        locales: undefined,
        forceRetranslate: undefined,
      });
      expect(json.data.successCount).toBe(1);
    });

    it("should default successCount and failedCount to 0 when undefined", async () => {
      const { translateStory } = await import("@/lib/translate-story");

      vi.mocked(translateStory).mockResolvedValue({
        success: true,
        results: {} as Record<string, { success: boolean }>,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.successCount).toBe(0);
      expect(json.data.failedCount).toBe(0);
    });

    it("should generate translations for all locales", async () => {
      const { translateStory } = await import("@/lib/translate-story");

      vi.mocked(translateStory).mockResolvedValue({
        success: true,
        results: {
          en: { success: true },
          fr: { success: true },
          de: { success: true },
          pt: { success: true },
          ast: { success: true },
        },
        successCount: 5,
        failedCount: 0,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.successCount).toBe(5);
      expect(json.data.failedCount).toBe(0);
    });

    it("should generate translations for specific locales", async () => {
      const { translateStory } = await import("@/lib/translate-story");

      vi.mocked(translateStory).mockResolvedValue({
        success: true,
        results: {
          en: { success: true },
          fr: { success: true },
        } as Record<string, { success: boolean }>,
        successCount: 2,
        failedCount: 0,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
        body: JSON.stringify({ locales: ["en", "fr"] }),
      });

      await POST(request, { params: Promise.resolve({ id: "test-id" }) });

      expect(translateStory).toHaveBeenCalledWith("test-id", {
        locales: ["en", "fr"],
        forceRetranslate: undefined,
      });
    });

    it("should handle forceRetranslate option", async () => {
      const { translateStory } = await import("@/lib/translate-story");

      vi.mocked(translateStory).mockResolvedValue({
        success: true,
        results: {
          en: { success: true },
        } as Record<string, { success: boolean }>,
        successCount: 1,
        failedCount: 0,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
        body: JSON.stringify({ locales: ["en"], forceRetranslate: true }),
      });

      await POST(request, { params: Promise.resolve({ id: "test-id" }) });

      expect(translateStory).toHaveBeenCalledWith("test-id", {
        locales: ["en"],
        forceRetranslate: true,
      });
    });

    it("should return partial success when some translations fail", async () => {
      const { translateStory } = await import("@/lib/translate-story");

      vi.mocked(translateStory).mockResolvedValue({
        success: false,
        results: {
          en: { success: true },
          fr: { success: false, error: "API error" },
        } as Record<string, { success: boolean; error?: string }>,
        successCount: 1,
        failedCount: 1,
      });

      const request = new NextRequest("http://localhost/api/admin/stories/test-id/translations", {
        method: "POST",
        body: JSON.stringify({ locales: ["en", "fr"] }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "test-id" }) });
      const json = await response.json();

      // Should still return 200 with partial success
      expect(response.status).toBe(200);
      expect(json.data.successCount).toBe(1);
      expect(json.data.failedCount).toBe(1);
    });
  });
});
