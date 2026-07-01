import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchCostsAnalytics,
  createManualCostEntry,
  updateManualCostEntry,
  deleteManualCostEntry,
} from "./costs";

const ORIGIN = "https://paisaxe.es";

function mockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("admin-api/costs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      value: { origin: ORIGIN },
      writable: true,
    });
  });

  // ─── fetchCostsAnalytics ─────────────────────────────────────────

  describe("fetchCostsAnalytics", () => {
    it("sends GET to /api/admin/costs-analytics", async () => {
      const mockData = { totalCost: 150 };
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: mockData }));

      const result = await fetchCostsAnalytics();

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe(`${ORIGIN}/api/admin/costs-analytics`);
      expect(result).toEqual({ data: mockData });
    });

    it("appends from and to query params when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: {} }));

      await fetchCostsAnalytics("2026-01-01", "2026-01-31");

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.get("from")).toBe("2026-01-01");
      expect(parsedUrl.searchParams.get("to")).toBe("2026-01-31");
    });

    it("appends includeUsage=true when option is set", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: {} }));

      await fetchCostsAnalytics("2026-01-01", "2026-01-31", { includeUsage: true });

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.get("includeUsage")).toBe("true");
    });

    it("does not append query params when not provided", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({ data: {} }));

      await fetchCostsAnalytics();

      const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.searchParams.has("from")).toBe(false);
      expect(parsedUrl.searchParams.has("to")).toBe(false);
      expect(parsedUrl.searchParams.has("includeUsage")).toBe(false);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Unauthorized" }, false)
      );

      const result = await fetchCostsAnalytics();

      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await fetchCostsAnalytics();

      expect(result).toEqual({ error: "Failed to fetch costs analytics" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network down"));

      const result = await fetchCostsAnalytics();

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── createManualCostEntry ───────────────────────────────────────

  describe("createManualCostEntry", () => {
    const costData = {
      platform: "vercel",
      amount: 20,
      date: "2026-01-15",
      description: "Monthly hosting",
    };

    it("sends POST with JSON body to /api/admin/costs-analytics", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: "c1", ...costData } })
      );

      await createManualCostEntry(costData as never);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/costs-analytics");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body)).toEqual(costData);
    });

    it("returns data on successful response", async () => {
      const responseData = { data: { id: "c1", platform: "vercel" } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(responseData));

      const result = await createManualCostEntry(costData as never);

      expect(result).toEqual(responseData);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Invalid amount" }, false)
      );

      const result = await createManualCostEntry(costData as never);

      expect(result).toEqual({ error: "Invalid amount" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await createManualCostEntry(costData as never);

      expect(result).toEqual({ error: "Failed to create cost entry" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

      const result = await createManualCostEntry(costData as never);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── updateManualCostEntry ───────────────────────────────────────

  describe("updateManualCostEntry", () => {
    it("sends PUT with JSON body to /api/admin/costs-analytics/:id", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: "c1", amount: 30 } })
      );

      await updateManualCostEntry("c1", { amount: 30 } as never);

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/costs-analytics/c1");
      expect(init.method).toBe("PUT");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(init.body)).toEqual({ amount: 30 });
    });

    it("returns data on successful response", async () => {
      const responseData = { data: { id: "c1", amount: 30 } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(responseData));

      const result = await updateManualCostEntry("c1", { amount: 30 } as never);

      expect(result).toEqual(responseData);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Not found" }, false)
      );

      const result = await updateManualCostEntry("c1", { amount: 30 } as never);

      expect(result).toEqual({ error: "Not found" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await updateManualCostEntry("c1", {} as never);

      expect(result).toEqual({ error: "Failed to update cost entry" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection lost"));

      const result = await updateManualCostEntry("c1", {} as never);

      expect(result).toEqual({ error: "Network error" });
    });
  });

  // ─── deleteManualCostEntry ───────────────────────────────────────

  describe("deleteManualCostEntry", () => {
    it("sends DELETE to /api/admin/costs-analytics/:id", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: "c1", deleted: true } })
      );

      await deleteManualCostEntry("c1");

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String(url)).toBe("/api/admin/costs-analytics/c1");
      expect(init.method).toBe("DELETE");
    });

    it("does not send Content-Type header or body", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ data: { id: "c1", deleted: true } })
      );

      await deleteManualCostEntry("c1");

      const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(init.headers).toEqual({});
      expect(init.body).toBeUndefined();
    });

    it("returns data on successful response", async () => {
      const responseData = { data: { id: "c1", deleted: true } };
      global.fetch = vi.fn().mockResolvedValue(mockResponse(responseData));

      const result = await deleteManualCostEntry("c1");

      expect(result).toEqual(responseData);
    });

    it("returns error from response body on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse({ error: "Not found" }, false)
      );

      const result = await deleteManualCostEntry("c1");

      expect(result).toEqual({ error: "Not found" });
    });

    it("returns fallback error when response body has no error field", async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse({}, false));

      const result = await deleteManualCostEntry("c1");

      expect(result).toEqual({ error: "Failed to delete cost entry" });
    });

    it("returns network error when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

      const result = await deleteManualCostEntry("c1");

      expect(result).toEqual({ error: "Network error" });
    });

    it("logs String(error) when fetch throws a non-Error value", async () => {
      global.fetch = vi.fn().mockRejectedValue("non-error string");

      const result = await deleteManualCostEntry("c1");

      expect(result).toEqual({ error: "Network error" });
    });
  });

  describe("non-Error throw coverage for instanceof ternary", () => {
    it("fetchCostsAnalytics logs String(error) when non-Error thrown", async () => {
      global.fetch = vi.fn().mockRejectedValue(42);
      const result = await fetchCostsAnalytics();
      expect(result).toEqual({ error: "Network error" });
    });

    it("createManualCostEntry logs String(error) when non-Error thrown", async () => {
      global.fetch = vi.fn().mockRejectedValue({ code: "ETIMEDOUT" });
      const result = await createManualCostEntry({
        serviceId: "elevenlabs",
        serviceName: "ElevenLabs",
        category: "ai",
        costUsd: 22,
        billingPeriodStart: "2026-06-01",
        billingPeriodEnd: "2026-06-30",
      });
      expect(result).toEqual({ error: "Network error" });
    });

    it("updateManualCostEntry logs String(error) when non-Error thrown", async () => {
      global.fetch = vi.fn().mockRejectedValue(null);
      const result = await updateManualCostEntry("c1", { costUsd: 10 });
      expect(result).toEqual({ error: "Network error" });
    });
  });
});
