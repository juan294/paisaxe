import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerOptimizerRun } from "./optimizer";

describe("triggerOptimizerRun", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST to the cron endpoint and returns data on success", async () => {
    const mockResponse = {
      success: true,
      analyzedAt: "2026-02-09T10:00:00.000Z",
      totalMonthlySpend: 59.41,
      report: "# Report",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await triggerOptimizerRun();

    expect(fetch).toHaveBeenCalledWith(
      "/api/cron/subscription-optimizer",
      expect.objectContaining({ method: "POST" })
    );
    expect(result).toEqual({ data: mockResponse });
  });

  it("passes usage metrics in the request body when provided", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const metrics = { voiceMinutes: 30, visitors: 10000 };
    await triggerOptimizerRun(metrics);

    expect(fetch).toHaveBeenCalledWith(
      "/api/cron/subscription-optimizer",
      expect.objectContaining({
        body: JSON.stringify({ usageMetrics: metrics }),
      })
    );
  });

  it("returns error on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Auth failed" }),
    });

    const result = await triggerOptimizerRun();

    expect(result).toEqual({ error: "Auth failed" });
  });

  it("returns error on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network down"));

    const result = await triggerOptimizerRun();

    expect(result).toEqual({ error: "Network error" });
  });

  it("returns error on network failure with a non-Error value", async () => {
    global.fetch = vi.fn().mockRejectedValue("plain string failure");

    const result = await triggerOptimizerRun();

    expect(result).toEqual({ error: "Network error" });
  });

  it("returns fallback error message when response has no error field", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    const result = await triggerOptimizerRun();

    expect(result).toEqual({ error: "Failed to run optimizer" });
  });
});
