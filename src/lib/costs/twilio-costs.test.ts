import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchTwilioCosts } from "./twilio-costs";

describe("twilio-costs", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("fetchTwilioCosts", () => {
    it("returns null when credentials are not set", async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      const result = await fetchTwilioCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });

    it("returns null when only SID is set", async () => {
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      delete process.env.TWILIO_AUTH_TOKEN;

      const result = await fetchTwilioCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });

    it("returns cost data when API responds successfully", async () => {
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      process.env.TWILIO_AUTH_TOKEN = "token123";

      const mockResponse = {
        usage_records: [
          { category: "sms", description: "SMS", price: "5.00", price_unit: "USD", count: "100", usage: "100", usage_unit: "messages" },
          { category: "voice", description: "Voice", price: "10.50", price_unit: "USD", count: "50", usage: "50", usage_unit: "minutes" },
        ],
        end: 0,
        first_page_uri: "",
        next_page_uri: null,
        page: 0,
        page_size: 50,
        previous_page_uri: null,
        start: 0,
        uri: "",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchTwilioCosts("2024-01-01", "2024-01-31");

      expect(result).not.toBeNull();
      expect(result?.serviceId).toBe("twilio");
      expect(result?.serviceName).toBe("Twilio");
      expect(result?.category).toBe("communications");
      expect(result?.costUsd).toBe(15.5); // 5.00 + 10.50
      expect(result?.source).toBe("api");
      expect(result?.costFormatted).toBe("$15.50");
    });

    it("handles zero cost records", async () => {
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      process.env.TWILIO_AUTH_TOKEN = "token123";

      const mockResponse = {
        usage_records: [
          { category: "sms", description: "SMS", price: "0.00", price_unit: "USD", count: "0", usage: "0", usage_unit: "messages" },
        ],
        end: 0,
        first_page_uri: "",
        next_page_uri: null,
        page: 0,
        page_size: 50,
        previous_page_uri: null,
        start: 0,
        uri: "",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchTwilioCosts("2024-01-01", "2024-01-31");

      expect(result).not.toBeNull();
      expect(result?.costUsd).toBe(0);
    });

    it("returns null when API returns error", async () => {
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      process.env.TWILIO_AUTH_TOKEN = "token123";

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Authentication Error"),
      });

      const result = await fetchTwilioCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });

    it("returns null when fetch throws error", async () => {
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      process.env.TWILIO_AUTH_TOKEN = "token123";

      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await fetchTwilioCosts("2024-01-01", "2024-01-31");

      expect(result).toBeNull();
    });

    it("uses correct Basic auth header", async () => {
      process.env.TWILIO_ACCOUNT_SID = "AC123";
      process.env.TWILIO_AUTH_TOKEN = "token123";

      const mockResponse = {
        usage_records: [],
        end: 0,
        first_page_uri: "",
        next_page_uri: null,
        page: 0,
        page_size: 50,
        previous_page_uri: null,
        start: 0,
        uri: "",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await fetchTwilioCosts("2024-01-01", "2024-01-31");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("AC123/Usage/Records.json"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
    });
  });
});
