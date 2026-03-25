import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
});
