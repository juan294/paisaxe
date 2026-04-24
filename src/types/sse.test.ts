import { describe, expect, it } from "vitest";
import type { ImageResult, Source } from "@/types";
import { encodeSseEvent, parseSseEvent } from "./sse";

describe("types/sse", () => {
  it("encodes and parses text events", () => {
    const event = { type: "text" as const, content: "Hola" };

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
    const event = { type: "done" as const, images, sources };

    expect(parseSseEvent(`data: ${JSON.stringify(event)}`)).toEqual(event);
  });

  it("parses error events", () => {
    const event = {
      type: "error",
      message: "stream_failed",
    } as const;

    expect(parseSseEvent(`data: ${JSON.stringify(event)}`)).toEqual(event);
  });

  it("ignores unknown fields on error events", () => {
    expect(
      parseSseEvent(
        `data: ${JSON.stringify({ type: "error", message: "legacy", extra: 1 })}`
      )
    ).toEqual({
      type: "error",
      message: "legacy",
    });
  });

  it("returns null for invalid SSE lines", () => {
    expect(parseSseEvent("event: ping")).toBeNull();
    expect(parseSseEvent("data: {invalid json}")).toBeNull();
    expect(parseSseEvent(`data: ${JSON.stringify({ type: "unknown" })}`)).toBeNull();
  });
});
