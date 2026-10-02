// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  RepeatedServerFailureCircuit,
  formatChatApiError,
  parseStreamResponse,
} from "../src/tests/qa/llm-quality-helpers";

function sseResponse(body: string, contentType = "text/event-stream"): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

function sseEvent(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

describe("parseStreamResponse", () => {
  it("accumulates text from multiple 'text' events into content", async () => {
    const body =
      sseEvent({ type: "text", content: "Hola, " }) +
      sseEvent({ type: "text", content: "bienvenido a Asturias." });

    const result = await parseStreamResponse(sseResponse(body));

    expect(result.content).toBe("Hola, bienvenido a Asturias.");
  });

  it("extracts sources from the 'done' event", async () => {
    const body =
      sseEvent({ type: "text", content: "Fabada is a stew." }) +
      sseEvent({
        type: "done",
        images: [],
        sources: [{ title: "guide.pdf", page: 3 }],
      });

    const result = await parseStreamResponse(sseResponse(body));

    expect(result.content).toBe("Fabada is a stew.");
    expect(result.sources).toEqual([{ title: "guide.pdf", page: 3 }]);
  });

  it("throws when an in-band SSE 'error' event arrives, even though the HTTP status is 200", async () => {
    const body = sseEvent({ type: "error", message: "search_unavailable" });

    await expect(parseStreamResponse(sseResponse(body))).rejects.toThrow(
      "search_unavailable"
    );
  });

  it("handles SSE events split across multiple stream chunks", async () => {
    const full = sseEvent({ type: "text", content: "split across chunks" });
    const encoder = new TextEncoder();
    const bytes = encoder.encode(full);
    const midpoint = Math.floor(bytes.length / 2);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, midpoint));
        controller.enqueue(bytes.slice(midpoint));
        controller.close();
      },
    });
    const response = new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });

    const result = await parseStreamResponse(response);
    expect(result.content).toBe("split across chunks");
  });

  it("ignores non-SSE lines and ignores a stray trailing partial event", async () => {
    const body = sseEvent({ type: "text", content: "ok" }) + "data: {not valid json";

    const result = await parseStreamResponse(sseResponse(body));
    expect(result.content).toBe("ok");
  });

  it("falls back to JSON parsing for a non-streaming short-circuit response (e.g. injection detection)", async () => {
    const response = new Response(
      JSON.stringify({ message: "Generic redirect", flagged: true, sources: [] }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

    const result = await parseStreamResponse(response);
    expect(result.content).toBe("Generic redirect");
    expect(result.sources).toEqual([]);
  });

  it("returns an empty sources array when the stream ends without a 'done' event", async () => {
    const body = sseEvent({ type: "text", content: "no done event" });

    const result = await parseStreamResponse(sseResponse(body));
    expect(result.content).toBe("no done event");
    expect(result.sources).toEqual([]);
  });

  it("throws when response.body is null", async () => {
    const response = new Response(null, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
    Object.defineProperty(response, "body", { value: null });

    await expect(parseStreamResponse(response)).rejects.toThrow(
      "Streaming chat response has no body"
    );
  });

  it("throws when the stream emits an error", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("Stream error"));
      },
    });
    const response = new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });

    await expect(parseStreamResponse(response)).rejects.toThrow("Stream error");
  });
});

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
