import { describe, expect, it } from "vitest";
import type { ImageResult, Source } from "@/types";
import {
  encodeSseEvent,
  parseSseEvent,
  type ChatDoneEvent,
  type ChatErrorEvent,
  type ChatTextEvent,
} from "./sse";

describe("types/sse", () => {
  it("encodes and parses text events", () => {
    const event: ChatTextEvent = { type: "text", content: "Hola" };

    expect(encodeSseEvent(event)).toBe(`data: ${JSON.stringify(event)}\n\n`);
    expect(parseSseEvent(`data: ${JSON.stringify(event)}`)).toEqual(event);
  });

  it("parses done events with images and sources", () => {
    const images: ImageResult[] = [
      { id: "img-1", path: "/test.jpg", sourcePdf: "guide.pdf" },
    ];
    const sources: Source[] = [
      { id: "src-1", title: "Guide", sourcePdf: "guide.pdf", snippet: "Snippet" },
    ];
    const event: ChatDoneEvent = { type: "done", images, sources };

    expect(parseSseEvent(`data: ${JSON.stringify(event)}`)).toEqual(event);
  });

  it("parses error events with partial-content metadata", () => {
    const event: ChatErrorEvent = {
      type: "error",
      message: "stream_failed",
      hadPartialContent: true,
    };

    expect(parseSseEvent(`data: ${JSON.stringify(event)}`)).toEqual(event);
  });

  it("defaults missing hadPartialContent to false for backward compatibility", () => {
    expect(
      parseSseEvent(`data: ${JSON.stringify({ type: "error", message: "legacy" })}`)
    ).toEqual({
      type: "error",
      message: "legacy",
      hadPartialContent: false,
    });
  });

  it("returns null for invalid SSE lines", () => {
    expect(parseSseEvent("event: ping")).toBeNull();
    expect(parseSseEvent("data: {invalid json}")).toBeNull();
    expect(parseSseEvent(`data: ${JSON.stringify({ type: "unknown" })}`)).toBeNull();
  });
});
