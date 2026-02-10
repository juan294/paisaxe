import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchSuggestions,
  updateSuggestion,
  deleteSuggestion,
} from "./suggestions";

const ORIGIN = "https://paisaxe.es";

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("admin-api/suggestions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      value: { origin: ORIGIN },
      writable: true,
    });
  });

  // ─── fetchSuggestions ────────────────────────────────────────────

  describe("fetchSuggestions", () => {
    it("sends GET to /api/admin/suggestions", async () => {
      const mockData = [{ id: "sug-1", title: "Cool place" }];
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: mockData })
      );

      const result = await fetchSuggestions();

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe(`${ORIGIN}/api/admin/suggestions`);
      expect(result).toEqual({ data: mockData });
    });

    it("appends status query param when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: [] }));

      await fetchSuggestions("pending" as never);

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.get("status")).toBe("pending");
    });

    it("does not append status when not provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: [] }));

      await fetchSuggestions();

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.has("status")).toBe(false);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Unauthorized" }, false)
      );

      const result = await fetchSuggestions();

      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await fetchSuggestions();

      expect(result).toEqual({ error: "Failed to fetch suggestions" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      const result = await fetchSuggestions();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateSuggestion ───────────────────────────────────────────

  describe("updateSuggestion", () => {
    it("sends PUT with updates to /api/admin/suggestions/:id", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: "sug-1", status: "approved" } })
      );

      await updateSuggestion("sug-1", { status: "approved" as never, adminNotes: "LGTM" });

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/suggestions/sug-1");
      expect(init.method).toBe("PUT");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body)).toEqual({ status: "approved", adminNotes: "LGTM" });
    });

    it("returns data on successful response", async () => {
      const data = { data: { id: "sug-1", status: "approved" } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(data));

      const result = await updateSuggestion("sug-1", { status: "approved" as never });

      expect(result).toEqual(data);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Invalid status" }, false)
      );

      const result = await updateSuggestion("sug-1", { status: "invalid" as never });

      expect(result).toEqual({ error: "Invalid status" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateSuggestion("sug-1", {});

      expect(result).toEqual({ error: "Failed to update suggestion" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

      const result = await updateSuggestion("sug-1", {});

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── deleteSuggestion ───────────────────────────────────────────

  describe("deleteSuggestion", () => {
    it("sends DELETE to /api/admin/suggestions/:id", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: "sug-1", deleted: true } })
      );

      await deleteSuggestion("sug-1");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/suggestions/sug-1");
      expect(init.method).toBe("DELETE");
    });

    it("returns data on successful response", async () => {
      const data = { data: { id: "sug-1", deleted: true } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(data));

      const result = await deleteSuggestion("sug-1");

      expect(result).toEqual(data);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Not found" }, false)
      );

      const result = await deleteSuggestion("sug-99");

      expect(result).toEqual({ error: "Not found" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await deleteSuggestion("sug-1");

      expect(result).toEqual({ error: "Failed to delete suggestion" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const result = await deleteSuggestion("sug-1");

      expect(result).toEqual({ error: "Network error" });
    });
  });
});
