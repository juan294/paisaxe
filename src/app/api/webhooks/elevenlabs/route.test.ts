import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

// Mock modules before importing route
vi.mock("@/lib/supabase", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/feature-flags-server", () => ({
  isFeatureFlagEnabled: vi.fn(),
}));

vi.mock("@/lib/twilio-sms", () => ({
  sendSMS: vi.fn(),
  buildConfirmationSMS: vi.fn(() => "Confirmation SMS"),
  buildDeniedSMS: vi.fn(() => "Denied SMS"),
  buildNoAnswerSMS: vi.fn(() => "No Answer SMS"),
  buildFailedSMS: vi.fn(() => "Failed SMS"),
}));

import { POST } from "./route";
import { createAdminClient } from "@/lib/supabase";
import { isFeatureFlagEnabled } from "@/lib/feature-flags-server";
import { sendSMS } from "@/lib/twilio-sms";

const WEBHOOK_SECRET = "test-webhook-secret";
const originalEnv = process.env;

const mockBooking = {
  id: "booking-123",
  conversation_id: "conv_456",
  venue_name: "Casa Gerardo",
  venue_phone: "+34985887797",
  customer_name: "Juan García",
  customer_phone: "+34612345678",
  party_size: 4,
  booking_date: "Hoy",
  booking_time: "21:00",
  special_requests: null,
  status: "pending",
  outcome_message: null,
  created_at: "2024-01-01T10:00:00Z",
  updated_at: "2024-01-01T10:00:00Z",
};

function createSignature(payload: string): string {
  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(payload);
  return hmac.digest("hex");
}

function createRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  const payload = JSON.stringify(body);
  return new NextRequest("http://localhost:3000/api/webhooks/elevenlabs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: payload,
  });
}

describe("POST /api/webhooks/elevenlabs", () => {
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env = {
      ...originalEnv,
      ELEVENLABS_WEBHOOK_SECRET: WEBHOOK_SECRET,
    };

    // Default: feature flag enabled
    vi.mocked(isFeatureFlagEnabled).mockResolvedValue(true);

    // Default: SMS sends successfully
    vi.mocked(sendSMS).mockResolvedValue({ success: true, sid: "SM123" });

    // Setup Supabase mock chain
    mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
      }),
    });

    mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFrom = vi.fn((table: string) => {
      if (table === "pending_bookings") {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return { select: vi.fn(), update: vi.fn() };
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof createAdminClient>);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return 401 when signature header is missing", async () => {
    const payload = { conversation_id: "conv_456" };
    const request = createRequest(payload);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Missing signature");
  });

  it("should return 401 when signature is invalid", async () => {
    const payload = { conversation_id: "conv_456" };
    const request = createRequest(payload, {
      "x-elevenlabs-signature": "invalid-signature",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid signature");
  });

  it("should ignore non-post_call_transcription events", async () => {
    const payload = { event_type: "call_started", conversation_id: "conv_456" };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ignored).toBe(true);
  });

  it("should return 400 when conversation_id is missing", async () => {
    const payload = { event_type: "post_call_transcription" };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Missing conversation_id");
  });

  it("should ignore webhook if no pending booking found", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const payload = { conversation_id: "unknown_conv" };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ignored).toBe(true);
  });

  it("should detect confirmed outcome from transcript", async () => {
    const payload = {
      conversation_id: "conv_456",
      transcript: "Perfecto, le esperamos a las nueve.",
      analysis: { call_successful: true },
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.outcome).toBe("confirmed");
    expect(data.smsSent).toBe(true);
  });

  it("should detect denied outcome from transcript", async () => {
    const payload = {
      conversation_id: "conv_456",
      transcript: "Lo siento, estamos completo esta noche.",
      analysis: { call_successful: true },
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.outcome).toBe("denied");
  });

  it("should detect no_answer when call_successful is false", async () => {
    const payload = {
      conversation_id: "conv_456",
      analysis: { call_successful: false },
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.outcome).toBe("no_answer");
  });

  it("should detect no_answer from voicemail keywords", async () => {
    const payload = {
      conversation_id: "conv_456",
      transcript: "Has llegado al buzón de voz. Deja tu mensaje después del tono.",
      analysis: { call_successful: true },
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.outcome).toBe("no_answer");
  });

  it("should not send SMS when feature flag is disabled", async () => {
    vi.mocked(isFeatureFlagEnabled).mockResolvedValue(false);

    const payload = {
      conversation_id: "conv_456",
      transcript: "Perfecto, le esperamos.",
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.smsSent).toBe(false);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it("should update booking status in database", async () => {
    const payload = {
      conversation_id: "conv_456",
      transcript: "Confirmado, le esperamos.",
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    await POST(request);

    expect(mockUpdate).toHaveBeenCalledWith({
      status: "confirmed",
      outcome_message: "Confirmation SMS",
    });
  });

  it("should handle SMS failure gracefully", async () => {
    vi.mocked(sendSMS).mockResolvedValue({
      success: false,
      error: "Invalid phone number",
    });

    const payload = {
      conversation_id: "conv_456",
      transcript: "Confirmado, le esperamos.",
    };
    const body = JSON.stringify(payload);
    const signature = createSignature(body);

    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-elevenlabs-signature": signature,
        },
        body,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.smsSent).toBe(false);
    expect(data.smsError).toBe("Invalid phone number");
  });
});

// Export afterEach for cleanup
import { afterEach } from "vitest";
