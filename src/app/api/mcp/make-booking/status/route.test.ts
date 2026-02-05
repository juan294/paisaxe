import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Spy on console methods to suppress test output
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

describe("/api/mcp/make-booking/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createFormDataRequest(data: Record<string, string>): Request {
    const formData = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });

    return new Request("http://localhost:3000/api/mcp/make-booking/status", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    });
  }

  it("should acknowledge completed call with human answer", async () => {
    const request = createFormDataRequest({
      CallSid: "CA123456789",
      CallStatus: "completed",
      CallDuration: "120",
      AnsweredBy: "human",
      To: "+34985887797",
      From: "+34600000000",
      Direction: "outbound-api",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should acknowledge completed call with machine answer (voicemail)", async () => {
    const request = createFormDataRequest({
      CallSid: "CA123456789",
      CallStatus: "completed",
      CallDuration: "30",
      AnsweredBy: "machine",
      To: "+34985887797",
      From: "+34600000000",
      Direction: "outbound-api",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should acknowledge busy status", async () => {
    const request = createFormDataRequest({
      CallSid: "CA123456789",
      CallStatus: "busy",
      To: "+34985887797",
      From: "+34600000000",
      Direction: "outbound-api",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should acknowledge no-answer status", async () => {
    const request = createFormDataRequest({
      CallSid: "CA123456789",
      CallStatus: "no-answer",
      To: "+34985887797",
      From: "+34600000000",
      Direction: "outbound-api",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should acknowledge failed status", async () => {
    const request = createFormDataRequest({
      CallSid: "CA123456789",
      CallStatus: "failed",
      To: "+34985887797",
      From: "+34600000000",
      Direction: "outbound-api",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should acknowledge intermediate statuses (queued, ringing, in-progress)", async () => {
    const intermediateStatuses = ["queued", "ringing", "in-progress"];

    for (const status of intermediateStatuses) {
      const request = createFormDataRequest({
        CallSid: "CA123456789",
        CallStatus: status,
        To: "+34985887797",
        From: "+34600000000",
        Direction: "outbound-api",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.received).toBe(true);
    }
  });

  it("should handle processing errors gracefully", async () => {
    // Create a request that will throw when getting formData
    const badRequest = {
      formData: () => Promise.reject(new Error("Parse error")),
    } as unknown as Request;

    const response = await POST(badRequest);
    const data = await response.json();

    // Should still return 200 to prevent Twilio retries
    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(data.error).toBe("Processing error");
  });

  it("should handle completed call without AnsweredBy field", async () => {
    const request = createFormDataRequest({
      CallSid: "CA123456789",
      CallStatus: "completed",
      CallDuration: "60",
      To: "+34985887797",
      From: "+34600000000",
      Direction: "outbound-api",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should handle unknown AnsweredBy value", async () => {
    const request = createFormDataRequest({
      CallSid: "CA123456789",
      CallStatus: "completed",
      CallDuration: "60",
      AnsweredBy: "unknown",
      To: "+34985887797",
      From: "+34600000000",
      Direction: "outbound-api",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });
});
