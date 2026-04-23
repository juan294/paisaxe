import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

const { mockRpc, logger } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/stripe", () => ({
  verifyWebhookSignature: vi.fn(),
  calculateExpiryDate: vi.fn(() => new Date("2024-01-02T00:00:00Z")),
}));

vi.mock("@/lib/logger", () => ({
  logger,
}));

import { POST } from "./route";
import { verifyWebhookSignature } from "@/lib/stripe";

function createCheckoutSessionEvent(
  userId: string | undefined,
  paymentIntentId: string | null,
  eventId: string = "evt_test123",
  amountTotal: number = 199
): Stripe.Event {
  return {
    id: eventId,
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
        amount_subtotal: amountTotal,
        amount_total: amountTotal,
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
    mockRpc.mockReset();
  });

  it("returns 401 when the signature header is missing", async () => {
    const response = await POST(createRequest(JSON.stringify({})));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Missing signature");
  });

  it("returns 401 when the signature is invalid", async () => {
    vi.mocked(verifyWebhookSignature).mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "invalid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid signature");
  });

  it("ignores non-checkout.session.completed events", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: {} },
    } as Stripe.Event);

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "valid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 200 unrecoverable when user_id is missing", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(
      createCheckoutSessionEvent(undefined, "pi_test123")
    );

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "valid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: "unrecoverable",
      reason: "missing_user_id",
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[STRIPE_UNRECOVERABLE]", {
      eventId: "evt_test123",
      reason: "missing_user_id",
    });
  });

  it("returns 200 unrecoverable when payment_intent is missing", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(
      createCheckoutSessionEvent("user-123", null, "evt_missing_intent")
    );

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "valid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      status: "unrecoverable",
      reason: "missing_payment_intent",
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[STRIPE_UNRECOVERABLE]", {
      eventId: "evt_missing_intent",
      reason: "missing_payment_intent",
    });
  });

  it("returns duplicate when the idempotent RPC reports a repeat event", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(
      createCheckoutSessionEvent("user-123", "pi_duplicate", "evt_duplicate")
    );
    mockRpc.mockResolvedValue({ data: "duplicate", error: null });

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "valid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "duplicate" });
    expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", {
      p_event_id: "evt_duplicate",
      p_user_id: "user-123",
      p_payment_provider_id: "pi_duplicate",
      p_expires_at: "2024-01-02T00:00:00.000Z",
      p_amount_paid: 199,
    });
  });

  it("returns granted when the idempotent RPC succeeds", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(
      createCheckoutSessionEvent("user-123", "pi_granted", "evt_granted", 299)
    );
    mockRpc.mockResolvedValue({ data: "granted", error: null });

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "valid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "granted" });
    expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", {
      p_event_id: "evt_granted",
      p_user_id: "user-123",
      p_payment_provider_id: "pi_granted",
      p_expires_at: "2024-01-02T00:00:00.000Z",
      p_amount_paid: 299,
    });
  });

  it("returns 500 when the idempotent RPC fails", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(
      createCheckoutSessionEvent("user-123", "pi_boom", "evt_boom")
    );
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "valid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
    expect(logger.error).toHaveBeenCalledWith("[STRIPE_RPC_FAILURE]", {
      eventId: "evt_boom",
      error: "boom",
    });
  });

  it("allows a retry after an RPC failure", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(
      createCheckoutSessionEvent("user-123", "pi_retry", "evt_retry")
    );
    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: "temporary failure" },
      })
      .mockResolvedValueOnce({
        data: "granted",
        error: null,
      });

    const firstRequest = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });

    const firstResponse = await POST(firstRequest);
    const firstData = await firstResponse.json();
    expect(firstResponse.status).toBe(500);
    expect(firstData.error).toBe("Database error");

    const retryRequest = createRequest(JSON.stringify({}), {
      "stripe-signature": "valid-signature",
    });
    const retryResponse = await POST(retryRequest);
    const retryData = await retryResponse.json();
    expect(retryResponse.status).toBe(200);
    expect(retryData).toEqual({ status: "granted" });
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when an unexpected error is thrown", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(
      createCheckoutSessionEvent("user-123", "pi_test456")
    );
    mockRpc.mockRejectedValue(new Error("Unexpected error"));

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "valid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("returns 401 with the stringified signature error when a non-Error is thrown", async () => {
    vi.mocked(verifyWebhookSignature).mockImplementation(() => {
      throw "string-thrown-signature-failure";
    });

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "invalid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid signature");
    expect(logger.warn).toHaveBeenCalledWith("[STRIPE_WEBHOOK_INVALID_REQUEST]", {
      reason: "invalid_signature",
      error: "string-thrown-signature-failure",
    });
  });

  it("defaults amount_paid to 0 when session.amount_total is null", async () => {
    const event = createCheckoutSessionEvent(
      "user-123",
      "pi_zero_amount",
      "evt_zero_amount"
    );
    (event.data.object as Stripe.Checkout.Session).amount_total = null;

    vi.mocked(verifyWebhookSignature).mockReturnValue(event);
    mockRpc.mockResolvedValue({ data: "granted", error: null });

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "valid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ status: "granted" });
    expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", {
      p_event_id: "evt_zero_amount",
      p_user_id: "user-123",
      p_payment_provider_id: "pi_zero_amount",
      p_expires_at: "2024-01-02T00:00:00.000Z",
      p_amount_paid: 0,
    });
  });

  it("returns 500 and stringifies non-Error throws from the outer handler", async () => {
    vi.mocked(verifyWebhookSignature).mockReturnValue(
      createCheckoutSessionEvent("user-123", "pi_nonerror", "evt_nonerror")
    );
    mockRpc.mockRejectedValue("non-error-string-throw");

    const response = await POST(
      createRequest(JSON.stringify({}), {
        "stripe-signature": "valid-signature",
      })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
    expect(logger.error).toHaveBeenCalledWith("[STRIPE_WEBHOOK_FAILURE]", {
      error: "non-error-string-throw",
    });
  });
});
