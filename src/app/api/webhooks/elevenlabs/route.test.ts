import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

/**
 * Create an ElevenLabs-format signature header: t=timestamp,v0=hmac
 * The HMAC signs "${timestamp}.${payload}" with SHA-256.
 */
function createSignatureHeader(
  payload: string,
  timestamp?: number
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const message = `${ts}.${payload}`;
  const hmac = createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(message);
  const sig = hmac.digest("hex");
  return `t=${ts},v0=${sig}`;
}

function createSignedRequest(
  body: unknown,
  overrideHeaders?: Record<string, string>
): NextRequest {
  const payload = JSON.stringify(body);
  const sigHeader = createSignatureHeader(payload);
  return new NextRequest("http://localhost:3000/api/webhooks/elevenlabs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "elevenlabs-signature": sigHeader,
      ...overrideHeaders,
    },
    body: payload,
  });
}

/**
 * Helper to build an ElevenLabs-format transcript array from messages.
 * Alternates user/agent roles starting with "agent".
 */
function buildTranscript(
  ...messages: Array<{ role: "user" | "agent"; message: string }>
) {
  return messages.map((m, i) => ({
    role: m.role,
    message: m.message,
    time_in_call_secs: i * 5,
  }));
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

  describe("signature verification", () => {
    it("should return 401 when signature header is missing", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/elevenlabs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: "conv_456" }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Missing signature");
    });

    it("should return 401 when signature format is invalid", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/elevenlabs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "elevenlabs-signature": "invalid-format",
          },
          body: JSON.stringify({ conversation_id: "conv_456" }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid signature");
    });

    it("should return 401 when HMAC does not match", async () => {
      const now = Math.floor(Date.now() / 1000);
      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/elevenlabs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "elevenlabs-signature": `t=${now},v0=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`,
          },
          body: JSON.stringify({ conversation_id: "conv_456" }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid signature");
    });

    it("should return 401 when timestamp is too old (>30 min)", async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 31 * 60;
      const payload = JSON.stringify({ conversation_id: "conv_456" });
      const sigHeader = createSignatureHeader(payload, oldTimestamp);

      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/elevenlabs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "elevenlabs-signature": sigHeader,
          },
          body: payload,
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Signature expired");
    });

    it("should accept valid signature with current timestamp", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "agent", message: "Hola, llamo para hacer una reserva." },
          { role: "user", message: "Perfecto, le esperamos." }
        ),
        analysis: { call_successful: "success" },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  it("should ignore non-post_call_transcription events", async () => {
    const request = createSignedRequest({
      event_type: "call_started",
      conversation_id: "conv_456",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ignored).toBe(true);
  });

  it("should return 400 when conversation_id is missing", async () => {
    const request = createSignedRequest({
      event_type: "post_call_transcription",
    });

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

    const request = createSignedRequest({
      conversation_id: "unknown_conv",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.ignored).toBe(true);
  });

  describe("outcome detection with ElevenLabs payload format", () => {
    it("should detect confirmed from transcript array messages", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "agent", message: "Hola, llamo de parte de Juan García para reservar mesa para 4 personas." },
          { role: "user", message: "Sí, perfecto, le esperamos a las nueve." },
          { role: "agent", message: "Muchas gracias, hasta luego." }
        ),
        analysis: {
          call_successful: "success",
          transcript_summary: "Booking confirmed for 4 people at 9pm.",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.outcome).toBe("confirmed");
      expect(data.smsSent).toBe(true);
    });

    it("should detect confirmed from analysis summary when transcript has no keywords", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "agent", message: "Hola, quería hacer una reserva." },
          { role: "user", message: "Sí, vale, a las nueve." },
          { role: "agent", message: "Gracias." }
        ),
        analysis: {
          call_successful: "success",
          transcript_summary: "Reserva confirmada para 4 personas a las 21:00.",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("confirmed");
    });

    it("should detect denied from transcript array", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "agent", message: "Hola, llamo para reservar mesa." },
          { role: "user", message: "Lo siento, estamos completo esta noche." },
          { role: "agent", message: "Entendido, gracias." }
        ),
        analysis: { call_successful: "success" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("denied");
    });

    it("should detect no_answer when call_successful is 'failure'", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: [],
        analysis: { call_successful: "failure" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("no_answer");
    });

    it("should detect no_answer from voicemail keywords in transcript array", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "user", message: "Has llegado al buzón de voz. Deja tu mensaje después del tono." }
        ),
        analysis: { call_successful: "success" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("no_answer");
    });

    it("should use analysis.call_successful 'success' with keyword matching", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "agent", message: "Buenos días, quería reservar." },
          { role: "user", message: "De acuerdo, sin problema." }
        ),
        analysis: { call_successful: "success" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("confirmed");
    });

    it("should default to failed when call_successful is 'unknown' and no keywords match", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "agent", message: "Hola." },
          { role: "user", message: "Hola, dígame." },
          { role: "agent", message: "Se cortó la llamada." }
        ),
        analysis: { call_successful: "unknown" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("failed");
    });
  });

  it("should not send SMS when feature flag is disabled", async () => {
    vi.mocked(isFeatureFlagEnabled).mockResolvedValue(false);

    const request = createSignedRequest({
      conversation_id: "conv_456",
      transcript: buildTranscript(
        { role: "user", message: "Perfecto, le esperamos." }
      ),
      analysis: { call_successful: "success" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.smsSent).toBe(false);
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it("should update booking status in database", async () => {
    const request = createSignedRequest({
      conversation_id: "conv_456",
      transcript: buildTranscript(
        { role: "user", message: "Confirmado, le esperamos." }
      ),
      analysis: { call_successful: "success" },
    });

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

    const request = createSignedRequest({
      conversation_id: "conv_456",
      transcript: buildTranscript(
        { role: "user", message: "Confirmado, le esperamos." }
      ),
      analysis: { call_successful: "success" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.smsSent).toBe(false);
    expect(data.smsError).toBe("Invalid phone number");
  });
});
