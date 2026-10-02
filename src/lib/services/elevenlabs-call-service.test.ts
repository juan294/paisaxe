import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initiateCall } from "./elevenlabs-call-service";
import { logger } from "@/lib/logger";
import { fingerprintElevenLabsApiKey } from "@/lib/elevenlabs-credentials";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const originalEnv = process.env;

const baseRequest = {
  customer_name: "Juan García López",
  customer_phone: "+34612345678",
  party_size: 4,
  date: "hoy",
  time: "21:00",
  special_requests: "Trona para bebé",
};

describe("elevenlabs-call-service.initiateCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      ELEVENLABS_API_KEY: "test-api-key",
      ELEVENLABS_PHONE_NUMBER_ID: "test-phone-id",
      ELEVENLABS_BOOKING_AGENT_ID:
        "agent_5201kgm2956ge8ct95yxjas867z5",
      ELEVENLABS_API_KEY_FINGERPRINT: "",
      VERCEL_ENV: "preview",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns not-configured error when env vars are missing", async () => {
    delete process.env.ELEVENLABS_BOOKING_AGENT_ID;

    const result = await initiateCall("+34985887797", baseRequest);

    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fails before an outbound call when the production key is not fingerprint-bound", async () => {
    process.env.VERCEL_ENV = "production";

    const result = await initiateCall("+34985887797", baseRequest);

    expect(result).toEqual({
      success: false,
      error: "ElevenLabs runtime credential rejected",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("accepts the bound production key and owned booking-agent identity", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.ELEVENLABS_API_KEY_FINGERPRINT =
      fingerprintElevenLabsApiKey("test-api-key");
    process.env.ELEVENLABS_BOOKING_AGENT_ID =
      "agent_5201kgm2956ge8ct95yxjas867z5";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ conversation_id: "conv_bound" }),
    });

    await expect(initiateCall("+34985887797", baseRequest)).resolves.toEqual({
      success: true,
      callSid: undefined,
      conversationId: "conv_bound",
    });
  });

  it("rejects production booking-agent identity drift before provider I/O", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.ELEVENLABS_API_KEY_FINGERPRINT =
      fingerprintElevenLabsApiKey("test-api-key");
    process.env.ELEVENLABS_BOOKING_AGENT_ID = "agent_wrong";

    const result = await initiateCall("+34985887797", baseRequest);

    expect(result).toEqual({
      success: false,
      error: "ElevenLabs booking agent identity mismatch",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects preview booking-agent identity drift before provider I/O", async () => {
    process.env.ELEVENLABS_BOOKING_AGENT_ID = "agent_wrong";

    const result = await initiateCall("+34985887797", baseRequest);

    expect(result).toEqual({
      success: false,
      error: "ElevenLabs booking agent identity mismatch",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts to the US outbound-call endpoint with formatted dynamic variables", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ conversation_id: "conv_123" }),
    });

    const result = await initiateCall("+34985887797", baseRequest);

    expect(result).toEqual({
      success: true,
      callSid: undefined,
      conversationId: "conv_123",
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://api.us.elevenlabs.io/v1/convai/twilio/outbound-call"
    );
    expect(options.method).toBe("POST");
    expect(options.headers["xi-api-key"]).toBe("test-api-key");
    expect(options.signal).toBeInstanceOf(AbortSignal);

    const body = JSON.parse(options.body);
    expect(body.agent_id).toBe("agent_5201kgm2956ge8ct95yxjas867z5");
    expect(body.agent_phone_number_id).toBe("test-phone-id");
    expect(body.to_number).toBe("+34985887797");
    expect(body.conversation_initiation_client_data.dynamic_variables).toEqual({
      customer_name: "Juan García López",
      customer_phone: "612345678", // +34 stripped for natural reading
      party_size: "4",
      date: "hoy",
      time: "nueve de la noche", // 21:00 converted
      special_requests: "Trona para bebé",
    });
  });

  // BE-H2: the pending_bookings row id is persisted (claimed) before this call
  // is placed. Sending it as an extra dynamic variable means ElevenLabs echoes
  // it back in the post_call_transcription webhook even when our own fetch to
  // ElevenLabs times out and we never learn the conversation_id — giving the
  // webhook handler an unambiguous (primary-key) fallback correlation key.
  it("BE-H2: includes booking_id as an extra dynamic variable when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ conversation_id: "conv_with_booking_id" }),
    });

    await initiateCall("+34985887797", {
      ...baseRequest,
      booking_id: "pending-row-abc-123",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.conversation_initiation_client_data.dynamic_variables.booking_id).toBe(
      "pending-row-abc-123"
    );
  });

  it("omits booking_id from dynamic variables when not provided (unchanged shape)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ conversation_id: "conv_no_booking_id" }),
    });

    await initiateCall("+34985887797", baseRequest);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(
      "booking_id" in body.conversation_initiation_client_data.dynamic_variables
    ).toBe(false);
  });

  it("defaults special_requests to 'ninguna' when omitted", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ conversation_id: "conv_ninguna" }),
    });

    await initiateCall("+34985887797", {
      ...baseRequest,
      special_requests: undefined,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(
      body.conversation_initiation_client_data.dynamic_variables.special_requests
    ).toBe("ninguna");
  });

  it("does not return or log the raw provider error body", async () => {
    const logSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: { message: "raw provider detail" } }),
    });

    const result = await initiateCall("+34985887797", baseRequest);
    expect(result.success).toBe(false);
    expect(result.error).toBe("ElevenLabs API error: 401");
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(
      "raw provider detail"
    );
  });

  it("returns callSid/conversationId only when they are non-empty strings", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ callSid: "CA_abc", conversation_id: "  " }),
    });

    const result = await initiateCall("+34985887797", baseRequest);
    expect(result.callSid).toBe("CA_abc");
    expect(result.conversationId).toBeUndefined();
  });

  it("handles fetch throwing an Error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("connection refused"));

    const result = await initiateCall("+34985887797", baseRequest);
    expect(result.success).toBe(false);
    expect(result.error).toBe("ElevenLabs request unavailable");
  });

  it("handles fetch throwing a non-Error value", async () => {
    mockFetch.mockRejectedValueOnce("string failure");

    const result = await initiateCall("+34985887797", baseRequest);
    expect(result.success).toBe(false);
    expect(result.error).toBe("ElevenLabs request unavailable");
  });

  // BE-H2: timeout/abort must set timedOut=true so callers can leave the row in
  // 'initiating' rather than marking it 'failed' (late webhooks or cron can reconcile).
  it("BE-H2: sets timedOut=true when fetch throws an AbortError (timeout signal)", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    const result = await initiateCall("+34985887797", baseRequest);
    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.error).toBe("ElevenLabs request timed out");
  });

  it("BE-H2: sets timedOut=true when fetch throws a TimeoutError", async () => {
    const timeoutError = new Error("The operation timed out");
    timeoutError.name = "TimeoutError";
    mockFetch.mockRejectedValueOnce(timeoutError);

    const result = await initiateCall("+34985887797", baseRequest);
    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it("BE-H2: does NOT set timedOut for a generic non-timeout error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("connection refused"));

    const result = await initiateCall("+34985887797", baseRequest);
    expect(result.success).toBe(false);
    expect(result.timedOut).toBeUndefined();
  });
});
