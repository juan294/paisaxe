import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock modules before importing route
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
    })),
  })),
}));

vi.mock("@/lib/lemonsqueezy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lemonsqueezy")>();
  return {
    ...actual,
    verifyWebhookSignature: vi.fn(),
    getPurchaseTypeFromVariant: vi.fn(),
    calculateExpiryDate: vi.fn(() => new Date("2024-01-02T00:00:00Z")),
  };
});

import { POST } from "./route";
import { verifyWebhookSignature, getPurchaseTypeFromVariant } from "@/lib/lemonsqueezy";
import { createAdminClient } from "@/lib/supabase";

const validWebhookPayload = {
  meta: {
    event_name: "order_created",
    custom_data: {
      user_id: "user-123",
    },
  },
  data: {
    id: "order-456",
    type: "orders",
    attributes: {
      first_order_item: {
        variant_id: 123456,
        product_id: 789,
        product_name: "Voice Day Pass",
        variant_name: "Default",
      },
      status: "paid",
      total: 199,
      currency: "EUR",
      user_email: "test@example.com",
      user_name: "Test User",
      created_at: "2024-01-01T00:00:00Z",
    },
  },
};

function createRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/lemonsqueezy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/lemonsqueezy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyWebhookSignature).mockResolvedValue(true);
    vi.mocked(getPurchaseTypeFromVariant).mockReturnValue("day_pass");
  });

  it("should return 401 when signature header is missing", async () => {
    const request = createRequest(validWebhookPayload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Missing signature");
  });

  it("should return 401 when signature is invalid", async () => {
    vi.mocked(verifyWebhookSignature).mockResolvedValue(false);

    const request = createRequest(validWebhookPayload, {
      "x-signature": "invalid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid signature");
  });

  it("should return 400 when payload is invalid", async () => {
    const request = createRequest(
      { invalid: "payload" },
      { "x-signature": "valid-signature" }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid payload");
  });

  it("should ignore non-order_created events", async () => {
    const payload = {
      ...validWebhookPayload,
      meta: { ...validWebhookPayload.meta, event_name: "subscription_created" },
    };

    const request = createRequest(payload, {
      "x-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ignored).toBe(true);
  });

  it("should return 400 when user_id is missing", async () => {
    const payload = {
      ...validWebhookPayload,
      meta: { event_name: "order_created" },
    };

    const request = createRequest(payload, {
      "x-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing user_id");
  });

  it("should ignore unpaid orders", async () => {
    const payload = {
      ...validWebhookPayload,
      data: {
        ...validWebhookPayload.data,
        attributes: {
          ...validWebhookPayload.data.attributes,
          status: "pending",
        },
      },
    };

    const request = createRequest(payload, {
      "x-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ignored).toBe(true);
  });

  it("should return 400 for unknown variant", async () => {
    vi.mocked(getPurchaseTypeFromVariant).mockReturnValue(null);

    const request = createRequest(validWebhookPayload, {
      "x-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Unknown product variant");
  });

  it("should create purchase record for valid webhook", async () => {
    const mockInsert = vi.fn(() => ({ error: null }));
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = createRequest(validWebhookPayload, {
      "x-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.purchaseType).toBe("day_pass");
    expect(mockFrom).toHaveBeenCalledWith("voice_purchases");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-123",
      purchase_type: "day_pass",
      lemon_squeezy_order_id: "order-456",
      expires_at: "2024-01-02T00:00:00.000Z",
    });
  });

  it("should handle duplicate orders gracefully", async () => {
    const mockInsert = vi.fn(() => ({
      error: { code: "23505", message: "duplicate key" },
    }));
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = createRequest(validWebhookPayload, {
      "x-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.duplicate).toBe(true);
  });

  it("should return 500 on database error", async () => {
    const mockInsert = vi.fn(() => ({
      error: { code: "42000", message: "database error" },
    }));
    const mockFrom = vi.fn(() => ({ insert: mockInsert }));
    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);

    const request = createRequest(validWebhookPayload, {
      "x-signature": "valid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });
});
