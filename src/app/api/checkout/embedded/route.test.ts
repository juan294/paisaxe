import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger }));

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

// Mock Stripe library
vi.mock("@/lib/stripe", () => ({
  createEmbeddedCheckoutSession: vi.fn(),
}));

import { POST } from "./route";
import { createEmbeddedCheckoutSession } from "@/lib/stripe";

function createRequest(
  headers: Record<string, string> = {},
  body?: Record<string, unknown>
): NextRequest {
  return new NextRequest("http://localhost:3000/api/checkout/embedded", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("POST /api/checkout/embedded", () => {
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

  it("should return clientSecret for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_test_secret_123");
    const request = createRequest({ origin: "https://paisaxe.es" });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.clientSecret).toBe("cs_test_secret_123");
    expect(createEmbeddedCheckoutSession).toHaveBeenCalledWith({
      userId: "user-123",
      userEmail: "test@example.com",
      returnUrl: "https://paisaxe.es/pricing/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      purchaseType: "day_pass",
    });
  });

  it("should use NEXT_PUBLIC_SITE_URL as fallback when origin is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_test_secret_123");
    const request = createRequest();
    await POST(request);
    expect(createEmbeddedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        returnUrl: "https://paisaxe.es/pricing/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      })
    );
  });

  it("SE-H2: should reject an Origin not in ALLOWED_ORIGINS with 400", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_test_secret_123");
    const request = createRequest({ origin: "https://evil.example.com" });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid origin");
    expect(createEmbeddedCheckoutSession).not.toHaveBeenCalled();
  });

  it("SE-H2: should use fallback origin (NEXT_PUBLIC_SITE_URL) when no Origin header", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_test_secret_123");
    const request = createRequest({}); // no origin header
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.clientSecret).toBe("cs_test_secret_123");
    expect(createEmbeddedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        returnUrl: expect.stringContaining("https://paisaxe.es/pricing/checkout/return"),
      })
    );
  });

  it("SE-H2: should accept all configured allowed origins", async () => {
    const allowedOrigins = [
      "https://paisaxe.es",
      "https://paisaxe.com",
      "https://www.paisaxe.es",
      "https://www.paisaxe.com",
    ];

    for (const origin of allowedOrigins) {
      vi.clearAllMocks();
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });
      vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_test_secret_123");
      const request = createRequest({ origin });
      const response = await POST(request);
      expect(response.status).toBe(200);
    }
  });

  it("should return 500 when checkout session creation fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockRejectedValue(new Error("Stripe API error"));
    const request = createRequest({ origin: "https://paisaxe.es" });
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

  it("should include returnTo in return URL when provided", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_test_secret_123");
    const request = createRequest(
      { origin: "https://paisaxe.es" },
      { returnTo: "oviedo-walking-tour" }
    );
    await POST(request);
    expect(createEmbeddedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        returnUrl: "https://paisaxe.es/pricing/checkout/return?session_id={CHECKOUT_SESSION_ID}&returnTo=oviedo-walking-tour",
      })
    );
  });

  it("should ignore returnTo values with invalid characters", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_test_secret_123");
    const request = createRequest(
      { origin: "https://paisaxe.es" },
      { returnTo: "../../admin/secrets" }
    );
    await POST(request);
    expect(createEmbeddedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        returnUrl: "https://paisaxe.es/pricing/checkout/return?session_id={CHECKOUT_SESSION_ID}",
      })
    );
  });

  it("should include error details in development mode", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockRejectedValue(new Error("Detailed error"));
    const request = createRequest({ origin: "https://paisaxe.es" });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create checkout session");
    expect(data.details).toBe("Detailed error");
  });

  it("should use empty string as userEmail when user.email is undefined", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: undefined } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_test_secret_123");
    const request = createRequest({ origin: "https://paisaxe.es" });
    await POST(request);
    expect(createEmbeddedCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        userEmail: "",
      })
    );
  });

  it("should show 'Unknown error' in development mode when error is not an Error instance", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockRejectedValue("string error");
    const request = createRequest({ origin: "https://paisaxe.es" });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create checkout session");
    expect(data.details).toBe("Unknown error");
  });

  describe("Zod validation for returnTo", () => {
    it("should silently ignore returnTo that is not a valid slug (Zod regex)", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "u@e.com" } },
        error: null,
      });
      vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_secret");

      const request = createRequest({ origin: "https://paisaxe.es" }, { returnTo: "../../../etc/passwd" });
      await POST(request);

      expect(createEmbeddedCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          returnUrl: expect.not.stringContaining("returnTo"),
        })
      );
    });

    it("should accept a valid alphanumeric returnTo slug", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-1", email: "u@e.com" } },
        error: null,
      });
      vi.mocked(createEmbeddedCheckoutSession).mockResolvedValue("cs_secret");

      const request = createRequest({ origin: "https://paisaxe.es" }, { returnTo: "covadonga-lakes" });
      await POST(request);

      expect(createEmbeddedCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          returnUrl: expect.stringContaining("returnTo=covadonga-lakes"),
        })
      );
    });
  });

  it("should use logger.error (not console.error) on unhandled POST error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "u@e.com" } },
      error: null,
    });
    vi.mocked(createEmbeddedCheckoutSession).mockRejectedValue(new Error("Stripe unavailable"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = createRequest({ origin: "https://paisaxe.es" });
    const response = await POST(request);
    consoleSpy.mockRestore();

    expect(response.status).toBe(500);
    expect(consoleSpy).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});
