import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only (stripe.ts imports it to prevent client-side usage)
vi.mock("server-only", () => ({}));

// Define mock functions that will be set up in vi.mock
const mockCreate = vi.fn();
const mockConstructEvent = vi.fn();

// Mock Stripe before importing the module
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          create: mockCreate,
        },
      };
      webhooks = {
        constructEvent: mockConstructEvent,
      };
    },
  };
});

import {
  isStripeConfigured,
  calculateExpiryDate,
  formatPrice,
  getStripeClient,
  createDayPassCheckoutSession,
  createEmbeddedCheckoutSession,
  verifyWebhookSignature,
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

    it("should throw error for unknown purchase type", () => {
      expect(() =>
        calculateExpiryDate("weekly_pass" as "day_pass")
      ).toThrow("Unknown purchase type: weekly_pass");
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

  describe("getStripeClient", () => {
    it("should throw error when STRIPE_SECRET_KEY is missing", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "");
      expect(() => getStripeClient()).toThrow("STRIPE_SECRET_KEY not configured");
    });

    it("should return Stripe client when configured", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      const client = getStripeClient();
      expect(client).toBeDefined();
    });
  });

  describe("createDayPassCheckoutSession", () => {
    beforeEach(() => {
      mockCreate.mockReset();
    });

    it("should throw error when STRIPE_DAY_PASS_PRICE_ID is missing", async () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "");

      await expect(
        createDayPassCheckoutSession({
          userId: "user-123",
          userEmail: "test@example.com",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        })
      ).rejects.toThrow("STRIPE_DAY_PASS_PRICE_ID not configured");
    });

    it("should create checkout session with correct parameters", async () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");

      mockCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/session123",
      });

      const url = await createDayPassCheckoutSession({
        userId: "user-123",
        userEmail: "test@example.com",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      });

      expect(url).toBe("https://checkout.stripe.com/session123");
      expect(mockCreate).toHaveBeenCalledWith({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: "price_123", quantity: 1 }],
        customer_email: "test@example.com",
        metadata: { user_id: "user-123" },
        success_url: "https://example.com/success",
        cancel_url: "https://example.com/cancel",
      });
    });

    it("should throw error when session URL is not returned", async () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");

      mockCreate.mockResolvedValue({ url: null });

      await expect(
        createDayPassCheckoutSession({
          userId: "user-123",
          userEmail: "test@example.com",
          successUrl: "https://example.com/success",
          cancelUrl: "https://example.com/cancel",
        })
      ).rejects.toThrow("Failed to create checkout session - no URL returned");
    });
  });

  describe("createEmbeddedCheckoutSession", () => {
    beforeEach(() => {
      mockCreate.mockReset();
    });

    it("should throw error when STRIPE_DAY_PASS_PRICE_ID is missing", async () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "");

      await expect(
        createEmbeddedCheckoutSession({
          userId: "user-123",
          userEmail: "test@example.com",
          returnUrl: "https://example.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
        })
      ).rejects.toThrow("STRIPE_DAY_PASS_PRICE_ID not configured");
    });

    it("should create embedded checkout session with correct parameters", async () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");

      mockCreate.mockResolvedValue({
        client_secret: "cs_test_secret_123",
      });

      const clientSecret = await createEmbeddedCheckoutSession({
        userId: "user-123",
        userEmail: "test@example.com",
        returnUrl: "https://example.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      });

      expect(clientSecret).toBe("cs_test_secret_123");
      expect(mockCreate).toHaveBeenCalledWith({
        ui_mode: "embedded",
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: "price_123", quantity: 1 }],
        customer_email: "test@example.com",
        metadata: { user_id: "user-123" },
        return_url: "https://example.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      });
    });

    it("should throw error when client_secret is not returned", async () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");

      mockCreate.mockResolvedValue({ client_secret: null });

      await expect(
        createEmbeddedCheckoutSession({
          userId: "user-123",
          userEmail: "test@example.com",
          returnUrl: "https://example.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
        })
      ).rejects.toThrow("Failed to create embedded checkout session - no client_secret returned");
    });
  });

  describe("verifyWebhookSignature", () => {
    beforeEach(() => {
      mockConstructEvent.mockReset();
    });

    it("should throw error when STRIPE_WEBHOOK_SECRET is missing", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

      expect(() => verifyWebhookSignature("payload", "sig123")).toThrow(
        "STRIPE_WEBHOOK_SECRET not configured"
      );
    });

    it("should verify webhook signature and return event", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");

      const mockEvent = {
        type: "checkout.session.completed",
        data: { object: {} },
      };
      mockConstructEvent.mockReturnValue(mockEvent);

      const event = verifyWebhookSignature("payload", "sig123");

      expect(event).toBe(mockEvent);
      expect(mockConstructEvent).toHaveBeenCalledWith(
        "payload",
        "sig123",
        "whsec_123"
      );
    });

    it("should trim STRIPE_WEBHOOK_SECRET to handle invisible characters", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "  whsec_123\n");

      const mockEvent = {
        type: "checkout.session.completed",
        data: { object: {} },
      };
      mockConstructEvent.mockReturnValue(mockEvent);

      verifyWebhookSignature("payload", "sig123");

      // Should be called with trimmed secret, not the raw value with whitespace
      expect(mockConstructEvent).toHaveBeenCalledWith(
        "payload",
        "sig123",
        "whsec_123"
      );
    });
  });
});
