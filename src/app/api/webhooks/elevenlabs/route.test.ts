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
import { logger } from "@/lib/logger";
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
  let mockRpc: ReturnType<typeof vi.fn>;

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

    // Setup Supabase mock chain (maybeSingle: no PGRST116 needed for no-row)
    mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: mockBooking, error: null }),
      }),
    });

    mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockRpc = vi.fn().mockImplementation((fn: string) => {
      if (fn === "process_elevenlabs_event_idempotent") {
        return Promise.resolve({ data: "processed", error: null });
      }

      if (fn === "enqueue_booking_sms_job") {
        return Promise.resolve({ data: "queued", error: null });
      }

      if (fn === "claim_booking_sms_job") {
        return Promise.resolve({
          data: {
            booking_id: "booking-123",
            event_key: "post_call_transcription:conv_456",
            to_phone: "+34612345678",
            message: "Confirmation SMS",
          },
          error: null,
        });
      }

      if (
        fn === "complete_booking_sms_job" ||
        fn === "fail_booking_sms_job"
      ) {
        return Promise.resolve({ data: true, error: null });
      }

      return Promise.resolve({ data: null, error: null });
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
      rpc: mockRpc,
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

    it("should return 401 when signature hex length differs from expected", async () => {
      // Provide a truncated hex signature so sigBuffer.length !== expectedBuffer.length (line 138)
      const now = Math.floor(Date.now() / 1000);
      const payload = JSON.stringify({ conversation_id: "conv_456" });
      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/elevenlabs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "elevenlabs-signature": `t=${now},v0=aabb`,
          },
          body: payload,
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid signature");
    });

    it("should return 401 when signature contains invalid hex causing an exception", async () => {
      // Non-hex chars in v0 can cause Buffer.from to produce unexpected results
      // or createHmac/timingSafeEqual to throw — exercises the catch block (line 143)
      const now = Math.floor(Date.now() / 1000);
      const payload = JSON.stringify({ conversation_id: "conv_456" });
      const request = new NextRequest(
        "http://localhost:3000/api/webhooks/elevenlabs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Use a very long non-hex string that might cause issues in Buffer comparison
            "elevenlabs-signature": `t=${now},v0=${"zz".repeat(32)}`,
          },
          body: payload,
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid signature");
    });

    it("should return 401 when crypto operations throw (catch block line 143)", async () => {
      // Temporarily override Buffer.from to throw when called with "hex" encoding
      // inside verifySignature's try block, exercising the catch block
      const originalBufferFrom = Buffer.from;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Buffer.from = function (...args: any[]) {
        // The route calls Buffer.from(signature, "hex") and Buffer.from(expected, "hex")
        // Throw on the first "hex" call to trigger the catch block
        if (args[1] === "hex") {
          throw new TypeError("Simulated Buffer.from error");
        }
        return originalBufferFrom.apply(Buffer, args as never);
      } as typeof Buffer.from;

      try {
        const now = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({ conversation_id: "conv_456" });
        const request = new NextRequest(
          "http://localhost:3000/api/webhooks/elevenlabs",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "elevenlabs-signature": `t=${now},v0=${"ab".repeat(32)}`,
            },
            body: payload,
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Invalid signature");
      } finally {
        // Always restore Buffer.from
        Buffer.from = originalBufferFrom;
      }
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

  it("should ignore webhook if no pending booking found (maybeSingle null data, null error)", async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
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

  it("should return duplicate without sending SMS when the event was already processed", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "process_elevenlabs_event_idempotent") {
        return Promise.resolve({ data: "duplicate", error: null });
      }

      if (fn === "enqueue_booking_sms_job") {
        return Promise.resolve({ data: "queued", error: null });
      }

      if (fn === "claim_booking_sms_job") {
        return Promise.resolve({ data: null, error: null });
      }

      return Promise.resolve({ data: null, error: null });
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
    expect(data.status).toBe("duplicate");
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it("should return 500 when the idempotency RPC fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "rpc failed" },
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

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
    expect(sendSMS).not.toHaveBeenCalled();
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

  describe("data-wrapped payload format", () => {
    it("should detect confirmed when transcript and analysis are inside data wrapper", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        data: {
          transcript: buildTranscript(
            { role: "agent", message: "Hola, llamo para reservar mesa para 4 personas." },
            { role: "user", message: "Perfecto, le esperamos a las nueve." }
          ),
          analysis: {
            call_successful: "success",
            transcript_summary: "Booking confirmed for 4 people at 9pm.",
          },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("confirmed");
    });

    it("should detect denied when transcript is inside data wrapper", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        data: {
          transcript: buildTranscript(
            { role: "agent", message: "Hola, llamo para reservar." },
            { role: "user", message: "Lo siento, estamos completo." }
          ),
          analysis: { call_successful: "success" },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("denied");
    });

    it("should detect no_answer when analysis is inside data wrapper with failure", async () => {
      const request = createSignedRequest({
        conversation_id: "conv_456",
        data: {
          transcript: [],
          analysis: { call_successful: "failure" },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("no_answer");
    });

    it("should extract conversation_id from data wrapper", async () => {
      const request = createSignedRequest({
        data: {
          conversation_id: "conv_456",
          transcript: buildTranscript(
            { role: "user", message: "Confirmado, le esperamos." }
          ),
          analysis: { call_successful: "success" },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.outcome).toBe("confirmed");
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

    expect(mockRpc).toHaveBeenCalledWith(
      "process_elevenlabs_event_idempotent",
      {
        p_event_key: "post_call_transcription:conv_456",
        p_booking_id: "booking-123",
        p_outcome: "confirmed",
      }
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      outcome_message: "Confirmation SMS",
    });
  });

  it("should return 500 and keep SMS retryable when delivery fails", async () => {
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

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.smsSent).toBe(false);
    expect(data.smsError).toBe("Invalid phone number");
    expect(mockRpc).toHaveBeenCalledWith("fail_booking_sms_job", {
      p_event_key: "post_call_transcription:conv_456",
      p_error: "Invalid phone number",
    });
  });

  it("should retry a queued SMS when the webhook is delivered again", async () => {
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "process_elevenlabs_event_idempotent") {
        return Promise.resolve({ data: "duplicate", error: null });
      }

      if (fn === "enqueue_booking_sms_job") {
        return Promise.resolve({ data: "queued", error: null });
      }

      if (fn === "claim_booking_sms_job") {
        return Promise.resolve({
          data: {
            booking_id: "booking-123",
            event_key: "post_call_transcription:conv_456",
            to_phone: "+34612345678",
            message: "Confirmation SMS",
          },
          error: null,
        });
      }

      if (fn === "complete_booking_sms_job") {
        return Promise.resolve({ data: true, error: null });
      }

      return Promise.resolve({ data: null, error: null });
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
    expect(data.status).toBe("duplicate");
    expect(data.smsSent).toBe(true);
    expect(sendSMS).toHaveBeenCalledWith("+34612345678", "Confirmation SMS");
    expect(mockRpc).toHaveBeenCalledWith("complete_booking_sms_job", {
      p_event_key: "post_call_transcription:conv_456",
      p_provider_sid: "SM123",
    });
  });

  it("should return 401 when ELEVENLABS_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.ELEVENLABS_WEBHOOK_SECRET;

    const payload = JSON.stringify({ conversation_id: "conv_456" });
    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "elevenlabs-signature": "t=12345,v0=abc123",
        },
        body: payload,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid signature");
  });

  it("should handle outcome message update error gracefully", async () => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: "DB update failed" } }),
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

    // Should still return 200 since SMS was already sent
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.outcome).toBe("confirmed");
  });

  describe("Zod schema validation", () => {
    it("should emit WEBHOOK_UNKNOWN_SHAPE warn when payload has unexpected top-level fields", async () => {
      const loggerSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "user", message: "Confirmado, le esperamos." }
        ),
        analysis: { call_successful: "success" },
        unexpected_field: "surprise",
        another_unknown: 42,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(loggerSpy).toHaveBeenCalledWith(
        "[WEBHOOK_UNKNOWN_SHAPE]",
        expect.objectContaining({ webhook: "elevenlabs" })
      );

      loggerSpy.mockRestore();
    });

    it("should emit WEBHOOK_UNKNOWN_SHAPE warn when analysis has unexpected nested fields", async () => {
      const loggerSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "user", message: "Perfecto." }
        ),
        analysis: {
          call_successful: "success",
          transcript_summary: "All good.",
          unexpected_analysis_field: "extra",
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(loggerSpy).toHaveBeenCalledWith(
        "[WEBHOOK_UNKNOWN_SHAPE]",
        expect.objectContaining({ webhook: "elevenlabs" })
      );

      loggerSpy.mockRestore();
    });

    it("should handle data-nested analysis path in Zod schema validation", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Data-wrapped payload — should pass schema validation without warning
      const request = createSignedRequest({
        conversation_id: "conv_456",
        data: {
          transcript: buildTranscript(
            { role: "user", message: "Confirmado." }
          ),
          analysis: {
            call_successful: "success",
          },
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      // Valid known-shape payload should NOT trigger the warn
      expect(consoleSpy).not.toHaveBeenCalledWith(
        "[WEBHOOK_UNKNOWN_SHAPE]",
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });

  it("should return 500 when request body is not valid JSON", async () => {
    const invalidPayload = "not valid json{{{";
    const sigHeader = createSignatureHeader(invalidPayload);
    const request = new NextRequest(
      "http://localhost:3000/api/webhooks/elevenlabs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "elevenlabs-signature": sigHeader,
        },
        body: invalidPayload,
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("should handle undefined transcript gracefully", async () => {
    // Exercises extractTranscriptText line 161: `if (!transcript) return ""`
    const request = createSignedRequest({
      conversation_id: "conv_456",
      // No transcript field at all — undefined
      analysis: {
        call_successful: "success",
        transcript_summary: "Reserva confirmada para 4 personas.",
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // "confirmada" matches CONFIRMED_PATTERNS via the summary
    expect(data.outcome).toBe("confirmed");
  });

  it("should handle string transcript (legacy format)", async () => {
    // Exercises extractTranscriptText line 163: `if (typeof transcript === "string") return transcript`
    const request = createSignedRequest({
      conversation_id: "conv_456",
      transcript: "Hola, le esperamos a las nueve. Perfecto, confirmado.",
      analysis: { call_successful: "success" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.outcome).toBe("confirmed");
  });

  it("should handle transcript as non-array non-string type gracefully", async () => {
    const request = createSignedRequest({
      conversation_id: "conv_456",
      // transcript is an object (neither string nor array)
      transcript: { unexpected: "format" },
      analysis: { call_successful: "unknown" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // With no matching keywords and unknown call status, should default to failed
    expect(data.outcome).toBe("failed");
  });

  // === BE-B4: call_successful field normalization ===
  describe("BE-B4: call_successful field normalization (isCallSuccessful helper)", () => {
    // Helper to make a signed request with a specific call_successful value
    function makeRequestWithCallSuccessful(callSuccessful: unknown) {
      return createSignedRequest({
        conversation_id: "conv_456",
        transcript: [],
        analysis: { call_successful: callSuccessful },
      });
    }

    it("should treat boolean true as successful call", async () => {
      const response = await POST(makeRequestWithCallSuccessful(true));
      const data = await response.json();
      expect(response.status).toBe(200);
      // boolean true → call succeeded, no transcript keywords → default "failed" outcome
      // key check: must NOT treat this as no_answer (which would mean it was treated as false)
      expect(data.outcome).not.toBe("no_answer");
    });

    it("should treat boolean false as unsuccessful call → no_answer", async () => {
      const response = await POST(makeRequestWithCallSuccessful(false));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.outcome).toBe("no_answer");
    });

    it("should treat string 'success' as successful call", async () => {
      const response = await POST(makeRequestWithCallSuccessful("success"));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.outcome).not.toBe("no_answer");
    });

    it("should treat string 'failure' as unsuccessful call → no_answer", async () => {
      const response = await POST(makeRequestWithCallSuccessful("failure"));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.outcome).toBe("no_answer");
    });

    it("should treat string 'true' as successful call", async () => {
      const response = await POST(makeRequestWithCallSuccessful("true"));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.outcome).not.toBe("no_answer");
    });

    it("should treat string 'false' as unsuccessful call → no_answer", async () => {
      const response = await POST(makeRequestWithCallSuccessful("false"));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.outcome).toBe("no_answer");
    });

    it("should treat null as unsuccessful call → no_answer", async () => {
      const response = await POST(makeRequestWithCallSuccessful(null));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.outcome).toBe("no_answer");
    });

    it("should treat undefined (missing field) as unsuccessful call → no_answer", async () => {
      const response = await POST(createSignedRequest({
        conversation_id: "conv_456",
        transcript: [],
        analysis: {},
      }));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.outcome).toBe("no_answer");
    });
  });

  it("should handle transcript entries with missing message field (line 167 fallback)", async () => {
    // Exercises `entry.message || ""` in extractTranscriptText — the "" fallback
    // when entry.message is undefined/null/empty
    const request = createSignedRequest({
      conversation_id: "conv_456",
      transcript: [
        { role: "agent", message: undefined, time_in_call_secs: 0 },
        { role: "user", message: "", time_in_call_secs: 5 },
        { role: "agent", message: null, time_in_call_secs: 10 },
        { role: "user", message: "Confirmado, le esperamos.", time_in_call_secs: 15 },
      ],
      analysis: { call_successful: "success" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // The last entry has "confirmado" which matches CONFIRMED_PATTERNS
    expect(data.outcome).toBe("confirmed");
  });
});
