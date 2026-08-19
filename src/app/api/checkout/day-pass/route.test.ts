import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }));

// Set env vars before any imports that might use them
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");

// Mock cookies before importing the route
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

// Mock Supabase SSR client
const mockGetUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Mock Stripe library - functions must be defined inline to avoid hoisting issues
vi.mock("@/lib/stripe", () => ({
  createDayPassCheckoutSession: vi.fn(),
  isStripeConfigured: vi.fn(() => true),
}));

import { POST } from "./route";
import { createDayPassCheckoutSession } from "@/lib/stripe";

function createRequest(
  headers: Record<string, string> = {},
  body?: Record<string, unknown>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/checkout/day-pass", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("POST /api/checkout/day-pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");
    // BE-S2 (#803): rate limiting allows by default; individual tests
    // override to exercise the blocked path.
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: Date.now() + 60_000,
    });
  });

  // BE-S2 (#803): checkout/day-pass had no rate limiting — a repeat-click or
  // scripted loop could create unbounded Stripe Checkout Sessions per user.
  describe("rate limiting (BE-S2)", () => {
    it("returns 429 when the per-user limit is exceeded", async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAt: Date.now() + 60_000,
        retryAfter: 17,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      const request = createRequest({ origin: "https://paisaxe.es" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("17");
      expect(data.error).toBe("Too many requests. Please try again later.");
      expect(createDayPassCheckoutSession).not.toHaveBeenCalled();
    });

    it("keys the rate limit on the authenticated user id", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });
      vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
        "https://checkout.stripe.com/session123"
      );

      await POST(createRequest({ origin: "https://paisaxe.es" }));

      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        "day-pass:user-123",
        expect.any(Object)
      );
    });

    it("does not rate limit unauthenticated requests (401 short-circuits first)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
      await POST(createRequest());
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });
  });

  it("should return 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const request = createRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return checkout URL for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/session123"
    );

    const request = createRequest({
      origin: "https://paisaxe.es",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toBe("https://checkout.stripe.com/session123");
    expect(createDayPassCheckoutSession).toHaveBeenCalledWith({
      userId: "user-123",
      userEmail: "test@example.com",
      successUrl: "https://paisaxe.es/pricing/success",
      cancelUrl: "https://paisaxe.es/pricing",
      purchaseType: "day_pass",
    });
  });

  it("should use NEXT_PUBLIC_SITE_URL as fallback when origin header is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/session123"
    );

    const request = createRequest();

    await POST(request);

    expect(createDayPassCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://paisaxe.es/pricing/success",
        cancelUrl: "https://paisaxe.es/pricing",
      })
    );
  });

  it("should return 500 when checkout session creation fails", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    vi.mocked(createDayPassCheckoutSession).mockRejectedValue(
      new Error("Stripe API error")
    );

    const request = createRequest({
      origin: "https://paisaxe.es",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create checkout session");
  });

  it("should return 500 when STRIPE_SECRET_KEY is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const request = createRequest();
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toBe("Stripe not configured");
  });

  it("should return 500 when STRIPE_DAY_PASS_PRICE_ID is missing", async () => {
    vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "");
    const request = createRequest();
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toBe("Stripe not configured");
  });

  it("should include returnTo story slug in success URL when provided", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/session123"
    );

    const request = createRequest(
      { origin: "https://paisaxe.es" },
      { returnTo: "oviedo-walking-tour" }
    );

    await POST(request);

    expect(createDayPassCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl:
          "https://paisaxe.es/pricing/success?returnTo=oviedo-walking-tour",
      })
    );
  });

  it("should use default success URL when no returnTo is provided", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/session123"
    );

    const request = createRequest({ origin: "https://paisaxe.es" });

    await POST(request);

    expect(createDayPassCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://paisaxe.es/pricing/success",
      })
    );
  });

  it("should ignore returnTo values with invalid characters", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/session123"
    );

    const request = createRequest(
      { origin: "https://paisaxe.es" },
      { returnTo: "../../admin/secrets" }
    );

    await POST(request);

    expect(createDayPassCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://paisaxe.es/pricing/success",
      })
    );
  });

  it("should include error details in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    vi.mocked(createDayPassCheckoutSession).mockRejectedValue(
      new Error("Detailed error")
    );

    const request = createRequest({
      origin: "https://paisaxe.es",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create checkout session");
    expect(data.details).toBe("Detailed error");
  });

  it("should use empty string as userEmail when user.email is undefined", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: undefined,
        },
      },
      error: null,
    });

    vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/session123"
    );

    const request = createRequest({ origin: "https://paisaxe.es" });
    await POST(request);

    expect(createDayPassCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        userEmail: "",
      })
    );
  });

  it("should show 'Unknown error' in development mode when error is not an Error instance", async () => {
    vi.stubEnv("NODE_ENV", "development");

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    vi.mocked(createDayPassCheckoutSession).mockRejectedValue("string error");

    const request = createRequest({ origin: "https://paisaxe.es" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create checkout session");
    expect(data.details).toBe("Unknown error");
  });

  describe("Zod validation for returnTo", () => {
    it("should accept a valid returnTo slug via Zod schema", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "user@example.com" } },
        error: null,
      });
      vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
        "https://checkout.stripe.com/abc"
      );

      const request = createRequest({ origin: "https://paisaxe.es" }, { returnTo: "oviedo-tour" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBeDefined();
    });

    it("should silently ignore returnTo that fails Zod regex (path traversal)", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "user@example.com" } },
        error: null,
      });
      vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
        "https://checkout.stripe.com/abc"
      );

      // Fails Zod regex: starts with digit but contains path segment separator
      const request = createRequest(
        { origin: "https://paisaxe.es" },
        { returnTo: "../../admin" }
      );
      await POST(request);

      expect(createDayPassCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ successUrl: "https://paisaxe.es/pricing/success" })
      );
    });

    it("should silently ignore non-string returnTo", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "user@example.com" } },
        error: null,
      });
      vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
        "https://checkout.stripe.com/abc"
      );

      const request = createRequest({ origin: "https://paisaxe.es" }, { returnTo: 42 as unknown as string });
      await POST(request);

      expect(createDayPassCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ successUrl: "https://paisaxe.es/pricing/success" })
      );
    });
  });

  it("should use logger.error (not console.error) on unhandled POST error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
      error: null,
    });
    vi.mocked(createDayPassCheckoutSession).mockRejectedValue(new Error("Stripe unavailable"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = createRequest({ origin: "https://paisaxe.es" });
    const response = await POST(request);
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("should forward a valid purchaseType from body to the checkout session", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/session-weekly"
    );

    const request = createRequest(
      { origin: "https://paisaxe.es" },
      { purchaseType: "weekly_pass" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(createDayPassCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseType: "weekly_pass" })
    );
    expect(data.url).toBe("https://checkout.stripe.com/session-weekly");
  });

  it("should fall back to the hardcoded default origin when NEXT_PUBLIC_SITE_URL is unset", async () => {
    // `??` only falls back on null/undefined, not on empty string, so the
    // env var must be deleted entirely (not stubbed to "") to hit this branch.
    delete process.env.NEXT_PUBLIC_SITE_URL;

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createDayPassCheckoutSession).mockResolvedValue(
      "https://checkout.stripe.com/session123"
    );

    // No origin header, so origin falls through to
    // `process.env.NEXT_PUBLIC_SITE_URL ?? "https://paisaxe.es"`.
    // With NEXT_PUBLIC_SITE_URL unset, the hardcoded default must be used.
    const request = createRequest();
    await POST(request);

    expect(createDayPassCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://paisaxe.es/pricing/success",
        cancelUrl: "https://paisaxe.es/pricing",
      })
    );
  });

  describe("ALLOWED_ORIGINS in development mode (module-level branch)", () => {
    // ALLOWED_ORIGINS is computed once at module load time, so exercising the
    // NODE_ENV === "development" branch requires resetting modules and
    // re-importing the route with NODE_ENV stubbed *before* import.
    afterEach(() => {
      vi.doUnmock("@supabase/ssr");
      vi.doUnmock("@/lib/stripe");
      vi.doUnmock("@/lib/logger");
      vi.doUnmock("next/headers");
    });

    it("should include http://localhost:3000 in ALLOWED_ORIGINS when NODE_ENV=development", async () => {
      vi.resetModules();
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_123");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://paisaxe.es");

      const devMockGetUser = vi.fn().mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      vi.doMock("next/headers", () => ({
        cookies: vi.fn(() => ({
          getAll: () => [],
          set: vi.fn(),
        })),
      }));
      vi.doMock("@supabase/ssr", () => ({
        createServerClient: vi.fn(() => ({
          auth: { getUser: devMockGetUser },
        })),
      }));
      const devCreateDayPassCheckoutSession = vi
        .fn()
        .mockResolvedValue("https://checkout.stripe.com/session-dev");
      vi.doMock("@/lib/stripe", () => ({
        createDayPassCheckoutSession: devCreateDayPassCheckoutSession,
        isStripeConfigured: vi.fn(() => true),
      }));
      vi.doMock("@/lib/logger", () => ({ logger }));

      const { POST: devPost } = await import("./route");

      const request = createRequest({ origin: "http://localhost:3000" });
      const response = await devPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBe("https://checkout.stripe.com/session-dev");
      expect(devCreateDayPassCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          successUrl: "http://localhost:3000/pricing/success",
          cancelUrl: "http://localhost:3000/pricing",
        })
      );
    });
  });
});
