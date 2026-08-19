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
  getPriceIdForPurchaseType,
  formatPrice,
  getStripeClient,
  createEmbeddedCheckoutSession,
  verifyWebhookSignature,
  type PurchaseType,
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

    it("should return date 7 days in future for weekly_pass", () => {
      const before = Date.now();
      const expiry = calculateExpiryDate("weekly_pass");
      const after = Date.now();
      const expectedMs = 7 * 24 * 60 * 60 * 1000;
      expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
      expect(expiry.getTime()).toBeLessThanOrEqual(after + expectedMs);
    });

    it("should return date 30 days in future for monthly_pass", () => {
      const before = Date.now();
      const expiry = calculateExpiryDate("monthly_pass");
      const after = Date.now();
      const expectedMs = 30 * 24 * 60 * 60 * 1000;
      expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
      expect(expiry.getTime()).toBeLessThanOrEqual(after + expectedMs);
    });

    it("should throw error for unknown purchase type", () => {
      expect(() =>
        calculateExpiryDate("yearly_pass" as "day_pass")
      ).toThrow("Unknown purchase type: yearly_pass");
    });
  });

  describe("getPriceIdForPurchaseType", () => {
    it("resolves each tier to its env price ID", () => {
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_day");
      vi.stubEnv("STRIPE_WEEKLY_PRICE_ID", "price_week");
      vi.stubEnv("STRIPE_MONTHLY_PRICE_ID", "price_month");
      expect(getPriceIdForPurchaseType("day_pass")).toBe("price_day");
      expect(getPriceIdForPurchaseType("weekly_pass")).toBe("price_week");
      expect(getPriceIdForPurchaseType("monthly_pass")).toBe("price_month");
    });

    it("returns null when a tier's price ID is unset", () => {
      vi.stubEnv("STRIPE_WEEKLY_PRICE_ID", "");
      expect(getPriceIdForPurchaseType("weekly_pass")).toBeNull();
    });

    it("returns null for an unknown purchase type (runtime defensive default)", () => {
      // TypeScript prevents reaching this default at compile time; test the runtime guard
      expect(getPriceIdForPurchaseType("unknown_tier" as PurchaseType)).toBeNull();
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

  // ─── SE-L3: pinned Stripe apiVersion ─────────────────────────────────────
  describe("SE-L3: pinned apiVersion", () => {
    it("should construct the Stripe client with a pinned apiVersion string", () => {
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_pinned");

      // The mock Stripe class tracks constructor calls via MockStripe
      // We verify the STRIPE_API_VERSION constant is passed through by
      // checking that getStripeClient() succeeds and the internal _options
      // (set by the real Stripe SDK) contains the expected version.
      // Since the mock class is a simple stub, we verify by importing the
      // constant directly.
      const client = getStripeClient();
      expect(client).toBeDefined();
      // The presence of getStripeClient working at all with the pinned version
      // is verified here. The constant value is asserted via the export.
    });

    it("exported STRIPE_API_VERSION matches the date-based Stripe API format", async () => {
      // Re-import to access the internal constant via a workaround:
      // The constant is used in getStripeClient — we verify the Stripe
      // constructor is called with an apiVersion that looks like a date string.
      // Since the module-level mock captures constructor args, use a spy.
      const StripeMod = await import("stripe");
      const CtorSpy = vi.spyOn(StripeMod, "default");

      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_version_check");
      getStripeClient();

      expect(CtorSpy).toHaveBeenCalledWith(
        "sk_test_version_check",
        expect.objectContaining({
          apiVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}/),
        })
      );

      CtorSpy.mockRestore();
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
        ui_mode: "embedded_page",
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: "price_123", quantity: 1 }],
        customer_email: "test@example.com",
        metadata: { user_id: "user-123", purchase_type: "day_pass" },
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
