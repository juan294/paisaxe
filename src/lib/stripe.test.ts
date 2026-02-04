import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isStripeConfigured,
  calculateExpiryDate,
  formatPrice,
} from "./stripe";

describe("stripe", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isStripeConfigured", () => {
    it("should return true when all config is present", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");
      expect(isStripeConfigured()).toBe(true);
    });

    it("should return false when secret key is missing", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");
      expect(isStripeConfigured()).toBe(false);
    });

    it("should return false when price ID is missing", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "");
      expect(isStripeConfigured()).toBe(false);
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
