import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchStories,
  updateStoryImageUrl,
  uploadStoryImage,
  updateStoryStatus,
  updateFeatureFlagConfig,
  updateStoryImageSource,
  createStory,
  updateStory,
  bulkUpdateStoryStatus,
  bulkDeleteStories,
  fetchFeatureFlags,
  updateFeatureFlag,
  fetchAnalytics,
  searchContentImages,
  fetchElevenLabsAnalytics,
  fetchSuggestions,
  updateSuggestion,
  deleteSuggestion,
  fetchStripeAnalytics,
  fetchStoryTranslations,
  updateStoryTranslation,
  generateStoryTranslations,
  fetchCostsAnalytics,
  createManualCostEntry,
  updateManualCostEntry,
  deleteManualCostEntry,
  fetchAgentsSummary,
  triggerAgentRun,
  fetchRunningAgents,
  stopAgent,
  fetchAgentLogs,
} from "./admin-api";

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
    it("sends GET request without auth headers", async () => {
      const data = { data: [] };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      await fetchStories();

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain("/api/admin/stories");
      // No Authorization header - cookies handle auth
      expect(init?.headers).toBeUndefined();
    });

    it("returns data on successful response", async () => {
      const data = { data: [{ id: "1", title: "Story" }] };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      const result = await fetchStories();
      expect(result).toEqual(data);
    });

    it("appends filter query param when provided", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [] }));

      await fetchStories("approved");

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain("filter=approved");
    });

    it("omits filter query param when not provided", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [] }));

      await fetchStories();

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).not.toContain("filter=");
    });

    it("returns error message on API error response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Unauthorized" }, false, 401)
      );

      const result = await fetchStories();
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns fallback error when API error has no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({}, false, 500)
      );

      const result = await fetchStories();
      expect(result).toEqual({ error: "Failed to fetch stories" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await fetchStories();
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryImageUrl ───────────────────────────────────────────

  describe("updateStoryImageUrl", () => {
    const storyId = "story-1";
    const imageUrl = "https://example.com/image.jpg";

    it("sends PUT request with JSON body", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ data: { id: storyId, image: imageUrl } })
      );

      await updateStoryImageUrl(storyId, imageUrl, "unsplash");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/stories/${storyId}/image`);
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual(
        expect.objectContaining({
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

      const result = await updateStoryImageUrl(storyId, imageUrl);
      expect(result).toEqual(data);
    });

    it("returns error on API error response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Not found" }, false, 404)
      );

      const result = await updateStoryImageUrl(storyId, imageUrl);
      expect(result).toEqual({ error: "Not found" });
    });

    it("returns fallback error when API error has no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));

      const result = await updateStoryImageUrl(storyId, imageUrl);
      expect(result).toEqual({ error: "Failed to update image" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await updateStoryImageUrl(storyId, imageUrl);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryImageSource ───────────────────────────────────────

  describe("updateStoryImageSource", () => {
    const storyId = "story-1";
    const imageSource = "Turismo Asturias";

    it("sends PUT request with JSON body", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ data: { id: storyId, imageSource } })
      );

      await updateStoryImageSource(storyId, imageSource);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/stories/${storyId}/image-source`);
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual(
        expect.objectContaining({
          "Content-Type": "application/json",
        })
      );
      expect(JSON.parse(init?.body as string)).toEqual({ imageSource });
    });

    it("returns data on successful response", async () => {
      const data = { data: { id: storyId, imageSource } };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      const result = await updateStoryImageSource(storyId, imageSource);
      expect(result).toEqual(data);
    });

    it("returns error on API error response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Not found" }, false, 404)
      );

      const result = await updateStoryImageSource(storyId, imageSource);
      expect(result).toEqual({ error: "Not found" });
    });

    it("returns fallback error when API error has no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));

      const result = await updateStoryImageSource(storyId, imageSource);
      expect(result).toEqual({ error: "Failed to update image source" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await updateStoryImageSource(storyId, imageSource);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── uploadStoryImage ─────────────────────────────────────────────

  describe("uploadStoryImage", () => {
    const storyId = "story-2";

    it("sends PUT request with FormData body", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ data: { id: storyId, image: "/uploaded.png" } })
      );

      await uploadStoryImage(storyId, file, "user_upload");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/stories/${storyId}/image`);
      expect(init?.method).toBe("PUT");

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

      await uploadStoryImage(storyId, file);

      const [, init] = vi.mocked(fetch).mock.calls[0];
      const body = init?.body as FormData;
      expect(body.get("imageSource")).toBeNull();
    });

    it("returns data on successful response", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      const data = { data: { id: storyId, image: "/uploaded.png" } };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      const result = await uploadStoryImage(storyId, file);
      expect(result).toEqual(data);
    });

    it("returns error on API error response", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Too large" }, false, 413)
      );

      const result = await uploadStoryImage(storyId, file);
      expect(result).toEqual({ error: "Too large" });
    });

    it("returns fallback error when API error has no error field", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));

      const result = await uploadStoryImage(storyId, file);
      expect(result).toEqual({ error: "Failed to upload image" });
    });

    it("returns network error when fetch throws", async () => {
      const file = new File(["pixels"], "photo.png", { type: "image/png" });
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await uploadStoryImage(storyId, file);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryStatus ────────────────────────────────────────────

  describe("updateStoryStatus", () => {
    const storyId = "story-3";

    it("sends PUT request with JSON body", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({
          data: { id: storyId, curationStatus: "approved" },
        })
      );

      await updateStoryStatus(storyId, "approved");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/stories/${storyId}/status`);
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual(
        expect.objectContaining({
          "Content-Type": "application/json",
        })
      );
      expect(JSON.parse(init?.body as string)).toEqual({ status: "approved" });
    });

    it("returns data on successful response", async () => {
      const data = { data: { id: storyId, curationStatus: "approved" } };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      const result = await updateStoryStatus(storyId, "approved");
      expect(result).toEqual(data);
    });

    it("returns error on API error response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "Bad request" }, false, 400)
      );

      const result = await updateStoryStatus(
        storyId,
        "needs_curation"
      );
      expect(result).toEqual({ error: "Bad request" });
    });

    it("returns fallback error when API error has no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));

      const result = await updateStoryStatus(storyId, "approved");
      expect(result).toEqual({ error: "Failed to update status" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await updateStoryStatus(storyId, "approved");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateFeatureFlagConfig ─────────────────────────────────────────

  describe("updateFeatureFlagConfig", () => {
    const flagKey = "visitor_voice_agent";
    const mockConfig = {
      whitelisted_emails: ["test@example.com"],
      agent_id: "agent-123",
    };

    it("sends PUT request with config in JSON body", async () => {
      const data = {
        data: {
          flagKey,
          enabled: true,
          config: mockConfig,
        },
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      await updateFeatureFlagConfig(flagKey, mockConfig);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe(`/api/admin/feature-flags/${flagKey}`);
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual(
        expect.objectContaining({
          "Content-Type": "application/json",
        })
      );
      expect(JSON.parse(init?.body as string)).toEqual({ config: mockConfig });
    });

    it("returns data on successful response", async () => {
      const data = {
        data: {
          flagKey,
          enabled: true,
          config: mockConfig,
        },
      };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      const result = await updateFeatureFlagConfig(flagKey, mockConfig);
      expect(result).toEqual(data);
    });

    it("returns error on API error response", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ error: "config must be an object" }, false, 400)
      );

      const result = await updateFeatureFlagConfig(flagKey, mockConfig);
      expect(result).toEqual({ error: "config must be an object" });
    });

    it("returns fallback error when API error has no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));

      const result = await updateFeatureFlagConfig(flagKey, mockConfig);
      expect(result).toEqual({ error: "Failed to update feature flag config" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network failure"));

      const result = await updateFeatureFlagConfig(flagKey, mockConfig);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── createStory ───────────────────────────────────────────────────

  describe("createStory", () => {
    it("sends POST request with JSON body", async () => {
      const data = { data: { id: "new-1", title: "New Story" } };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));

      await createStory({ title: "New Story", content: "Story content" } as never);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual(expect.objectContaining({ "Content-Type": "application/json" }));
    });

    it("returns data on success", async () => {
      const data = { data: { id: "new-1" } };
      vi.mocked(fetch).mockResolvedValue(mockResponse(data));
      const result = await createStory({ title: "T" } as never);
      expect(result).toEqual(data);
    });

    it("returns error on API error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ error: "Bad data" }, false, 400));
      const result = await createStory({ title: "T" } as never);
      expect(result).toEqual({ error: "Bad data" });
    });

    it("returns fallback error when no error field", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await createStory({ title: "T" } as never);
      expect(result).toEqual({ error: "Failed to create story" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await createStory({ title: "T" } as never);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStory ───────────────────────────────────────────────────

  describe("updateStory", () => {
    it("sends PATCH request", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: {} }));
      await updateStory("s1", { title: "Updated" } as never);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1");
      expect(init?.method).toBe("PATCH");
    });

    it("returns error on failure", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await updateStory("s1", {} as never);
      expect(result).toEqual({ error: "Failed to update story" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await updateStory("s1", {} as never);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── bulkUpdateStoryStatus ─────────────────────────────────────────

  describe("bulkUpdateStoryStatus", () => {
    it("sends PUT request with storyIds and status", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { updatedIds: ["a"], status: "approved" } }));
      await bulkUpdateStoryStatus(["a", "b"], "approved");

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/bulk-status");
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual({ storyIds: ["a", "b"], status: "approved" });
    });

    it("returns fallback error on non-ok response", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await bulkUpdateStoryStatus(["a"], "approved");
      expect(result).toEqual({ error: "Failed to update stories" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await bulkUpdateStoryStatus(["a"], "approved");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── bulkDeleteStories ─────────────────────────────────────────────

  describe("bulkDeleteStories", () => {
    it("sends DELETE request with storyIds", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { deletedIds: ["a"] } }));
      await bulkDeleteStories(["a", "b"]);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/bulk-delete");
      expect(init?.method).toBe("DELETE");
    });

    it("returns fallback error on failure", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await bulkDeleteStories(["a"]);
      expect(result).toEqual({ error: "Failed to delete stories" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await bulkDeleteStories(["a"]);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchFeatureFlags ─────────────────────────────────────────────

  describe("fetchFeatureFlags", () => {
    it("sends GET to /api/feature-flags", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [] }));
      await fetchFeatureFlags();

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/feature-flags");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchFeatureFlags();
      expect(result).toEqual({ error: "Failed to fetch feature flags" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchFeatureFlags();
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateFeatureFlag ─────────────────────────────────────────────

  describe("updateFeatureFlag", () => {
    it("sends PUT with enabled boolean", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { flagKey: "k", enabled: true } }));
      await updateFeatureFlag("visitor_voice_agent", true);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/feature-flags/visitor_voice_agent");
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual({ enabled: true });
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await updateFeatureFlag("visitor_voice_agent", true);
      expect(result).toEqual({ error: "Failed to update feature flag" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await updateFeatureFlag("visitor_voice_agent", true);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchAnalytics ────────────────────────────────────────────────

  describe("fetchAnalytics", () => {
    it("sends GET with date range params", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: {} }));
      await fetchAnalytics("2026-01-01", "2026-01-31", true);

      const [url] = vi.mocked(fetch).mock.calls[0];
      const urlStr = String(url);
      expect(urlStr).toContain("from=2026-01-01");
      expect(urlStr).toContain("to=2026-01-31");
      expect(urlStr).toContain("includeLocalhost=true");
    });

    it("omits params when not provided", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: {} }));
      await fetchAnalytics();

      const [url] = vi.mocked(fetch).mock.calls[0];
      const urlStr = String(url);
      expect(urlStr).not.toContain("from=");
      expect(urlStr).not.toContain("to=");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchAnalytics();
      expect(result).toEqual({ error: "Failed to fetch analytics" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchAnalytics();
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── searchContentImages ───────────────────────────────────────────

  describe("searchContentImages", () => {
    it("sends GET to content-images endpoint", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { images: [] } }));
      await searchContentImages("s1");

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/content-images");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await searchContentImages("s1");
      expect(result).toEqual({ error: "Failed to search content images" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await searchContentImages("s1");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchElevenLabsAnalytics ──────────────────────────────────────

  describe("fetchElevenLabsAnalytics", () => {
    it("sends GET with date params", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: {} }));
      await fetchElevenLabsAnalytics("2026-01-01", "2026-01-31");

      const [url] = vi.mocked(fetch).mock.calls[0];
      const urlStr = String(url);
      expect(urlStr).toContain("elevenlabs-analytics");
      expect(urlStr).toContain("from=2026-01-01");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchElevenLabsAnalytics();
      expect(result).toEqual({ error: "Failed to fetch ElevenLabs analytics" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchElevenLabsAnalytics();
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchSuggestions ──────────────────────────────────────────────

  describe("fetchSuggestions", () => {
    it("sends GET with optional status filter", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [] }));
      await fetchSuggestions("pending" as never);

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain("status=pending");
    });

    it("omits status when not provided", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: [] }));
      await fetchSuggestions();

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).not.toContain("status=");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchSuggestions();
      expect(result).toEqual({ error: "Failed to fetch suggestions" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchSuggestions();
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateSuggestion ─────────────────────────────────────────────

  describe("updateSuggestion", () => {
    it("sends PUT with updates", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: {} }));
      await updateSuggestion("sug-1", { status: "approved" as never, adminNotes: "LGTM" });

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/suggestions/sug-1");
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(init?.body as string)).toEqual({ status: "approved", adminNotes: "LGTM" });
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await updateSuggestion("sug-1", {});
      expect(result).toEqual({ error: "Failed to update suggestion" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await updateSuggestion("sug-1", {});
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── deleteSuggestion ─────────────────────────────────────────────

  describe("deleteSuggestion", () => {
    it("sends DELETE request", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { id: "sug-1", deleted: true } }));
      await deleteSuggestion("sug-1");

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/suggestions/sug-1");
      expect(init?.method).toBe("DELETE");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await deleteSuggestion("sug-1");
      expect(result).toEqual({ error: "Failed to delete suggestion" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await deleteSuggestion("sug-1");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchStripeAnalytics ──────────────────────────────────────────

  describe("fetchStripeAnalytics", () => {
    it("sends GET with date params and returns data with warning", async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockResponse({ data: { revenue: 100 }, warning: "Test mode" })
      );
      const result = await fetchStripeAnalytics("2026-01-01", "2026-01-31");

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain("stripe-analytics");
      expect(result).toEqual({ data: { revenue: 100 }, warning: "Test mode" });
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchStripeAnalytics();
      expect(result).toEqual({ error: "Failed to fetch Stripe analytics" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchStripeAnalytics();
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchStoryTranslations ────────────────────────────────────────

  describe("fetchStoryTranslations", () => {
    it("sends GET to translations endpoint", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: {} }));
      await fetchStoryTranslations("s1");

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/translations");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchStoryTranslations("s1");
      expect(result).toEqual({ error: "Failed to fetch translations" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchStoryTranslations("s1");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateStoryTranslation ────────────────────────────────────────

  describe("updateStoryTranslation", () => {
    it("sends PATCH with locale and translation", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { success: true } }));
      await updateStoryTranslation("s1", "es" as never, { title: "Hola" } as never);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/translations");
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(init?.body as string)).toEqual({ locale: "es", translation: { title: "Hola" } });
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await updateStoryTranslation("s1", "es" as never, {} as never);
      expect(result).toEqual({ error: "Failed to update translation" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await updateStoryTranslation("s1", "es" as never, {} as never);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── generateStoryTranslations ─────────────────────────────────────

  describe("generateStoryTranslations", () => {
    it("sends POST with options", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { translated: true } }));
      await generateStoryTranslations("s1", { locales: ["es" as never], forceRetranslate: true });

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/stories/s1/translations");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({ locales: ["es"], forceRetranslate: true });
    });

    it("sends empty body when no options", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: {} }));
      await generateStoryTranslations("s1");

      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(JSON.parse(init?.body as string)).toEqual({});
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await generateStoryTranslations("s1");
      expect(result).toEqual({ error: "Failed to generate translations" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await generateStoryTranslations("s1");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchCostsAnalytics ───────────────────────────────────────────

  describe("fetchCostsAnalytics", () => {
    it("sends GET with all params", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: {} }));
      await fetchCostsAnalytics("2026-01-01", "2026-01-31", { includeUsage: true });

      const [url] = vi.mocked(fetch).mock.calls[0];
      const urlStr = String(url);
      expect(urlStr).toContain("costs-analytics");
      expect(urlStr).toContain("from=2026-01-01");
      expect(urlStr).toContain("includeUsage=true");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchCostsAnalytics();
      expect(result).toEqual({ error: "Failed to fetch costs analytics" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchCostsAnalytics();
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── createManualCostEntry ─────────────────────────────────────────

  describe("createManualCostEntry", () => {
    it("sends POST request", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { id: "c1" } }));
      await createManualCostEntry({ platform: "vercel", amount: 20, date: "2026-01-15" } as never);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/costs-analytics");
      expect(init?.method).toBe("POST");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await createManualCostEntry({} as never);
      expect(result).toEqual({ error: "Failed to create cost entry" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await createManualCostEntry({} as never);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateManualCostEntry ─────────────────────────────────────────

  describe("updateManualCostEntry", () => {
    it("sends PUT request", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { id: "c1" } }));
      await updateManualCostEntry("c1", { amount: 30 } as never);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/costs-analytics/c1");
      expect(init?.method).toBe("PUT");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await updateManualCostEntry("c1", {} as never);
      expect(result).toEqual({ error: "Failed to update cost entry" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await updateManualCostEntry("c1", {} as never);
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── deleteManualCostEntry ─────────────────────────────────────────

  describe("deleteManualCostEntry", () => {
    it("sends DELETE request", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: { id: "c1", deleted: true } }));
      await deleteManualCostEntry("c1");

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/costs-analytics/c1");
      expect(init?.method).toBe("DELETE");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await deleteManualCostEntry("c1");
      expect(result).toEqual({ error: "Failed to delete cost entry" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await deleteManualCostEntry("c1");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchAgentsSummary ────────────────────────────────────────────

  describe("fetchAgentsSummary", () => {
    it("sends GET to agents-summary endpoint", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({ data: {} }));
      await fetchAgentsSummary();

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agents-summary");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchAgentsSummary();
      expect(result).toEqual({ error: "Failed to fetch agents summary" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchAgentsSummary();
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── triggerAgentRun ───────────────────────────────────────────────

  describe("triggerAgentRun", () => {
    it("sends POST with agentKey", async () => {
      const responseData = { started: true, agentKey: "xander", startedAt: "2026-01-01" };
      vi.mocked(fetch).mockResolvedValue(mockResponse(responseData));
      const result = await triggerAgentRun("xander");

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agents/run");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(init?.body as string)).toEqual({ agentKey: "xander" });
      expect(result).toEqual({ data: responseData });
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await triggerAgentRun("xander");
      expect(result).toEqual({ error: "Failed to start agent" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await triggerAgentRun("xander");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchRunningAgents ────────────────────────────────────────────

  describe("fetchRunningAgents", () => {
    it("sends GET to agents/run", async () => {
      const responseData = { running: [] };
      vi.mocked(fetch).mockResolvedValue(mockResponse(responseData));
      const result = await fetchRunningAgents();

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agents/run");
      expect(result).toEqual({ data: responseData });
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchRunningAgents();
      expect(result).toEqual({ error: "Failed to fetch running agents" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchRunningAgents();
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── stopAgent ─────────────────────────────────────────────────────

  describe("stopAgent", () => {
    it("sends DELETE with agentKey", async () => {
      const responseData = { stopped: true, agentKey: "xander" };
      vi.mocked(fetch).mockResolvedValue(mockResponse(responseData));
      const result = await stopAgent("xander");

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toBe("/api/admin/agents/run");
      expect(init?.method).toBe("DELETE");
      expect(JSON.parse(init?.body as string)).toEqual({ agentKey: "xander" });
      expect(result).toEqual({ data: responseData });
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await stopAgent("xander");
      expect(result).toEqual({ error: "Failed to stop agent" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await stopAgent("xander");
      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── fetchAgentLogs ────────────────────────────────────────────────

  describe("fetchAgentLogs", () => {
    it("sends GET with agentKey and since params", async () => {
      const responseData = { logs: [], finished: false };
      vi.mocked(fetch).mockResolvedValue(mockResponse(responseData));
      const result = await fetchAgentLogs("xander", 12345);

      const [url] = vi.mocked(fetch).mock.calls[0];
      const urlStr = String(url);
      expect(urlStr).toContain("agentKey=xander");
      expect(urlStr).toContain("since=12345");
      expect(result).toEqual({ data: responseData });
    });

    it("omits since when not provided", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}));
      await fetchAgentLogs("xander");

      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).not.toContain("since=");
    });

    it("returns fallback error", async () => {
      vi.mocked(fetch).mockResolvedValue(mockResponse({}, false, 500));
      const result = await fetchAgentLogs("xander");
      expect(result).toEqual({ error: "Failed to fetch agent logs" });
    });

    it("returns network error when fetch throws", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("fail"));
      const result = await fetchAgentLogs("xander");
      expect(result).toEqual({ error: "Network error" });
    });
  });
});
