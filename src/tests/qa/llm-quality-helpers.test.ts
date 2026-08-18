/**
 * QA-H3 (#870): unit tests for the SSE-response parsing helper used by the
 * weekly LLM quality suite once it targets /api/chat/stream instead of the
 * legacy, non-streaming /api/chat endpoint.
 *
 * These are pure-function tests against a synthetic Response — no live
 * server or model call required, matching the "prefer automated
 * verification" testing philosophy for something that used to only be
 * exercisable by running the full, budget-consuming QA suite against a
 * live app.
 */
import { describe, it, expect } from "vitest";
import { parseStreamResponse } from "./llm-quality-helpers";

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
});
