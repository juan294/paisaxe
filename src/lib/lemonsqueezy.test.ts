import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createDayPassCheckoutUrl,
  verifyWebhookSignature,
  parseOrderWebhook,
  getPurchaseTypeFromVariant,
  calculateExpiryDate,
  isLemonSqueezyConfigured,
  formatPrice,
} from "./lemonsqueezy";

describe("lemonsqueezy", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("createDayPassCheckoutUrl", () => {
    it("should create a checkout URL with all parameters", () => {
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID", "paisaxe");
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID", "123456");

      const url = createDayPassCheckoutUrl({
        userId: "user-123",
        userEmail: "test@example.com",
        successUrl: "https://paisaxe.es/pricing/success",
      });

      expect(url).toContain("https://paisaxe.lemonsqueezy.com/checkout/buy/123456");
      expect(url).toContain("checkout%5Bemail%5D=test%40example.com");
      expect(url).toContain("checkout%5Bcustom%5D%5Buser_id%5D=user-123");
      expect(url).toContain("checkout%5Bredirect_url%5D=https%3A%2F%2Fpaisaxe.es%2Fpricing%2Fsuccess");
    });

    it("should throw error when config is missing", () => {
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID", "");
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID", "");

      expect(() =>
        createDayPassCheckoutUrl({
          userId: "user-123",
          userEmail: "test@example.com",
        })
      ).toThrow("Lemon Squeezy configuration missing");
    });
  });

  describe("verifyWebhookSignature", () => {
    beforeEach(() => {
      vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", "test-secret");
    });

    it("should return true for valid signature", async () => {
      // Pre-computed HMAC-SHA256 of "test-payload" with key "test-secret"
      const payload = "test-payload";
      // Generate expected signature
      const crypto = await import("crypto");
      const expectedSignature = crypto
        .createHmac("sha256", "test-secret")
        .update(payload)
        .digest("hex");

      const result = await verifyWebhookSignature(payload, expectedSignature);
      expect(result).toBe(true);
    });

    it("should return false for invalid signature", async () => {
      const result = await verifyWebhookSignature("test-payload", "invalid-signature");
      expect(result).toBe(false);
    });

    it("should return false when secret is not configured", async () => {
      vi.stubEnv("LEMONSQUEEZY_WEBHOOK_SECRET", "");
      const result = await verifyWebhookSignature("test-payload", "any-signature");
      expect(result).toBe(false);
    });

    it("should return false for empty signature", async () => {
      const result = await verifyWebhookSignature("test-payload", "");
      expect(result).toBe(false);
    });
  });

  describe("parseOrderWebhook", () => {
    const validWebhook = {
      meta: {
        event_name: "order_created",
        custom_data: {
          user_id: "user-123",
        },
      },
      data: {
        id: "order-456",
        type: "orders",
        attributes: {
          first_order_item: {
            variant_id: 123456,
            product_id: 789,
            product_name: "Voice Day Pass",
            variant_name: "Default",
          },
          status: "paid",
          total: 199,
          currency: "EUR",
          user_email: "test@example.com",
          user_name: "Test User",
          created_at: "2024-01-01T00:00:00Z",
        },
      },
    };

    it("should parse valid webhook payload", () => {
      const result = parseOrderWebhook(validWebhook);
      expect(result).toEqual(validWebhook);
    });

    it("should return null for invalid payload", () => {
      expect(parseOrderWebhook(null)).toBe(null);
      expect(parseOrderWebhook(undefined)).toBe(null);
      expect(parseOrderWebhook("string")).toBe(null);
      expect(parseOrderWebhook(123)).toBe(null);
    });

    it("should return null when meta is missing", () => {
      const invalid = { data: validWebhook.data };
      expect(parseOrderWebhook(invalid)).toBe(null);
    });

    it("should return null when event_name is missing", () => {
      const invalid = {
        meta: { custom_data: {} },
        data: validWebhook.data,
      };
      expect(parseOrderWebhook(invalid)).toBe(null);
    });

    it("should return null when data is missing", () => {
      const invalid = { meta: validWebhook.meta };
      expect(parseOrderWebhook(invalid)).toBe(null);
    });

    it("should return null when data.id is missing", () => {
      const invalid = {
        meta: validWebhook.meta,
        data: { ...validWebhook.data, id: undefined },
      };
      expect(parseOrderWebhook(invalid)).toBe(null);
    });
  });

  describe("getPurchaseTypeFromVariant", () => {
    it("should return day_pass for matching variant ID", () => {
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID", "123456");
      expect(getPurchaseTypeFromVariant(123456)).toBe("day_pass");
    });

    it("should return null for non-matching variant ID", () => {
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID", "123456");
      expect(getPurchaseTypeFromVariant(999999)).toBe(null);
    });

    it("should return null when env is not set", () => {
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID", "");
      expect(getPurchaseTypeFromVariant(123456)).toBe(null);
    });
  });

  describe("calculateExpiryDate", () => {
    it("should return date 24 hours in future for day_pass", () => {
      const before = Date.now();
      const expiry = calculateExpiryDate("day_pass");
      const after = Date.now();

      const expectedMs = 24 * 60 * 60 * 1000;
      expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
      expect(expiry.getTime()).toBeLessThanOrEqual(after + expectedMs);
    });
  });

  describe("isLemonSqueezyConfigured", () => {
    it("should return true when all config is present", () => {
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID", "paisaxe");
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID", "123456");
      expect(isLemonSqueezyConfigured()).toBe(true);
    });

    it("should return false when store ID is missing", () => {
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID", "");
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID", "123456");
      expect(isLemonSqueezyConfigured()).toBe(false);
    });

    it("should return false when variant ID is missing", () => {
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID", "paisaxe");
      vi.stubEnv("NEXT_PUBLIC_LEMONSQUEEZY_DAY_PASS_VARIANT_ID", "");
      expect(isLemonSqueezyConfigured()).toBe(false);
    });
  });

  describe("formatPrice", () => {
    it("should format EUR price correctly", () => {
      const formatted = formatPrice(199, "EUR");
      expect(formatted).toContain("1");
      expect(formatted).toContain("99");
    });

    it("should format USD price correctly", () => {
      const formatted = formatPrice(299, "USD");
      expect(formatted).toContain("2");
      expect(formatted).toContain("99");
    });
  });
});
