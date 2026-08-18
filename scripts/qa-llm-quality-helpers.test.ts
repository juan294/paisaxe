// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  RepeatedServerFailureCircuit,
  formatChatApiError,
} from "../src/tests/qa/llm-quality-helpers";

describe("formatChatApiError", () => {
  it("returns error with status when response body is empty", async () => {
    const response = new Response("", { status: 500 });
    const error = await formatChatApiError(response);
    expect(error).toBe("Chat API error: 500");
  });

  it("extracts error field from JSON response", async () => {
    const response = new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
    const error = await formatChatApiError(response);
    expect(error).toContain("Chat API error: 500");
    expect(error).toContain("Internal server error");
  });

  it("extracts message field from JSON response", async () => {
    const response = new Response(JSON.stringify({ message: "Bad request" }), {
      status: 400,
    });
    const error = await formatChatApiError(response);
    expect(error).toContain("Chat API error: 400");
    expect(error).toContain("Bad request");
  });

  it("extracts debug.message field from JSON response", async () => {
    const response = new Response(JSON.stringify({ debug: { message: "DB timeout" } }), {
      status: 503,
    });
    const error = await formatChatApiError(response);
    expect(error).toContain("Chat API error: 503");
    expect(error).toContain("DB timeout");
  });

  it("includes nested debug details in chat API errors", async () => {
    const response = Response.json(
      {
        error: "Internal server error",
        debug: { message: "Anthropic credit balance is too low" },
      },
      { status: 500 }
    );

    await expect(formatChatApiError(response)).resolves.toBe(
      "Chat API error: 500 (Internal server error: Anthropic credit balance is too low)"
    );
  });

  it("combines multiple error fields with colon separator", async () => {
    const response = new Response(
      JSON.stringify({
        error: "Failed",
        message: "Timeout",
        debug: { message: "Connection lost" },
      }),
      { status: 502 }
    );
    const error = await formatChatApiError(response);
    expect(error).toContain("Chat API error: 502");
    expect(error).toContain("Failed");
    expect(error).toContain("Timeout");
  });

  it("deduplicates repeated error reasons", async () => {
    const response = new Response(
      JSON.stringify({
        error: "Error message",
        message: "Error message",
      }),
      { status: 500 }
    );
    const error = await formatChatApiError(response);
    const occurrences = (error.match(/Error message/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it("ignores empty error fields", async () => {
    const response = new Response(JSON.stringify({ error: "", message: "Real error" }), {
      status: 400,
    });
    const error = await formatChatApiError(response);
    expect(error).toContain("Real error");
    expect(error).not.toContain("Real error: Real error");
  });

  it("handles malformed JSON by returning raw body preview", async () => {
    const response = new Response("Not JSON at all", { status: 500 });
    const error = await formatChatApiError(response);
    expect(error).toContain("Chat API error: 500");
    expect(error).toContain("Not JSON at all");
  });

  it("truncates long raw body to 200 characters", async () => {
    const longBody = "x".repeat(300);
    const response = new Response(longBody, { status: 500 });
    const error = await formatChatApiError(response);
    expect(error).toContain("Chat API error: 500");
    expect(error.length).toBeLessThan(250);
  });

  it("handles response.text() throwing an error", async () => {
    const response = new Response("test", { status: 500 });
    const textSpy = vi.spyOn(response, "text").mockRejectedValue(new Error("Read failed"));
    const error = await formatChatApiError(response);
    expect(error).toBe("Chat API error: 500");
    textSpy.mockRestore();
  });
});

describe("RepeatedServerFailureCircuit", () => {
  it("allows requests by default", () => {
    const circuit = new RepeatedServerFailureCircuit();
    expect(() => circuit.assertRequestAllowed()).not.toThrow();
  });

  it("throws when threshold of identical failures is reached", () => {
    const circuit = new RepeatedServerFailureCircuit(2);
    circuit.recordFailure(500, "error");
    circuit.recordFailure(500, "error");
    expect(() => circuit.assertRequestAllowed()).toThrow();
  });

  it("blocks future requests after four identical server failures", () => {
    const circuit = new RepeatedServerFailureCircuit(4);
    const detail = "Chat API error: 500 (credit balance is too low)";

    for (let count = 1; count < 4; count += 1) {
      expect(circuit.recordFailure(500, detail).message).toBe(detail);
      expect(() => circuit.assertRequestAllowed()).not.toThrow();
    }

    expect(circuit.recordFailure(500, detail).message).toContain(
      "QA BLOCKED: 4 identical HTTP 500 responses"
    );
    expect(() => circuit.assertRequestAllowed()).toThrow(
      "QA BLOCKED: 4 identical HTTP 500 responses"
    );
  });

  it("includes count and status in blocked error message", () => {
    const circuit = new RepeatedServerFailureCircuit(2);
    circuit.recordFailure(503, "Service Unavailable");
    circuit.recordFailure(503, "Service Unavailable");
    expect(() => circuit.assertRequestAllowed()).toThrow(/2 identical HTTP 503/);
  });

  it("resets count when failure fingerprint changes", () => {
    const circuit = new RepeatedServerFailureCircuit(2);
    circuit.recordFailure(500, "error1");
    circuit.recordFailure(500, "error2");
    expect(() => circuit.assertRequestAllowed()).not.toThrow();
  });

  it("resets the identical-failure count after a success", () => {
    const circuit = new RepeatedServerFailureCircuit(2);
    const detail = "Chat API error: 503 (unavailable)";

    circuit.recordFailure(503, detail);
    circuit.recordSuccess();

    expect(circuit.recordFailure(503, detail).message).toBe(detail);
    expect(() => circuit.assertRequestAllowed()).not.toThrow();
  });

  it("returns error from recordFailure when below threshold", () => {
    const circuit = new RepeatedServerFailureCircuit(3);
    const error = circuit.recordFailure(500, "test error");
    expect(error.message).toBe("test error");
  });

  it("returns circuit-blocked error from recordFailure when threshold reached", () => {
    const circuit = new RepeatedServerFailureCircuit(2);
    circuit.recordFailure(500, "error");
    const error = circuit.recordFailure(500, "error");
    expect(error.message).toContain("QA BLOCKED");
  });

  it("throws error on invalid threshold (zero)", () => {
    expect(() => new RepeatedServerFailureCircuit(0)).toThrow(
      /threshold must be a positive integer/
    );
  });

  it("throws error on invalid threshold (negative)", () => {
    expect(() => new RepeatedServerFailureCircuit(-1)).toThrow(
      /threshold must be a positive integer/
    );
  });

  it("throws error on invalid threshold (non-integer)", () => {
    expect(() => new RepeatedServerFailureCircuit(1.5)).toThrow(
      /threshold must be a positive integer/
    );
  });

  it("keeps blocking on repeated checks after threshold is reached", () => {
    const circuit = new RepeatedServerFailureCircuit(2);
    circuit.recordFailure(500, "error");
    circuit.recordFailure(500, "error");
    expect(() => circuit.assertRequestAllowed()).toThrow();
    expect(() => circuit.assertRequestAllowed()).toThrow();
  });
});
