import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

// Mock modules before importing route
vi.mock("@/lib/supabase-admin", () => ({
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
import { createAdminClient } from "@/lib/supabase-admin";
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

  it("logs [ELEVENLABS_WEBHOOK_FETCH_BOOKING_FAILED] and ignores when pending_bookings fetch errors", async () => {
    // Covers elevenlabs/route.ts:409 — fetchError branch when maybeSingle returns an error
    // The webhook returns 200+ignored so ElevenLabs doesn't retry indefinitely
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "DB connection lost" },
        }),
      }),
    });

    const request = createSignedRequest({ conversation_id: "conv_error" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ignored).toBe(true);
  });

  // BE-H2: a call that timed out on our side before ElevenLabs responded
  // never got its conversation_id persisted, so the primary lookup above
  // finds nothing even though the call may have gone through. We sent our
  // own pending_bookings.id as an extra `booking_id` dynamic variable when
  // placing the call specifically so it comes back in
  // conversation_initiation_client_data.dynamic_variables here — an
  // unambiguous (primary-key) fallback correlation key.
  describe("BE-H2: orphaned-booking fallback reconciliation via booking_id", () => {
    const orphanedBooking = {
      ...mockBooking,
      id: "orphaned-booking-id",
      conversation_id: null,
      status: "orphaned",
    };

    it("reconciles via the booking_id dynamic variable when the primary conversation_id lookup finds nothing", async () => {
      mockSelect
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        })
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: orphanedBooking, error: null }),
          }),
        });

      const request = createSignedRequest({
        conversation_id: "conv_late_arriving",
        conversation_initiation_client_data: {
          dynamic_variables: { booking_id: "orphaned-booking-id" },
        },
        transcript: buildTranscript(
          { role: "agent", message: "Hola, llamo para reservar." },
          { role: "user", message: "Perfecto, le esperamos." }
        ),
        analysis: { call_successful: "success" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.ignored).toBeUndefined();
      expect(data.bookingId).toBe("orphaned-booking-id");
      expect(data.outcome).toBe("confirmed");
      // The idempotent RPC runs against the resolved booking's id, same as
      // the direct-match path.
      expect(mockRpc).toHaveBeenCalledWith(
        "process_elevenlabs_event_idempotent",
        expect.objectContaining({ p_booking_id: "orphaned-booking-id" })
      );
      // Best-effort: link the conversation_id onto the row for future lookups.
      expect(mockUpdate).toHaveBeenCalledWith({
        conversation_id: "conv_late_arriving",
      });
    });

    it("also checks the data-wrapped conversation_initiation_client_data location", async () => {
      mockSelect
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        })
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: orphanedBooking, error: null }),
          }),
        });

      const request = createSignedRequest({
        conversation_id: "conv_data_wrapped",
        data: {
          conversation_initiation_client_data: {
            dynamic_variables: { booking_id: "orphaned-booking-id" },
          },
          transcript: [],
          analysis: { call_successful: "success" },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bookingId).toBe("orphaned-booking-id");
    });

    // Guards the uniqueness invariant: a booking_id hint must never let this
    // webhook event resolve a row that isn't actually reconcilable, even if
    // an attacker or a stale retry supplies a valid-looking id.
    it("ignores the booking_id hint when the matched row is not in an orphaned/initiating state", async () => {
      mockSelect
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        })
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { ...orphanedBooking, status: "confirmed" },
              error: null,
            }),
          }),
        });

      const request = createSignedRequest({
        conversation_id: "conv_already_resolved",
        conversation_initiation_client_data: {
          dynamic_variables: { booking_id: "orphaned-booking-id" },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ignored).toBe(true);
    });

    // Guards the uniqueness invariant: never repoint a row that already has a
    // conversation_id — that would risk two different conversations claiming
    // the same booking row.
    it("ignores the booking_id hint when the matched row already has a conversation_id", async () => {
      mockSelect
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        })
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { ...orphanedBooking, conversation_id: "conv_other" },
              error: null,
            }),
          }),
        });

      const request = createSignedRequest({
        conversation_id: "conv_already_linked",
        conversation_initiation_client_data: {
          dynamic_variables: { booking_id: "orphaned-booking-id" },
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ignored).toBe(true);
    });

    it("does not attempt a fallback lookup when no booking_id dynamic variable is present", async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const request = createSignedRequest({ conversation_id: "unknown_conv_no_hint" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ignored).toBe(true);
      // Only the primary lookup ran — no second .select() for a fallback attempt.
      expect(mockSelect).toHaveBeenCalledTimes(1);
    });
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

    // BE-H2: SMS data is now passed atomically to the RPC so the outbox row
    // is inserted in the same transaction as the booking state update.
    expect(mockRpc).toHaveBeenCalledWith(
      "process_elevenlabs_event_idempotent",
      {
        p_event_key: "post_call_transcription:conv_456",
        p_booking_id: "booking-123",
        p_outcome: "confirmed",
        p_to_phone: "+34612345678",
        p_sms_message: "Confirmation SMS",
      }
    );
    // BE-M6: outcome_message is now passed atomically to complete_booking_sms_job RPC
    // instead of a separate pending_bookings UPDATE (which could fail silently).
    expect(mockRpc).toHaveBeenCalledWith("complete_booking_sms_job", expect.objectContaining({
      p_outcome_message: "Confirmation SMS",
    }));
  });

  // BE-H2: SMS failure must NOT return 500 — booking state was already persisted
  // and the durable sms_outbox row (booking_sms_jobs) will allow retries.
  it("should return 200 (not 500) and keep SMS retryable when delivery fails", async () => {
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

    // Booking was persisted — return 200, not 500
    expect(response.status).toBe(200);
    // success=true because booking state was committed
    expect(data.success).toBe(true);
    expect(data.smsSent).toBe(false);
    expect(data.smsError).toBe("Invalid phone number");
    // SMS job must still be marked as failed for retry
    expect(mockRpc).toHaveBeenCalledWith("fail_booking_sms_job", {
      p_event_key: "post_call_transcription:conv_456",
      p_error: "Invalid phone number",
    });
  });

  // BE-H2: SMS outbox row (booking_sms_jobs) must be enqueued before attempting send
  it("should enqueue SMS outbox row before attempting Twilio send", async () => {
    const callOrder: string[] = [];

    vi.mocked(sendSMS).mockImplementation(async () => {
      callOrder.push("sendSMS");
      return { success: true, sid: "SM123" };
    });

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "process_elevenlabs_event_idempotent") {
        callOrder.push("process_elevenlabs_event_idempotent");
        return Promise.resolve({ data: "processed", error: null });
      }
      if (fn === "enqueue_booking_sms_job") {
        callOrder.push("enqueue_booking_sms_job");
        return Promise.resolve({ data: "queued", error: null });
      }
      if (fn === "claim_booking_sms_job") {
        callOrder.push("claim_booking_sms_job");
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
        callOrder.push("complete_booking_sms_job");
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

    await POST(request);

    // enqueue must happen before sendSMS
    const enqueueIdx = callOrder.indexOf("enqueue_booking_sms_job");
    const sendSMSIdx = callOrder.indexOf("sendSMS");
    expect(enqueueIdx).toBeGreaterThanOrEqual(0);
    expect(sendSMSIdx).toBeGreaterThanOrEqual(0);
    expect(enqueueIdx).toBeLessThan(sendSMSIdx);
  });

  // BE-H2: Booking state must be persisted even when Twilio is completely unavailable
  it("should persist booking state when Twilio throws an exception", async () => {
    vi.mocked(sendSMS).mockRejectedValue(new Error("Network timeout"));

    const request = createSignedRequest({
      conversation_id: "conv_456",
      transcript: buildTranscript(
        { role: "user", message: "Confirmado, le esperamos." }
      ),
      analysis: { call_successful: "success" },
    });

    const response = await POST(request);
    const data = await response.json();

    // Booking was persisted regardless of Twilio state
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.outcome).toBe("confirmed");
    expect(data.smsSent).toBe(false);
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
      p_outcome_message: "Confirmation SMS", // BE-M6: atomic outcome_message update
    });
  });

  it("returns 500 and logs [ELEVENLABS_WEBHOOK_SMS_ENQUEUE_FAILED] when enqueue_booking_sms_job errors", async () => {
    // Covers elevenlabs/route.ts:501-506 — SMS enqueue failure path
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "process_elevenlabs_event_idempotent") {
        return Promise.resolve({ data: "processed", error: null });
      }
      if (fn === "enqueue_booking_sms_job") {
        return Promise.resolve({ data: null, error: { message: "SMS outbox insert failed" } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const request = createSignedRequest({
      conversation_id: "conv_456",
      transcript: buildTranscript({ role: "user", message: "Confirmado." }),
      analysis: { call_successful: "success" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
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

    it("should include the dotted field path when a known field has the wrong type (line 115 path.length > 0 branch)", async () => {
      // A wrong-typed known field (conversation_id as number) produces an
      // "invalid_type" issue with no `keys` array, so unknownFields falls
      // through to `i.path.length > 0 ? [i.path.join(".")] : []` — exercising
      // the `> 0` (true) side of the ternary at route.ts:115.
      const loggerSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

      const payload = JSON.stringify({ conversation_id: 12345 });
      const sigHeader = createSignatureHeader(payload);
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
      // The zod schema only warns on unknown shape — it does not block the
      // request. Since `body.conversation_id` (12345) is still truthy at
      // runtime, the handler proceeds through the normal (mocked) booking
      // lookup and succeeds after logging the shape warning.
      expect(response.status).toBe(200);

      expect(loggerSpy).toHaveBeenCalledWith(
        "[WEBHOOK_UNKNOWN_SHAPE]",
        expect.objectContaining({
          webhook: "elevenlabs",
          fields: ["conversation_id"],
        })
      );

      loggerSpy.mockRestore();
    });

    it("should emit an empty fields list when the root payload is not an object (line 115 path.length === 0 branch)", async () => {
      // A root-level JSON primitive (e.g. a bare string) parses fine via
      // JSON.parse but fails the object schema with a root issue whose
      // `path` is `[]` — exercising the `=== 0` (false) side of the
      // ternary at route.ts:115, falling through to the empty-array branch.
      const loggerSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

      const payload = JSON.stringify("just a string, not an object");
      const sigHeader = createSignatureHeader(payload);
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
      // No conversation_id can be derived from a string body, so it's
      // reported missing after the shape warning is logged.
      expect(response.status).toBe(400);

      expect(loggerSpy).toHaveBeenCalledWith(
        "[WEBHOOK_UNKNOWN_SHAPE]",
        expect.objectContaining({ webhook: "elevenlabs", fields: [] })
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

  // === BE-M6: atomic outcome_message update in complete_booking_sms_job ===

  describe("BE-M6: atomic outcome_message update", () => {
    it("BE-M6: complete_booking_sms_job RPC must be called with p_outcome_message parameter", async () => {
      // The outcome_message must be passed to the RPC for atomic persistence.
      // A separate pending_bookings UPDATE must NOT be made after the RPC call,
      // as it could be lost if it fails (idempotency key prevents re-attempt).

      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "user", message: "Confirmado, le esperamos." }
        ),
        analysis: { call_successful: "success" },
      });

      await POST(request);

      expect(mockRpc).toHaveBeenCalledWith("complete_booking_sms_job", expect.objectContaining({
        p_event_key: "post_call_transcription:conv_456",
        p_provider_sid: "SM123",
        p_outcome_message: "Confirmation SMS",
      }));
    });

    it("BE-M6: separate pending_bookings.update(outcome_message) must NOT be called after complete_booking_sms_job", async () => {
      // The outcome_message update must be atomic within the RPC, not a separate
      // UPDATE statement. If the separate UPDATE fails, outcome_message is lost forever
      // because idempotency prevents re-attempt.

      const request = createSignedRequest({
        conversation_id: "conv_456",
        transcript: buildTranscript(
          { role: "user", message: "Confirmado, le esperamos." }
        ),
        analysis: { call_successful: "success" },
      });

      await POST(request);

      // The separate pending_bookings update({ outcome_message }) must not be called
      // since the outcome_message is now part of the complete_booking_sms_job RPC
      const outcomeMessageUpdates = (mockUpdate.mock.calls as unknown[][]).filter(
        (call) => {
          const updateArg = call[0] as Record<string, unknown>;
          return "outcome_message" in updateArg;
        }
      );
      expect(outcomeMessageUpdates).toHaveLength(0);
    });
  });

  // === SMS DB error paths (lines 518-523, 565, 601) ===

  describe("SMS DB error paths", () => {
    const successTranscript = {
      conversation_id: "conv_456",
      transcript: buildTranscript(
        { role: "user", message: "Confirmado, le esperamos." }
      ),
      analysis: { call_successful: "success" },
    };

    it("returns 500 when claim_booking_sms_job RPC errors (lines 518-523)", async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === "process_elevenlabs_event_idempotent") {
          return Promise.resolve({ data: "processed", error: null });
        }
        if (fn === "enqueue_booking_sms_job") {
          return Promise.resolve({ data: "queued", error: null });
        }
        if (fn === "claim_booking_sms_job") {
          return Promise.resolve({ data: null, error: { message: "lock table missing" } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const request = createSignedRequest(successTranscript);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Database error");
    });

    it("logs error and returns 200 when fail_booking_sms_job RPC errors after failed SMS (line 565)", async () => {
      vi.mocked(sendSMS).mockResolvedValue({ success: false, error: "Twilio down" });
      mockRpc.mockImplementation((fn: string) => {
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
        if (fn === "fail_booking_sms_job") {
          return Promise.resolve({ data: null, error: { message: "fail mark failed" } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const request = createSignedRequest(successTranscript);
      const response = await POST(request);
      const data = await response.json();

      // Booking state was committed — must return 200 even when fail_booking_sms_job errors
      expect(response.status).toBe(200);
      expect(data.smsSent).toBe(false);
    });

    it("returns 200 ignored when process_elevenlabs_event_idempotent reports booking_missing (lines 467-471)", async () => {
      mockRpc.mockImplementation((fn: string) => {
        if (fn === "process_elevenlabs_event_idempotent") {
          return Promise.resolve({ data: "booking_missing", error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const request = createSignedRequest(successTranscript);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.ignored).toBe(true);
      expect(data.reason).toBe("Booking missing during processing");
    });

    it("logs error and returns 200 when complete_booking_sms_job RPC errors after successful SMS (line 601)", async () => {
      vi.mocked(sendSMS).mockResolvedValue({ success: true, sid: "SM_ok" });
      mockRpc.mockImplementation((fn: string) => {
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
        if (fn === "complete_booking_sms_job") {
          return Promise.resolve({ data: null, error: { message: "complete write failed" } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const request = createSignedRequest(successTranscript);
      const response = await POST(request);
      const data = await response.json();

      // Booking state was committed — must return 200 even when complete_booking_sms_job errors
      expect(response.status).toBe(200);
      expect(data.smsSent).toBe(true);
    });

    // BE-M2: complete_booking_sms_job must be retried up to 2 times on error
    // to avoid the job staying 'processing' and re-claimable → duplicate SMS.
    it("BE-M2: complete_booking_sms_job succeeds on second attempt after initial failure", async () => {
      vi.mocked(sendSMS).mockResolvedValue({ success: true, sid: "SM_retry" });
      let completeCalls = 0;
      mockRpc.mockImplementation((fn: string) => {
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
        if (fn === "complete_booking_sms_job") {
          completeCalls += 1;
          // First call fails, second succeeds
          if (completeCalls === 1) {
            return Promise.resolve({ data: null, error: { message: "transient write error" } });
          }
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const request = createSignedRequest(successTranscript);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.smsSent).toBe(true);
      // Must have been called at least twice (retry happened)
      expect(completeCalls).toBeGreaterThanOrEqual(2);
    });

    it("BE-M2: complete_booking_sms_job logs [ELEVENLABS_WEBHOOK_SMS_COMPLETE_FAILED] after all retries exhausted", async () => {
      vi.mocked(sendSMS).mockResolvedValue({ success: true, sid: "SM_retry" });
      // Spy on logger.error to capture the final failure log
      const { logger } = await import("@/lib/logger");
      const logSpy = vi.spyOn(logger, "error");

      let completeCalls = 0;
      mockRpc.mockImplementation((fn: string) => {
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
        if (fn === "complete_booking_sms_job") {
          completeCalls += 1;
          return Promise.resolve({ data: null, error: { message: "persistent DB error" } });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const request = createSignedRequest(successTranscript);
      const response = await POST(request);
      const data = await response.json();

      // Still returns 200 (booking state was committed; this is an ops alert)
      expect(response.status).toBe(200);
      expect(data.smsSent).toBe(true);
      // complete_booking_sms_job must have been retried (2 attempts)
      expect(completeCalls).toBe(2);
      // Must have logged the failure prominently after all retries
      expect(logSpy).toHaveBeenCalledWith(
        "[ELEVENLABS_WEBHOOK_SMS_COMPLETE_FAILED]",
        expect.objectContaining({ booking_id: "booking-123" })
      );

      logSpy.mockRestore();
    });

    it("falls back to a generic message when sendSMS throws a non-Error value (line 280 else branch)", async () => {
      // sendError instanceof Error ? sendError.message : "SMS send threw unexpectedly"
      // Throwing a plain string (not an Error instance) exercises the ":" side.
      vi.mocked(sendSMS).mockRejectedValue("raw string rejection, not an Error");

      const request = createSignedRequest(successTranscript);
      const response = await POST(request);
      const data = await response.json();

      // Booking state was still committed — return 200, not 500.
      expect(response.status).toBe(200);
      expect(data.smsSent).toBe(false);
      expect(data.smsError).toBe("SMS send threw unexpectedly");
      expect(mockRpc).toHaveBeenCalledWith("fail_booking_sms_job", {
        p_event_key: "post_call_transcription:conv_456",
        p_error: "SMS send threw unexpectedly",
      });
    });

    it("falls back to a default error message when a failed SMS result has no error string (line 301 ?? branch)", async () => {
      // p_error: smsResult.error ?? "SMS delivery failed"
      // success: false with `error` omitted exercises the ?? fallback.
      vi.mocked(sendSMS).mockResolvedValue({ success: false });

      const request = createSignedRequest(successTranscript);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.smsSent).toBe(false);
      expect(data.smsError).toBeUndefined();
      expect(mockRpc).toHaveBeenCalledWith("fail_booking_sms_job", {
        p_event_key: "post_call_transcription:conv_456",
        p_error: "SMS delivery failed",
      });
    });

    it("passes null as the provider sid when a successful SMS result has no sid (line 342 ?? branch)", async () => {
      // p_provider_sid: smsResult.sid ?? null
      // success: true with `sid` omitted exercises the ?? fallback to null.
      vi.mocked(sendSMS).mockResolvedValue({ success: true });

      const request = createSignedRequest(successTranscript);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.smsSent).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("complete_booking_sms_job", {
        p_event_key: "post_call_transcription:conv_456",
        p_provider_sid: null,
        p_outcome_message: "Confirmation SMS",
      });
    });
  });
});
