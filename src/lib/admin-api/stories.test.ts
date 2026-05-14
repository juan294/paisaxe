import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStory,
  updateStory,
  fetchStories,
  updateStoryImageUrl,
  uploadStoryImage,
  updateStoryImageSource,
  updateStoryStatus,
  bulkUpdateStoryStatus,
  bulkDeleteStories,
  approveAllPendingStories,
  searchContentImages,
  fetchStoryTranslations,
  updateStoryTranslation,
  generateStoryTranslations,
} from "./stories";

const ORIGIN = "https://paisaxe.es";

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("admin-api/stories", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      value: { origin: ORIGIN },
      writable: true,
    });
  });

  // ─── createStory ─────────────────────────────────────────────────

  describe("createStory", () => {
    it("sends POST with JSON body to /api/admin/stories", async () => {
      const data = { data: { id: "new-1", title: "New Story" } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(data));

      await createStory({ title: "New Story", content: "Content" } as never);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
    });

    it("returns data on successful response", async () => {
      const data = { data: { id: "new-1" } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(data));

      const result = await createStory({ title: "T" } as never);

      expect(result).toEqual(data);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Validation failed" }, false)
      );

      const result = await createStory({ title: "T" } as never);

      expect(result).toEqual({ error: "Validation failed" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await createStory({ title: "T" } as never);

      expect(result).toEqual({ error: "Failed to create story" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await createStory({ title: "T" } as never);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStory ─────────────────────────────────────────────────

  describe("updateStory", () => {
    it("sends PATCH with JSON body to /api/admin/stories/:id", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: "s1", title: "Updated" } })
      );

      await updateStory("s1", { title: "Updated" } as never);

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1");
      expect(init.method).toBe("PATCH");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body)).toEqual({ title: "Updated" });
    });

    it("returns data on successful response", async () => {
      const data = { data: { id: "s1" } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(data));

      const result = await updateStory("s1", {} as never);

      expect(result).toEqual(data);
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateStory("s1", {} as never);

      expect(result).toEqual({ error: "Failed to update story" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await updateStory("s1", {} as never);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchStories ────────────────────────────────────────────────

  describe("fetchStories", () => {
    it("sends GET to /api/admin/stories", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: [{ id: "1", title: "Story" }] })
      );

      const result = await fetchStories();

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe(`${ORIGIN}/api/admin/stories`);
      expect(result).toEqual({ data: [{ id: "1", title: "Story" }] });
    });

    it("appends filter query param when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: [] }));

      await fetchStories("approved");

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.get("filter")).toBe("approved");
    });

    it("does not append filter when not provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: [] }));

      await fetchStories();

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.has("filter")).toBe(false);
    });

    it("appends page query param when provided (line 101)", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: [] }));

      await fetchStories({ page: 2 });

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.get("page")).toBe("2");
    });

    it("appends pageSize query param when provided (line 104)", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: [] }));

      await fetchStories({ pageSize: 50 });

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.get("pageSize")).toBe("50");
    });

    it("appends all params together when filter, page, and pageSize provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: [] }));

      await fetchStories({ filter: "approved", page: 1, pageSize: 25 });

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.get("filter")).toBe("approved");
      expect(parsedUrl.searchParams.get("page")).toBe("1");
      expect(parsedUrl.searchParams.get("pageSize")).toBe("25");
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Unauthorized" }, false)
      );

      const result = await fetchStories();

      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await fetchStories();

      expect(result).toEqual({ error: "Failed to fetch stories" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await fetchStories();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryImageUrl ─────────────────────────────────────────

  describe("updateStoryImageUrl", () => {
    const storyId = "story-1";
    const imageUrl = "https://example.com/image.jpg";

    it("sends PUT with JSON body to /api/admin/stories/:id/image", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: storyId, image: imageUrl } })
      );

      await updateStoryImageUrl(storyId, imageUrl, "unsplash");

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/stories/${storyId}/image`);
      expect(init.method).toBe("PUT");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body)).toEqual({ imageUrl, imageSource: "unsplash" });
    });

    it("sends undefined imageSource when not provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: storyId, image: imageUrl } })
      );

      await updateStoryImageUrl(storyId, imageUrl);

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.imageUrl).toBe(imageUrl);
    });

    it("returns data on successful response", async () => {
      const data = { data: { id: storyId, image: imageUrl } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(data));

      const result = await updateStoryImageUrl(storyId, imageUrl);

      expect(result).toEqual(data);
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateStoryImageUrl(storyId, imageUrl);

      expect(result).toEqual({ error: "Failed to update image" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await updateStoryImageUrl(storyId, imageUrl);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── uploadStoryImage ────────────────────────────────────────────

  describe("uploadStoryImage", () => {
    const storyId = "story-2";

    it("sends PUT with FormData body to /api/admin/stories/:id/image", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: storyId, image: "/uploaded.png" } })
      );

      await uploadStoryImage(storyId, file, "user_upload");

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/stories/${storyId}/image`);
      expect(init.method).toBe("PUT");
      const body = init.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect(body.get("file")).toBe(file);
      expect(body.get("imageSource")).toBe("user_upload");
    });

    it("omits imageSource from FormData when not provided", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: storyId, image: "/uploaded.png" } })
      );

      await uploadStoryImage(storyId, file);

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = init.body as FormData;
      expect(body.get("imageSource")).toBeNull();
    });

    it("does not set Content-Type header (browser sets multipart boundary)", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: storyId, image: "/uploaded.png" } })
      );

      await uploadStoryImage(storyId, file);

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(init.headers).toEqual({});
    });

    it("returns data on successful response", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      const data = { data: { id: storyId, image: "/uploaded.png" } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(data));

      const result = await uploadStoryImage(storyId, file);

      expect(result).toEqual(data);
    });

    it("returns fallback error when response body has no error field", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await uploadStoryImage(storyId, file);

      expect(result).toEqual({ error: "Failed to upload image" });
    });

    it("returns network error when fetch throws", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await uploadStoryImage(storyId, file);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryImageSource ──────────────────────────────────────

  describe("updateStoryImageSource", () => {
    it("sends PUT with JSON body to /api/admin/stories/:id/image-source", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: "s1", imageSource: "Turismo Asturias" } })
      );

      await updateStoryImageSource("s1", "Turismo Asturias");

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/image-source");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ imageSource: "Turismo Asturias" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateStoryImageSource("s1", "src");

      expect(result).toEqual({ error: "Failed to update image source" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await updateStoryImageSource("s1", "src");

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryStatus ───────────────────────────────────────────

  describe("updateStoryStatus", () => {
    it("sends PUT with status to /api/admin/stories/:id/status", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: "s1", curationStatus: "approved" } })
      );

      await updateStoryStatus("s1", "approved");

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/status");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ status: "approved" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateStoryStatus("s1", "approved");

      expect(result).toEqual({ error: "Failed to update status" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await updateStoryStatus("s1", "approved");

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── bulkUpdateStoryStatus ───────────────────────────────────────

  describe("bulkUpdateStoryStatus", () => {
    it("sends PUT with storyIds and status to /api/admin/stories/bulk-status", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { updatedIds: ["a", "b"], status: "approved" } })
      );

      await bulkUpdateStoryStatus(["a", "b"], "approved");

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/bulk-status");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ storyIds: ["a", "b"], status: "approved" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await bulkUpdateStoryStatus(["a"], "approved");

      expect(result).toEqual({ error: "Failed to update stories" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await bulkUpdateStoryStatus(["a"], "approved");

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── bulkDeleteStories ───────────────────────────────────────────

  describe("bulkDeleteStories", () => {
    it("sends DELETE with storyIds to /api/admin/stories/bulk-delete", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { deletedIds: ["a", "b"] } })
      );

      await bulkDeleteStories(["a", "b"]);

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/bulk-delete");
      expect(init.method).toBe("DELETE");
      expect(JSON.parse(init.body)).toEqual({ storyIds: ["a", "b"] });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await bulkDeleteStories(["a"]);

      expect(result).toEqual({ error: "Failed to delete stories" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await bulkDeleteStories(["a"]);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── approveAllPendingStories ────────────────────────────────────

  describe("approveAllPendingStories", () => {
    it("sends POST to /api/admin/stories/approve-all", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { approvedCount: 5, approvedIds: ["a", "b", "c", "d", "e"] } })
      );

      const result = await approveAllPendingStories();

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/approve-all");
      expect(init.method).toBe("POST");
      expect(result).toEqual({ data: { approvedCount: 5, approvedIds: ["a", "b", "c", "d", "e"] } });
    });

    it("does not send request body or Content-Type header", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { approvedCount: 0, approvedIds: [] } })
      );

      await approveAllPendingStories();

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(init.body).toBeUndefined();
      expect(init.headers).toEqual({});
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Forbidden" }, false)
      );

      const result = await approveAllPendingStories();

      expect(result).toEqual({ error: "Forbidden" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await approveAllPendingStories();

      expect(result).toEqual({ error: "Failed to approve all stories" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await approveAllPendingStories();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── searchContentImages ─────────────────────────────────────────

  describe("searchContentImages", () => {
    it("sends GET to /api/admin/stories/:id/content-images", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { images: [] } })
      );

      await searchContentImages("s1");

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/content-images");
    });

    it("returns data on successful response", async () => {
      const data = { data: { images: [{ url: "/img.jpg" }] } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(data));

      const result = await searchContentImages("s1");

      expect(result).toEqual(data);
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await searchContentImages("s1");

      expect(result).toEqual({ error: "Failed to search content images" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await searchContentImages("s1");

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchStoryTranslations ──────────────────────────────────────

  describe("fetchStoryTranslations", () => {
    it("sends GET to /api/admin/stories/:id/translations", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: {} }));

      await fetchStoryTranslations("s1");

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/translations");
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await fetchStoryTranslations("s1");

      expect(result).toEqual({ error: "Failed to fetch translations" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await fetchStoryTranslations("s1");

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryTranslation ──────────────────────────────────────

  describe("updateStoryTranslation", () => {
    it("sends PATCH with locale and translation to /api/admin/stories/:id/translations", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { success: true, locale: "es", storyId: "s1" } })
      );

      await updateStoryTranslation("s1", "es" as never, { title: "Hola" } as never);

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/translations");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body)).toEqual({ locale: "es", translation: { title: "Hola" } });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateStoryTranslation("s1", "es" as never, {} as never);

      expect(result).toEqual({ error: "Failed to update translation" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await updateStoryTranslation("s1", "es" as never, {} as never);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── generateStoryTranslations ───────────────────────────────────

  describe("generateStoryTranslations", () => {
    it("sends POST with options to /api/admin/stories/:id/translations", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { translated: true } })
      );

      await generateStoryTranslations("s1", { locales: ["es" as never], forceRetranslate: true });

      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/translations");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ locales: ["es"], forceRetranslate: true });
    });

    it("sends empty object body when no options provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: {} }));

      await generateStoryTranslations("s1");

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({});
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await generateStoryTranslations("s1");

      expect(result).toEqual({ error: "Failed to generate translations" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fail"));

      const result = await generateStoryTranslations("s1");

      expect(result).toEqual({ error: "Network error" });
    });
  });
});
