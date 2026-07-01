import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchFeatureFlags,
  updateFeatureFlag,
  updateFeatureFlagConfig,
} from "./feature-flags";

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("admin-api/feature-flags", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  // ─── fetchFeatureFlags ───────────────────────────────────────────

  describe("fetchFeatureFlags", () => {
    it("sends GET to /api/feature-flags with cache bypass", async () => {
      const mockData = [{ flagKey: "visitor_voice_agent", enabled: true }];
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: mockData })
      );

      const result = await fetchFeatureFlags();

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/feature-flags");
      expect(init?.cache).toBe("no-store");
      expect(result).toEqual({ data: mockData });
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Unauthorized" }, false)
      );

      const result = await fetchFeatureFlags();

      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await fetchFeatureFlags();

      expect(result).toEqual({ error: "Failed to fetch feature flags" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      const result = await fetchFeatureFlags();

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await fetchFeatureFlags();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateFeatureFlag ───────────────────────────────────────────

  describe("updateFeatureFlag", () => {
    it("sends PUT with enabled boolean to /api/admin/feature-flags/:key", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { flagKey: "visitor_voice_agent", enabled: true } })
      );

      await updateFeatureFlag("visitor_voice_agent", true);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/feature-flags/visitor_voice_agent");
      expect(init.method).toBe("PUT");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body)).toEqual({ enabled: true });
    });

    it("sends enabled=false when toggling off", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { flagKey: "visitor_voice_agent", enabled: false } })
      );

      await updateFeatureFlag("visitor_voice_agent", false);

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({ enabled: false });
    });

    it("returns data on successful response", async () => {
      const responseData = { data: { flagKey: "visitor_voice_agent", enabled: true } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(responseData));

      const result = await updateFeatureFlag("visitor_voice_agent", true);

      expect(result).toEqual(responseData);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Flag not found" }, false)
      );

      const result = await updateFeatureFlag("visitor_voice_agent", true);

      expect(result).toEqual({ error: "Flag not found" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateFeatureFlag("visitor_voice_agent", true);

      expect(result).toEqual({ error: "Failed to update feature flag" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

      const result = await updateFeatureFlag("visitor_voice_agent", true);

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await updateFeatureFlag("visitor_voice_agent", true);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateFeatureFlagConfig ─────────────────────────────────────

  describe("updateFeatureFlagConfig", () => {
    const mockConfig = {
      whitelisted_emails: ["user@example.com"],
      agent_id: "agent-abc",
    };

    it("sends PUT with config object to /api/admin/feature-flags/:key", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { flagKey: "visitor_voice_agent", config: mockConfig } })
      );

      await updateFeatureFlagConfig("visitor_voice_agent", mockConfig);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/feature-flags/visitor_voice_agent");
      expect(init.method).toBe("PUT");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body)).toEqual({ config: mockConfig });
    });

    it("returns data on successful response", async () => {
      const responseData = { data: { flagKey: "visitor_voice_agent", config: mockConfig } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(responseData));

      const result = await updateFeatureFlagConfig("visitor_voice_agent", mockConfig);

      expect(result).toEqual(responseData);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "config must be an object" }, false)
      );

      const result = await updateFeatureFlagConfig("visitor_voice_agent", mockConfig);

      expect(result).toEqual({ error: "config must be an object" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateFeatureFlagConfig("visitor_voice_agent", mockConfig);

      expect(result).toEqual({ error: "Failed to update feature flag config" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const result = await updateFeatureFlagConfig("visitor_voice_agent", mockConfig);

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await updateFeatureFlagConfig("visitor_voice_agent", mockConfig);

      expect(result).toEqual({ error: "Network error" });
    });
  });
});
