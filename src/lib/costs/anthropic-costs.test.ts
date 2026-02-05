import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAnthropicCosts, fetchAnthropicCostsByDay } from "./anthropic-costs";

describe("anthropic-costs", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("fetchAnthropicCosts", () => {
    it("returns null when ANTHROPIC_ADMIN_API_KEY is not set", async () => {
      delete process.env.ANTHROPIC_ADMIN_API_KEY;

      const result = await fetchAnthropicCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });

    it("returns cost data when API responds successfully", async () => {
      process.env.ANTHROPIC_ADMIN_API_KEY = "sk-ant-admin-test";

      const mockResponse = {
        data: [
          { date: "2024-01-01", cost_usd: 10.5, input_tokens: 1000, output_tokens: 500, model: "claude-3" },
          { date: "2024-01-02", cost_usd: 15.25, input_tokens: 1500, output_tokens: 750, model: "claude-3" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchAnthropicCosts("2024-01-01", "2024-01-31");

      expect(result).not.toBeNull();
      expect(result?.serviceId).toBe("anthropic");
      expect(result?.serviceName).toBe("Anthropic Claude");
      expect(result?.category).toBe("ai");
      expect(result?.costUsd).toBe(25.75); // 10.5 + 15.25
      expect(result?.source).toBe("api");
      expect(result?.costFormatted).toBe("$25.75");
    });

    it("returns null when API returns error", async () => {
      process.env.ANTHROPIC_ADMIN_API_KEY = "sk-ant-admin-test";

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      const result = await fetchAnthropicCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });

    it("returns null when fetch throws error", async () => {
      process.env.ANTHROPIC_ADMIN_API_KEY = "sk-ant-admin-test";

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await fetchAnthropicCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });
  });

  describe("fetchAnthropicCostsByDay", () => {
    it("returns empty array when ANTHROPIC_ADMIN_API_KEY is not set", async () => {
      delete process.env.ANTHROPIC_ADMIN_API_KEY;

      const result = await fetchAnthropicCostsByDay("2024-01-01", "2024-01-31");

      expect(result).toEqual([]);
    });

    it("returns daily costs when API responds successfully", async () => {
      process.env.ANTHROPIC_ADMIN_API_KEY = "sk-ant-admin-test";

      const mockResponse = {
        data: [
          { date: "2024-01-01", cost_usd: 10.5, input_tokens: 1000, output_tokens: 500, model: "claude-3" },
          { date: "2024-01-02", cost_usd: 15.25, input_tokens: 1500, output_tokens: 750, model: "claude-3" },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchAnthropicCostsByDay("2024-01-01", "2024-01-31");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ date: "2024-01-01", costUsd: 10.5 });
      expect(result[1]).toEqual({ date: "2024-01-02", costUsd: 15.25 });
    });

    it("returns empty array when API fails", async () => {
      process.env.ANTHROPIC_ADMIN_API_KEY = "sk-ant-admin-test";

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await fetchAnthropicCostsByDay("2024-01-01", "2024-01-31");

      expect(result).toEqual([]);
    });
  });
});
