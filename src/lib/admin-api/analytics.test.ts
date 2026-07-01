import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAnalytics,
  fetchElevenLabsAnalytics,
  fetchStripeAnalytics,
  fetchGithubAnalytics,
  syncGithubTraffic,
} from "./analytics";

const ORIGIN = "https://paisaxe.es";

describe("admin-api/analytics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock window.location.origin for URL construction
    Object.defineProperty(window, "location", {
      value: { origin: ORIGIN },
      writable: true,
    });
  });

  // ---------------------------------------------------------------------------
  // fetchAnalytics
  // ---------------------------------------------------------------------------
  describe("fetchAnalytics", () => {
    it("fetches from /api/admin/analytics and returns data on success", async () => {
      const mockData = { visitors: 100, pageViews: 500 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockData }),
      });

      const result = await fetchAnalytics();

      expect(fetch).toHaveBeenCalledWith(
        `${ORIGIN}/api/admin/analytics`
      );
      expect(result).toEqual({ data: mockData });
    });

    it("appends from and to query params when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchAnalytics("2026-01-01", "2026-01-31");

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.get("from")).toBe("2026-01-01");
      expect(url.searchParams.get("to")).toBe("2026-01-31");
    });

    it("does not append query params when from/to are undefined", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchAnalytics();

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.has("from")).toBe(false);
      expect(url.searchParams.has("to")).toBe(false);
      expect(url.searchParams.has("includeLocalhost")).toBe(false);
    });

    it("appends includeLocalhost=true when includeLocalhost is true", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchAnalytics(undefined, undefined, true);

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.get("includeLocalhost")).toBe("true");
    });

    it("does not append includeLocalhost when it is false", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchAnalytics(undefined, undefined, false);

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.has("includeLocalhost")).toBe(false);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      const result = await fetchAnalytics();

      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns default error message when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await fetchAnalytics();

      expect(result).toEqual({ error: "Failed to fetch analytics" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network down"));

      const result = await fetchAnalytics();

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await fetchAnalytics();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ---------------------------------------------------------------------------
  // fetchElevenLabsAnalytics
  // ---------------------------------------------------------------------------
  describe("fetchElevenLabsAnalytics", () => {
    it("fetches from /api/admin/elevenlabs-analytics and returns data on success", async () => {
      const mockData = { totalCalls: 42, totalMinutes: 120 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockData }),
      });

      const result = await fetchElevenLabsAnalytics();

      expect(fetch).toHaveBeenCalledWith(
        `${ORIGIN}/api/admin/elevenlabs-analytics`
      );
      expect(result).toEqual({ data: mockData });
    });

    it("appends from and to query params when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchElevenLabsAnalytics("2026-02-01", "2026-02-28");

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.get("from")).toBe("2026-02-01");
      expect(url.searchParams.get("to")).toBe("2026-02-28");
    });

    it("does not append query params when from/to are undefined", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchElevenLabsAnalytics();

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.has("from")).toBe(false);
      expect(url.searchParams.has("to")).toBe(false);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Service unavailable" }),
      });

      const result = await fetchElevenLabsAnalytics();

      expect(result).toEqual({ error: "Service unavailable" });
    });

    it("returns default error message when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await fetchElevenLabsAnalytics();

      expect(result).toEqual({ error: "Failed to fetch ElevenLabs analytics" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      const result = await fetchElevenLabsAnalytics();

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await fetchElevenLabsAnalytics();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ---------------------------------------------------------------------------
  // fetchStripeAnalytics
  // ---------------------------------------------------------------------------
  describe("fetchStripeAnalytics", () => {
    it("fetches from /api/admin/stripe-analytics and returns data on success", async () => {
      const mockData = { totalRevenue: 250, transactionCount: 10 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockData }),
      });

      const result = await fetchStripeAnalytics();

      expect(fetch).toHaveBeenCalledWith(
        `${ORIGIN}/api/admin/stripe-analytics`
      );
      expect(result).toEqual({ data: mockData, warning: undefined });
    });

    it("returns warning alongside data when present in response", async () => {
      const mockData = { totalRevenue: 100 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: mockData,
            warning: "Some charges may be missing",
          }),
      });

      const result = await fetchStripeAnalytics();

      expect(result).toEqual({
        data: mockData,
        warning: "Some charges may be missing",
      });
    });

    it("appends from and to query params when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchStripeAnalytics("2026-01-01", "2026-01-31");

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.get("from")).toBe("2026-01-01");
      expect(url.searchParams.get("to")).toBe("2026-01-31");
    });

    it("does not append query params when from/to are undefined", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchStripeAnalytics();

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.has("from")).toBe(false);
      expect(url.searchParams.has("to")).toBe(false);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Stripe API error" }),
      });

      const result = await fetchStripeAnalytics();

      expect(result).toEqual({ error: "Stripe API error" });
    });

    it("returns default error message when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await fetchStripeAnalytics();

      expect(result).toEqual({ error: "Failed to fetch Stripe analytics" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const result = await fetchStripeAnalytics();

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await fetchStripeAnalytics();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ---------------------------------------------------------------------------
  // fetchGithubAnalytics
  // ---------------------------------------------------------------------------
  describe("fetchGithubAnalytics", () => {
    it("fetches from /api/admin/github-analytics and returns data on success", async () => {
      const mockData = { views: 300, clones: 15 };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockData }),
      });

      const result = await fetchGithubAnalytics();

      expect(fetch).toHaveBeenCalledWith(
        `${ORIGIN}/api/admin/github-analytics`
      );
      expect(result).toEqual({ data: mockData });
    });

    it("appends from and to query params when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchGithubAnalytics("2026-01-15", "2026-02-15");

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.get("from")).toBe("2026-01-15");
      expect(url.searchParams.get("to")).toBe("2026-02-15");
    });

    it("does not append query params when from/to are undefined", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await fetchGithubAnalytics();

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const url = new URL(calledUrl);
      expect(url.searchParams.has("from")).toBe(false);
      expect(url.searchParams.has("to")).toBe(false);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Rate limited" }),
      });

      const result = await fetchGithubAnalytics();

      expect(result).toEqual({ error: "Rate limited" });
    });

    it("returns default error message when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await fetchGithubAnalytics();

      expect(result).toEqual({ error: "Failed to fetch GitHub analytics" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("DNS resolution failed"));

      const result = await fetchGithubAnalytics();

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await fetchGithubAnalytics();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ---------------------------------------------------------------------------
  // syncGithubTraffic
  // ---------------------------------------------------------------------------
  describe("syncGithubTraffic", () => {
    it("sends POST to /api/cron/github-traffic-sync and returns data on success", async () => {
      const mockResponse = { synced: true, syncedAt: "2026-02-10T12:00:00Z" };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await syncGithubTraffic();

      expect(fetch).toHaveBeenCalledWith(
        "/api/cron/github-traffic-sync",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(result).toEqual({ data: mockResponse });
    });

    it("uses POST method with Content-Type application/json header", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ synced: true, syncedAt: "" }),
      });

      await syncGithubTraffic();

      const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({ "Content-Type": "application/json" });
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Cron auth failed" }),
      });

      const result = await syncGithubTraffic();

      expect(result).toEqual({ error: "Cron auth failed" });
    });

    it("returns default error message when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await syncGithubTraffic();

      expect(result).toEqual({ error: "Failed to sync GitHub traffic" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

      const result = await syncGithubTraffic();

      expect(result).toEqual({ error: "Network error" });
    });

    it("returns network error when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("plain string failure");

      const result = await syncGithubTraffic();

      expect(result).toEqual({ error: "Network error" });
    });
  });
});
