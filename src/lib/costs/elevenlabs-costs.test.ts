import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchElevenLabsCosts, fetchElevenLabsCostsByDay } from "./elevenlabs-costs";

describe("elevenlabs-costs", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("fetchElevenLabsCosts", () => {
    it("returns null when ELEVENLABS_API_KEY is not set", async () => {
      delete process.env.ELEVENLABS_API_KEY;

      const result = await fetchElevenLabsCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });

    it("returns estimated cost based on character usage", async () => {
      process.env.ELEVENLABS_API_KEY = "test-key";

      const mockResponse = {
        character_count: 10000, // 10k characters used
        character_limit: 100000,
        can_extend_character_limit: true,
        allowed_to_extend_character_limit: true,
        next_character_count_reset_unix: 1704067200,
        voice_limit: 10,
        max_voice_add_edits: 5,
        voice_add_edit_counter: 0,
        professional_voice_limit: 0,
        can_extend_voice_limit: false,
        can_use_instant_voice_cloning: true,
        can_use_professional_voice_cloning: false,
        currency: "usd",
        status: "active",
        billing_period: {
          start_unix: 1704067200, // Jan 1, 2024
          end_unix: 1706745600, // Feb 1, 2024
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchElevenLabsCosts("2024-01-01", "2024-01-31");

      expect(result).not.toBeNull();
      expect(result?.serviceId).toBe("elevenlabs");
      expect(result?.serviceName).toBe("ElevenLabs");
      expect(result?.category).toBe("ai");
      expect(result?.source).toBe("estimate");
      // 10000 chars / 1000 * $0.30 = $3.00
      expect(result?.costUsd).toBe(3.0);
      expect(result?.costFormatted).toBe("$3.00");
      expect(result?.notes).toContain("90,000 / 100,000 credits remaining");
      expect(result?.notes).toContain("10% used");
    });

    it("returns null when API returns error", async () => {
      process.env.ELEVENLABS_API_KEY = "test-key";

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      const result = await fetchElevenLabsCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });

    it("returns null when fetch throws error", async () => {
      process.env.ELEVENLABS_API_KEY = "test-key";

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await fetchElevenLabsCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });

    it("uses billing period from API response", async () => {
      process.env.ELEVENLABS_API_KEY = "test-key";

      const mockResponse = {
        character_count: 5000,
        character_limit: 100000,
        can_extend_character_limit: true,
        allowed_to_extend_character_limit: true,
        next_character_count_reset_unix: 1704067200,
        voice_limit: 10,
        max_voice_add_edits: 5,
        voice_add_edit_counter: 0,
        professional_voice_limit: 0,
        can_extend_voice_limit: false,
        can_use_instant_voice_cloning: true,
        can_use_professional_voice_cloning: false,
        currency: "usd",
        status: "active",
        billing_period: {
          start_unix: 1704067200, // Jan 1, 2024 00:00:00 UTC
          end_unix: 1706745600, // Feb 1, 2024 00:00:00 UTC
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchElevenLabsCosts("2024-01-01", "2024-01-31");

      expect(result?.billingPeriodStart).toBe("2024-01-01");
      expect(result?.billingPeriodEnd).toBe("2024-02-01");
    });
  });

  describe("fetchElevenLabsCostsByDay", () => {
    it("always returns empty array (no daily breakdown available)", async () => {
      process.env.ELEVENLABS_API_KEY = "test-key";

      const result = await fetchElevenLabsCostsByDay("2024-01-01", "2024-01-31");

      expect(result).toEqual([]);
    });
  });
});
