import { describe, it, expect } from "vitest";
import { parseChatSmokeEvents, assertChatSmokeShape } from "./chat-smoke";

function sseBody(...events: unknown[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

describe("parseChatSmokeEvents", () => {
  it("parses text, done, and error events from an SSE body", () => {
    const body = sseBody(
      { type: "text", content: "Los Lagos de Covadonga son " },
      { type: "text", content: "un lugar impresionante." },
      { type: "done", images: [], sources: [{ id: "chunk-1" }] }
    );

    expect(parseChatSmokeEvents(body)).toEqual([
      { type: "text", content: "Los Lagos de Covadonga son " },
      { type: "text", content: "un lugar impresionante." },
      { type: "done", images: [], sources: [{ id: "chunk-1" }] },
    ]);
  });

  it("parses an error event", () => {
    const body = sseBody({ type: "error", message: "search_unavailable" });
    expect(parseChatSmokeEvents(body)).toEqual([
      { type: "error", message: "search_unavailable" },
    ]);
  });

  it("skips malformed or unrecognized lines rather than throwing", () => {
    const body = [
      "data: not json\n\n",
      `data: ${JSON.stringify({ type: "text" })}\n\n`, // missing content
      `data: ${JSON.stringify({ type: "unknown", foo: "bar" })}\n\n`,
      ": keep-alive comment\n\n",
      `data: ${JSON.stringify({ type: "text", content: "ok" })}\n\n`,
    ].join("");

    expect(parseChatSmokeEvents(body)).toEqual([{ type: "text", content: "ok" }]);
  });

  it("returns an empty array for an empty body", () => {
    expect(parseChatSmokeEvents("")).toEqual([]);
  });
});

describe("assertChatSmokeShape", () => {
  it("passes for a well-formed stream: non-empty text + done with >=1 source", () => {
    expect(() =>
      assertChatSmokeShape([
        { type: "text", content: "Los Lagos de Covadonga son un lugar impresionante." },
        { type: "done", images: [], sources: [{ id: "chunk-1" }] },
      ])
    ).not.toThrow();
  });

  it("throws when the stream carries an error event", () => {
    expect(() =>
      assertChatSmokeShape([{ type: "error", message: "search_unavailable" }])
    ).toThrow(/search_unavailable/);
  });

  it("throws when there is no non-empty text event", () => {
    expect(() =>
      assertChatSmokeShape([
        { type: "text", content: "   " },
        { type: "done", images: [], sources: [{ id: "chunk-1" }] },
      ])
    ).toThrow(/no non-empty text event/);
  });

  it("throws when there is no terminal done event", () => {
    expect(() =>
      assertChatSmokeShape([{ type: "text", content: "hola" }])
    ).toThrow(/no terminal done event/);
  });

  it("throws when the done event carries zero sources — proof retrieval never ran", () => {
    expect(() =>
      assertChatSmokeShape([
        { type: "text", content: "hola" },
        { type: "done", images: [], sources: [] },
      ])
    ).toThrow(/zero sources/);
  });
});
