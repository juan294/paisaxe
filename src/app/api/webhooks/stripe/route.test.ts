import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

const { mockRpc, mockAuditFrom, mockAuditInsert, logger } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockAuditInsert: vi.fn(),
  mockAuditFrom: vi.fn(),
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockAuditFrom,
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
  amountTotal: number = 199,
  purchaseType?: string
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
        metadata: userId
          ? { user_id: userId, ...(purchaseType ? { purchase_type: purchaseType } : {}) }
          : {},
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
    // Default: audit insert succeeds (no error) — doesn't affect processing flow
    mockAuditInsert.mockResolvedValue({ error: null });
    mockAuditFrom.mockReturnValue({ insert: mockAuditInsert });
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
      p_event_type: "checkout.session.completed",
      p_user_id: "user-123",
      p_payment_provider_id: "pi_duplicate",
      p_expires_at: "2024-01-02T00:00:00.000Z",
      p_amount_paid: 199,
      p_purchase_type: "day_pass",
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
      p_event_type: "checkout.session.completed",
      p_user_id: "user-123",
      p_payment_provider_id: "pi_granted",
      p_expires_at: "2024-01-02T00:00:00.000Z",
      p_amount_paid: 299,
      p_purchase_type: "day_pass",
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
      p_event_type: "checkout.session.completed",
      p_user_id: "user-123",
      p_payment_provider_id: "pi_zero_amount",
      p_expires_at: "2024-01-02T00:00:00.000Z",
      p_amount_paid: 0,
      p_purchase_type: "day_pass",
    });
  });

  describe("grant_day_pass_idempotent atomicity (BE-B2 regression)", () => {
    it("does not lock user out on retry when first grant attempt fails atomically", async () => {
      // BE-B2 regression: if the dedup row insert is committed but the
      // voice_purchases insert fails, the next retry would return 'duplicate'
      // forever — the user pays but never receives access.
      //
      // The atomic RPC must roll back BOTH inserts on failure, so a retry of
      // the same Stripe event can succeed by re-running the entire RPC.
      //
      // We simulate this by:
      //   1. First call: RPC raises (atomicity rolls back the dedup row).
      //   2. Second call (Stripe retry): RPC successfully grants access
      //      because no dedup row exists from the failed attempt.
      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent(
          "user-atomic",
          "pi_atomic",
          "evt_atomic_retry"
        )
      );
      mockRpc
        .mockResolvedValueOnce({
          data: null,
          error: { message: "voice_purchases insert failed" },
        })
        .mockResolvedValueOnce({
          data: "granted",
          error: null,
        });

      // First webhook delivery: RPC fails, route returns 500 so Stripe retries.
      const firstResponse = await POST(
        createRequest(JSON.stringify({}), {
          "stripe-signature": "valid-signature",
        })
      );
      expect(firstResponse.status).toBe(500);
      expect(await firstResponse.json()).toEqual({ error: "Database error" });

      // Stripe retries the same event — must succeed (NOT return 'duplicate').
      const retryResponse = await POST(
        createRequest(JSON.stringify({}), {
          "stripe-signature": "valid-signature",
        })
      );
      const retryData = await retryResponse.json();
      expect(retryResponse.status).toBe(200);
      expect(retryData).toEqual({ status: "granted" });
      expect(retryData.status).not.toBe("duplicate");

      // Both calls hit the RPC with identical idempotency parameters.
      expect(mockRpc).toHaveBeenCalledTimes(2);
      const expectedArgs = {
        p_event_id: "evt_atomic_retry",
        p_event_type: "checkout.session.completed",
        p_user_id: "user-atomic",
        p_payment_provider_id: "pi_atomic",
        p_expires_at: "2024-01-02T00:00:00.000Z",
        p_amount_paid: 199,
        p_purchase_type: "day_pass",
      };
      expect(mockRpc).toHaveBeenNthCalledWith(
        1,
        "grant_day_pass_idempotent",
        expectedArgs
      );
      expect(mockRpc).toHaveBeenNthCalledWith(
        2,
        "grant_day_pass_idempotent",
        expectedArgs
      );
    });

    it("returns non-200 (not 200 'duplicate') when the RPC reports an error so Stripe retries", async () => {
      // Defensive guard: the route must propagate RPC failures as non-200
      // so Stripe's retry machinery kicks in. If we ever returned 200 with
      // an error payload, Stripe would treat the event as delivered and
      // never retry — leaving the user paid but without access.
      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent("user-x", "pi_x", "evt_atomic_failure")
      );
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "atomic rollback: voice_purchases insert failed" },
      });

      const response = await POST(
        createRequest(JSON.stringify({}), {
          "stripe-signature": "valid-signature",
        })
      );

      expect(response.status).not.toBe(200);
      expect(response.status).toBe(500);
    });
  });

  // ─── BE-M3: Stripe webhook audit row matches the table shape ──────────────
  describe("BE-M3: audit columns match stripe_webhook_events", () => {
    it("passes the event type to the RPC so the audit row records event_type", async () => {
      // BE-M3 regression: the audit row in stripe_webhook_events must capture
      // the event_type. The route is the only place that knows event.type, so
      // it must forward it to the atomic RPC that owns the dedup/audit row.
      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent("user-123", "pi_audit_shape", "evt_audit_shape", 499)
      );
      mockRpc.mockResolvedValue({ data: "granted", error: null });

      const response = await POST(
        createRequest(JSON.stringify({}), { "stripe-signature": "valid-signature" })
      );

      expect(response.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", {
        p_event_id: "evt_audit_shape",
        p_event_type: "checkout.session.completed",
        p_user_id: "user-123",
        p_payment_provider_id: "pi_audit_shape",
        p_expires_at: "2024-01-02T00:00:00.000Z",
        p_amount_paid: 499,
        p_purchase_type: "day_pass",
      });
      // The route must NOT do its own mismatched direct audit insert.
      expect(mockAuditFrom).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });
  });

  // ─── BE-M1: Stripe webhook dedupe ownership ───────────────────────────────
  describe("BE-M1: stripe_webhook_events schema ownership", () => {
    it("lets the RPC claim stripe_webhook_events.event_id for checkout events", async () => {
      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent("user-123", "pi_audit_test", "evt_audit_1")
      );
      mockRpc.mockResolvedValue({ data: "granted", error: null });

      await POST(
        createRequest(JSON.stringify({}), { "stripe-signature": "valid-signature" })
      );

      expect(mockAuditFrom).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", {
        p_event_id: "evt_audit_1",
        p_event_type: "checkout.session.completed",
        p_user_id: "user-123",
        p_payment_provider_id: "pi_audit_test",
        p_expires_at: "2024-01-02T00:00:00.000Z",
        p_amount_paid: 199,
        p_purchase_type: "day_pass",
      });
    });

    it("returns duplicate when the RPC reports the event_id was already claimed", async () => {
      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent("user-123", "pi_dup", "evt_duplicate_audit")
      );
      mockRpc.mockResolvedValue({ data: "duplicate", error: null });

      const response = await POST(
        createRequest(JSON.stringify({}), { "stripe-signature": "valid-signature" })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "duplicate" });
      expect(mockAuditFrom).not.toHaveBeenCalled();
      expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", {
        p_event_id: "evt_duplicate_audit",
        p_event_type: "checkout.session.completed",
        p_user_id: "user-123",
        p_payment_provider_id: "pi_dup",
        p_expires_at: "2024-01-02T00:00:00.000Z",
        p_amount_paid: 199,
        p_purchase_type: "day_pass",
      });
    });

    it("does not log non-duplicate audit errors for normal checkout events", async () => {
      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent("user-123", "pi_audit_fail", "evt_audit_fail")
      );
      mockAuditInsert.mockResolvedValue({
        error: { code: "42703", message: "column stripe_event_id does not exist" },
      });
      mockRpc.mockResolvedValue({ data: "granted", error: null });

      const response = await POST(
        createRequest(JSON.stringify({}), { "stripe-signature": "valid-signature" })
      );

      expect(response.status).toBe(200);
      expect(mockRpc).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalledWith(
        "[STRIPE_WEBHOOK_AUDIT_FAILED]",
        expect.anything()
      );
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

  // ─── BE-B1: purchase_type tier fulfillment ────────────────────────────────
  describe("BE-B1: purchase_type read from metadata", () => {
    it("uses weekly_pass expiry (7d) and passes purchase_type when metadata has weekly_pass", async () => {
      // Arrange: calculateExpiryDate returns different dates per tier
      const { calculateExpiryDate: realCalc } = await import("@/lib/stripe");
      const weeklyExpiry = new Date("2024-01-08T00:00:00Z");
      vi.mocked(realCalc).mockReturnValue(weeklyExpiry);

      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent("user-weekly", "pi_weekly", "evt_weekly", 499, "weekly_pass")
      );
      mockRpc.mockResolvedValue({ data: "granted", error: null });

      const response = await POST(
        createRequest(JSON.stringify({}), { "stripe-signature": "valid-signature" })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "granted" });
      // The RPC must receive p_purchase_type: 'weekly_pass' (not 'day_pass')
      expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", expect.objectContaining({
        p_purchase_type: "weekly_pass",
        p_expires_at: weeklyExpiry.toISOString(),
      }));
    });

    it("uses monthly_pass expiry (30d) and passes purchase_type when metadata has monthly_pass", async () => {
      const { calculateExpiryDate: realCalc } = await import("@/lib/stripe");
      const monthlyExpiry = new Date("2024-01-31T00:00:00Z");
      vi.mocked(realCalc).mockReturnValue(monthlyExpiry);

      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent("user-monthly", "pi_monthly", "evt_monthly", 999, "monthly_pass")
      );
      mockRpc.mockResolvedValue({ data: "granted", error: null });

      const response = await POST(
        createRequest(JSON.stringify({}), { "stripe-signature": "valid-signature" })
      );

      expect(response.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", expect.objectContaining({
        p_purchase_type: "monthly_pass",
        p_expires_at: monthlyExpiry.toISOString(),
      }));
    });

    it("defaults to day_pass when purchase_type is absent from metadata", async () => {
      const { calculateExpiryDate: realCalc } = await import("@/lib/stripe");
      const dayExpiry = new Date("2024-01-02T00:00:00Z");
      vi.mocked(realCalc).mockReturnValue(dayExpiry);

      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent("user-default", "pi_default", "evt_default", 199)
        // no purchaseType — omitted
      );
      mockRpc.mockResolvedValue({ data: "granted", error: null });

      await POST(createRequest(JSON.stringify({}), { "stripe-signature": "valid-signature" }));

      expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", expect.objectContaining({
        p_purchase_type: "day_pass",
      }));
    });

    it("defaults to day_pass when purchase_type metadata value is invalid/unknown", async () => {
      const { calculateExpiryDate: realCalc } = await import("@/lib/stripe");
      const dayExpiry = new Date("2024-01-02T00:00:00Z");
      vi.mocked(realCalc).mockReturnValue(dayExpiry);

      vi.mocked(verifyWebhookSignature).mockReturnValue(
        createCheckoutSessionEvent("user-bad-type", "pi_bad_type", "evt_bad_type", 199, "unknown_tier")
      );
      mockRpc.mockResolvedValue({ data: "granted", error: null });

      await POST(createRequest(JSON.stringify({}), { "stripe-signature": "valid-signature" }));

      expect(mockRpc).toHaveBeenCalledWith("grant_day_pass_idempotent", expect.objectContaining({
        p_purchase_type: "day_pass",
      }));
    });
  });

  // ─── BE-L2: RPC timeout ───────────────────────────────────────────────────
  describe("BE-L2: RPC client-side timeout", () => {
    it("returns 500 and logs STRIPE_RPC_TIMEOUT when the RPC takes longer than 10s", async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(verifyWebhookSignature).mockReturnValue(
          createCheckoutSessionEvent("user-timeout", "pi_timeout", "evt_timeout")
        );
        // RPC hangs forever (simulates a slow DB call)
        mockRpc.mockImplementation(() => new Promise(() => {}));

        // Start the request and immediately advance time past the 10s timeout.
        // Promise.race in the route should resolve the timeout branch.
        const postPromise = POST(
          createRequest(JSON.stringify({}), { "stripe-signature": "valid-signature" })
        );
        // Flush microtasks so the route's Promise.race is set up before we tick
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(11000);

        const response = await postPromise;
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Database timeout");
        expect(logger.error).toHaveBeenCalledWith(
          "[STRIPE_RPC_TIMEOUT]",
          expect.objectContaining({ eventId: "evt_timeout" })
        );
      } finally {
        vi.useRealTimers();
      }
    }, 15000);
  });
});
