import { describe, it, expect, vi, beforeEach } from "vitest";

// Set env vars before imports
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123");

// Mock Stripe library
const mockRetrieve = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(() => ({
    prices: {
      retrieve: mockRetrieve,
    },
  })),
  isStripeConfigured: vi.fn(() => true),
}));

import { GET } from "./route";

describe("GET /api/checkout/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123");
  });

  it("should return healthy when Stripe is fully configured and price is active", async () => {
    mockRetrieve.mockResolvedValue({
      id: "price_123",
      active: true,
      unit_amount: 199,
      currency: "eur",
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.checks.envVars).toBe("ok");
    expect(data.checks.priceActive).toBe("ok");
    expect(data.checks.webhookSecret).toBe("ok");
    expect(data.price).toEqual({
      id: "price_123",
      active: true,
      amount: 199,
      currency: "eur",
    });
  });

  it("should return degraded when STRIPE_SECRET_KEY is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.checks.envVars).toBe("fail");
    expect(data.missing).toContain("STRIPE_SECRET_KEY");
  });

  it("should return degraded when STRIPE_DAY_PASS_PRICE_ID is missing", async () => {
    vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.checks.envVars).toBe("fail");
    expect(data.missing).toContain("STRIPE_DAY_PASS_PRICE_ID");
  });

  it("should return degraded when webhook secret is missing", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    mockRetrieve.mockResolvedValue({
      id: "price_123",
      active: true,
      unit_amount: 199,
      currency: "eur",
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.checks.webhookSecret).toBe("fail");
  });

  it("should return degraded when price is inactive", async () => {
    mockRetrieve.mockResolvedValue({
      id: "price_123",
      active: false,
      unit_amount: 199,
      currency: "eur",
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.checks.priceActive).toBe("fail");
  });

  it("should return degraded when Stripe API is unreachable", async () => {
    mockRetrieve.mockRejectedValue(new Error("Connection refused"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.checks.priceActive).toBe("fail");
  });
});
