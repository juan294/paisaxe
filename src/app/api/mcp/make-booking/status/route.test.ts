import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("/api/mcp/make-booking/status", () => {
  it("should acknowledge receipt with 200", async () => {
    const request = new Request("http://localhost:3000/api/mcp/make-booking/status", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        CallSid: "CA123456789",
        CallStatus: "completed",
        CallDuration: "120",
        AnsweredBy: "human",
        To: "+34985887797",
        From: "+34600000000",
        Direction: "outbound-api",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it("should return 200 regardless of request content", async () => {
    // Even a bad request should get 200 to prevent Twilio retries
    const badRequest = {
      formData: () => Promise.reject(new Error("Parse error")),
    } as unknown as Request;

    const response = await POST(badRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });
});
