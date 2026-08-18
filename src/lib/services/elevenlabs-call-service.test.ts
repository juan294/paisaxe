import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initiateCall } from "./elevenlabs-call-service";

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
      ELEVENLABS_BOOKING_AGENT_ID: "test-booking-agent-id",
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
    expect(body.agent_id).toBe("test-booking-agent-id");
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

  it("surfaces detail.message on a non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: { message: "Invalid number" } }),
    });

    const result = await initiateCall("+34985887797", baseRequest);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid number");
  });

  it("falls back to message, then to status code, for error text", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "Server error" }),
    });
    expect((await initiateCall("+34985887797", baseRequest)).error).toBe(
      "Server error"
    );

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ unrelated: true }),
    });
    expect((await initiateCall("+34985887797", baseRequest)).error).toBe(
      "ElevenLabs API error: 502"
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
    expect(result.error).toBe("connection refused");
  });

  it("handles fetch throwing a non-Error value", async () => {
    mockFetch.mockRejectedValueOnce("string failure");

    const result = await initiateCall("+34985887797", baseRequest);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error");
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
    expect(result.error).toContain("aborted");
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
