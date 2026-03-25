import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

// Mock modules before importing route
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
    })),
  })),
}));

vi.mock("@/lib/stripe", () => ({
  verifyWebhookSignature: vi.fn(),
  calculateExpiryDate: vi.fn(() => new Date("2024-01-02T00:00:00Z")),
}));

import { POST } from "./route";
import { verifyWebhookSignature } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase";

function createCheckoutSessionEvent(
  userId: string | undefined,
  paymentIntentId: string
): Stripe.Event {
  return {
    id: "evt_test123",
    object: "event",
    api_version: "2024-12-18.acacia",
    created: 1234567890,
    type: "checkout.session.completed",
    livemode: false,
    pending_webhooks: 0,
    request: { id: "req_123", idempotency_key: null },
    data: {
      object: {
        id: "cs_test123",
        object: "checkout.session",
        amount_subtotal: 199,
        amount_total: 199,
        currency: "eur",
        customer: null,
        customer_email: "test@example.com",
        mode: "payment",
        payment_intent: paymentIntentId,
        payment_status: "paid",
        status: "complete",
        metadata: userId ? { user_id: userId } : {},
      } as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}

function createRequest(
  body: string,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when signature header is missing", async () => {
    const request = createRequest(JSON.stringify({}));

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Missing signature");
  });

  it("should return 401 when signature is invalid", async () => {
    vi.mocked(verifyWebhookSignature).mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const request = createRequest(JSON.stringify({}), {
      "stripe-signature": "invalid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid signature");
  });

  it("should ignore non-checkout.session.completed events", async () => {
    const event = {
      type: "payment_intent.succeeded",
      data: { object: {} },
    } as unknown as Stripe.Event;

    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    const request = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should return 400 when user_id is missing in metadata", async () => {
    const event = createCheckoutSessionEvent(undefined, "pi_test123");
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    const request = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing user_id");
  });

  it("should create purchase record for valid webhook", async () => {
    const event = createCheckoutSessionEvent("user-123", "pi_test456");
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    const mockInsert = vi.fn(() => ({ error: null }));
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("voice_purchases");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      purchase_type: "day_pass",
      payment_provider_id: "pi_test456",
      expires_at: "2024-01-02T00:00:00.000Z",
    });
  });

  it("should handle duplicate orders gracefully", async () => {
    const event = createCheckoutSessionEvent("user-123", "pi_test456");
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    const mockInsert = vi.fn(() => ({
      error: { code: "23505", message: "duplicate key" },
    }));
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.duplicate).toBe(true);
  });

  it("should return 500 on database error", async () => {
    const event = createCheckoutSessionEvent("user-123", "pi_test456");
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    const mockInsert = vi.fn(() => ({
      error: { code: "42000", message: "database error" },
    }));
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });

  it("should log successful purchase creation", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const event = createCheckoutSessionEvent("user-123", "pi_test456");
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    const mockInsert = vi.fn(() => ({ error: null }));
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });

    await POST(request);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[stripe-webhook] Purchase created"),
      expect.objectContaining({
        userId: "user-123",
        paymentProviderId: "pi_test456",
        purchaseType: "day_pass",
      })
    );

    consoleSpy.mockRestore();
  });

  it("should return 500 when an unexpected error is thrown", async () => {
    const event = createCheckoutSessionEvent("user-123", "pi_test456");
    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const request = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("should use checkout session ID as fallback when payment_intent is null", async () => {
    const event: Stripe.Event = {
      id: "evt_test123",
      object: "event",
      api_version: "2024-12-18.acacia",
      created: 1234567890,
      type: "checkout.session.completed",
      livemode: false,
      pending_webhooks: 0,
      request: { id: "req_123", idempotency_key: null },
      data: {
        object: {
          id: "cs_test789",
          object: "checkout.session",
          payment_intent: null,
          payment_status: "paid",
          status: "complete",
          metadata: { user_id: "user-123" },
        } as unknown as Stripe.Checkout.Session,
      },
    } as Stripe.Event;

    vi.mocked(verifyWebhookSignature).mockReturnValue(event);

    const mockInsert = vi.fn(() => ({ error: null }));
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });

    await POST(request);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_provider_id: "cs_test789",
      })
    );
  });
});
