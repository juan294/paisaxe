import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Set env vars before imports
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123");

// Mock admin auth
vi.mock("@/lib/admin-auth", () => ({
  validateAdminAuth: vi.fn(),
}));

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

import { validateAdminAuth } from "@/lib/admin-auth";
import { GET } from "./route";

describe("GET /api/checkout/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123");
    // Default: auth passes
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: true,
      userId: "admin-user-1",
    });
  });

  it("should return 401 when admin auth fails", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    });

    const response = await GET();
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Authentication required");
  });

  it("should return 403 when user is not admin", async () => {
    vi.mocked(validateAdminAuth).mockResolvedValue({
      valid: false,
      error: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    });

    const response = await GET();
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Admin access required");
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

  it("should use 0 as amount when price.unit_amount is null", async () => {
    mockRetrieve.mockResolvedValue({
      id: "price_123",
      active: true,
      unit_amount: null,
      currency: "eur",
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("healthy");
    expect(data.price.amount).toBe(0);
  });

  it("should show 'Unknown error' when Stripe throws a non-Error value", async () => {
    mockRetrieve.mockRejectedValue("unexpected failure");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.checks.priceActive).toBe("fail");
    expect(data.error).toBe("Unknown error");
  });
});
