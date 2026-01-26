import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchStories,
  updateStoryImageUrl,
  uploadStoryImage,
  updateStoryStatus,
  validateAdminKey,
} from "./admin-api";

const ADMIN_KEY = "test-admin-key-123";

// Helper to create a mock Response
function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("admin-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue(mockResponse({}));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // ─── fetchStories ──────────────────────────────────────────────────

  describe("fetchStories", () => {
    it("sends GET request with Bearer auth header", async () => {
      const data = { data: [] };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      await fetchStories(ADMIN_KEY);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(init?.headers).toEqual(
        expect.objectContaining({ Authorization: `Bearer ${ADMIN_KEY}` })
      );
      expect(String(url)).toContain("/api/admin/stories");
    });

    it("returns data on successful response", async () => {
      const data = { data: [{ id: "1", title: "Story" }] };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      const result = await fetchStories(ADMIN_KEY);
      expect(result).toEqual(data);
    });

    it("appends filter query param when provided", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [] }));

      await fetchStories(ADMIN_KEY, "approved");

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain("filter=approved");
    });

    it("omits filter query param when not provided", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [] }));

      await fetchStories(ADMIN_KEY);

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).not.toContain("filter=");
    });

    it("returns error message on API error response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Unauthorized" }, false, 401)
      );

      const result = await fetchStories(ADMIN_KEY);
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns fallback error when API error has no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({}, false, 500)
      );

      const result = await fetchStories(ADMIN_KEY);
      expect(result).toEqual({ error: "Failed to fetch stories" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await fetchStories(ADMIN_KEY);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryImageUrl ───────────────────────────────────────────

  describe("updateStoryImageUrl", () => {
    const storyId = "story-1";
    const imageUrl = "https://example.com/image.jpg";

    it("sends PUT request with JSON body and auth header", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ data: { id: storyId, image: imageUrl } })
      );

      await updateStoryImageUrl(ADMIN_KEY, storyId, imageUrl, "unsplash");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/stories/${storyId}/image`);
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual(
        expect.objectContaining({
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
        })
      );
      expect(JSON.parse(init?.body as string)).toEqual({
        imageUrl,
        imageSource: "unsplash",
      });
    });

    it("returns data on successful response", async () => {
      const data = { data: { id: storyId, image: imageUrl } };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      const result = await updateStoryImageUrl(ADMIN_KEY, storyId, imageUrl);
      expect(result).toEqual(data);
    });

    it("returns error on API error response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Not found" }, false, 404)
      );

      const result = await updateStoryImageUrl(ADMIN_KEY, storyId, imageUrl);
      expect(result).toEqual({ error: "Not found" });
    });

    it("returns fallback error when API error has no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));

      const result = await updateStoryImageUrl(ADMIN_KEY, storyId, imageUrl);
      expect(result).toEqual({ error: "Failed to update image" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await updateStoryImageUrl(ADMIN_KEY, storyId, imageUrl);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── uploadStoryImage ─────────────────────────────────────────────

  describe("uploadStoryImage", () => {
    const storyId = "story-2";

    it("sends PUT request with FormData body and auth header", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ data: { id: storyId, image: "/uploaded.png" } })
      );

      await uploadStoryImage(ADMIN_KEY, storyId, file, "user_upload");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/stories/${storyId}/image`);
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual(
        expect.objectContaining({ Authorization: `Bearer ${ADMIN_KEY}` })
      );

      const body = init?.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      expect(body.get("file")).toBe(file);
      expect(body.get("imageSource")).toBe("user_upload");
    });

    it("omits imageSource from FormData when not provided", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ data: { id: storyId, image: "/uploaded.png" } })
      );

      await uploadStoryImage(ADMIN_KEY, storyId, file);

      const [, init] = vi.mocked(fetch).mock.calls[0];
      const body = init?.body as FormData;
      expect(body.get("imageSource")).toBeNull();
    });

    it("returns data on successful response", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      const data = { data: { id: storyId, image: "/uploaded.png" } };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      const result = await uploadStoryImage(ADMIN_KEY, storyId, file);
      expect(result).toEqual(data);
    });

    it("returns error on API error response", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Too large" }, false, 413)
      );

      const result = await uploadStoryImage(ADMIN_KEY, storyId, file);
      expect(result).toEqual({ error: "Too large" });
    });

    it("returns fallback error when API error has no error field", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));

      const result = await uploadStoryImage(ADMIN_KEY, storyId, file);
      expect(result).toEqual({ error: "Failed to upload image" });
    });

    it("returns network error when fetch throws", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await uploadStoryImage(ADMIN_KEY, storyId, file);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryStatus ────────────────────────────────────────────

  describe("updateStoryStatus", () => {
    const storyId = "story-3";

    it("sends PUT request with JSON body and auth header", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({
          data: { id: storyId, curationStatus: "approved" },
        })
      );

      await updateStoryStatus(ADMIN_KEY, storyId, "approved");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/stories/${storyId}/status`);
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual(
        expect.objectContaining({
          Authorization: `Bearer ${ADMIN_KEY}`,
          "Content-Type": "application/json",
        })
      );
      expect(JSON.parse(init?.body as string)).toEqual({ status: "approved" });
    });

    it("returns data on successful response", async () => {
      const data = { data: { id: storyId, curationStatus: "approved" } };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      const result = await updateStoryStatus(ADMIN_KEY, storyId, "approved");
      expect(result).toEqual(data);
    });

    it("returns error on API error response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Bad request" }, false, 400)
      );

      const result = await updateStoryStatus(
        ADMIN_KEY,
        storyId,
        "needs_curation"
      );
      expect(result).toEqual({ error: "Bad request" });
    });

    it("returns fallback error when API error has no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));

      const result = await updateStoryStatus(ADMIN_KEY, storyId, "approved");
      expect(result).toEqual({ error: "Failed to update status" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await updateStoryStatus(ADMIN_KEY, storyId, "approved");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── validateAdminKey ─────────────────────────────────────────────

  describe("validateAdminKey", () => {
    it("sends GET request with Bearer auth header", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, true));

      await validateAdminKey(ADMIN_KEY);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories");
      expect(init?.headers).toEqual(
        expect.objectContaining({ Authorization: `Bearer ${ADMIN_KEY}` })
      );
    });

    it("returns true when response is ok", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, true));

      const result = await validateAdminKey(ADMIN_KEY);
      expect(result).toBe(true);
    });

    it("returns false when response is not ok", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 401));

      const result = await validateAdminKey(ADMIN_KEY);
      expect(result).toBe(false);
    });

    it("returns false when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await validateAdminKey(ADMIN_KEY);
      expect(result).toBe(false);
    });
  });
});
