import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the useSseStream utility function.
 *
 * useSseStream reads a ReadableStream of SSE (Server-Sent Events), splits it
 * on double-newlines, and calls onEvent for each parsed line. It calls onDone
 * when the stream ends and onError when an error is thrown.
 *
 * Note: useSseStream is NOT a React hook — it is a plain async function that
 * encapsulates the SSE reading loop. This makes it testable without React
 * test utilities and reusable in any context.
 */
import { readSseStream } from "./use-sse-stream";

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe("readSseStream", () => {
  it("calls onEvent for each double-newline delimited SSE chunk", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const stream = makeStream([
      `data: {"type":"text","content":"Hello"}\n\n`,
      `data: {"type":"text","content":" world"}\n\n`,
      `data: {"type":"done","images":[],"sources":[]}\n\n`,
    ]);

    await readSseStream(stream, { onEvent, onDone, onError });

    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent).toHaveBeenNthCalledWith(
      1,
      `data: {"type":"text","content":"Hello"}`
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      2,
      `data: {"type":"text","content":" world"}`
    );
    expect(onEvent).toHaveBeenNthCalledWith(
      3,
      `data: {"type":"done","images":[],"sources":[]}`
    );
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("handles a single chunk containing multiple events", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    // All events arrive in one chunk
    const combined =
      `data: {"type":"text","content":"a"}\n\n` +
      `data: {"type":"text","content":"b"}\n\n` +
      `data: {"type":"done","images":[],"sources":[]}\n\n`;

    const stream = makeStream([combined]);

    await readSseStream(stream, { onEvent, onDone, onError });

    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("handles events split across multiple chunks (buffering)", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    // The done event is split: first chunk has 'data: {…}\n', second has '\n'
    const stream = makeStream([
      `data: {"type":"text","content":"hello"}\n\n`,
      `data: {"type":"done","images":[],"sources":[]}`,
      `\n\n`,
    ]);

    await readSseStream(stream, { onEvent, onDone, onError });

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("processes remaining buffer content after stream ends (no trailing \\n\\n)", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    // The last event has no trailing \n\n — it stays in the buffer when done=true
    const stream = makeStream([
      `data: {"type":"text","content":"Hello"}\n\n`,
      // No trailing \n\n — will be left in buffer
      `data: {"type":"done","images":[],"sources":[]}`,
    ]);

    await readSseStream(stream, { onEvent, onDone, onError });

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenLastCalledWith(
      `data: {"type":"done","images":[],"sources":[]}`
    );
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onError and stops when reader throws", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    let readCount = 0;
    const failingStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (readCount === 0) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(`data: {"type":"text","content":"ok"}\n\n`)
          );
          readCount++;
        } else {
          throw new Error("stream read error");
        }
      },
    });

    await readSseStream(failingStream, { onEvent, onDone, onError });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onDone).not.toHaveBeenCalled();
  });

  it("calls onError when passed a null/undefined stream", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    // Simulates response.body being null
    await readSseStream(null as unknown as ReadableStream<Uint8Array>, {
      onEvent,
      onDone,
      onError,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onEvent).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("handles an empty stream (no events)", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const emptyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    await readSseStream(emptyStream, { onEvent, onDone, onError });

    expect(onEvent).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("handles SSE lines mixed with non-data lines in the same chunk", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    // SSE spec allows comment lines (:) and named events (event:), but
    // our parser only uses the raw line — the caller decides what to do with it.
    // Here we verify readSseStream passes ALL lines (including non-data) to onEvent
    // so the caller can filter.
    const stream = makeStream([
      `:comment\n\n`,
      `data: {"type":"text","content":"hi"}\n\n`,
      `data: {"type":"done","images":[],"sources":[]}\n\n`,
    ]);

    await readSseStream(stream, { onEvent, onDone, onError });

    // readSseStream passes all non-empty lines — caller filters them
    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(onEvent).toHaveBeenNthCalledWith(1, `:comment`);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores empty lines between events (does not call onEvent for empty strings)", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    // \n\n creates an empty trailing element when split — should be filtered out
    const stream = makeStream([
      `data: {"type":"text","content":"X"}\n\n`,
      `data: {"type":"done","images":[],"sources":[]}\n\n`,
    ]);

    await readSseStream(stream, { onEvent, onDone, onError });

    // Only non-empty lines should reach onEvent
    for (const [rawLine] of onEvent.mock.calls) {
      expect((rawLine as string).trim()).not.toBe("");
    }
  });

  it("AbortError propagates to onError", async () => {
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const abortError = new DOMException("Aborted", "AbortError");
    const abortStream = new ReadableStream<Uint8Array>({
      pull() {
        throw abortError;
      },
    });

    await readSseStream(abortStream, { onEvent, onDone, onError });

    expect(onError).toHaveBeenCalledWith(abortError);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("wraps a non-Error, non-DOMException thrown value in a new Error (line 78)", async () => {
    // This covers the final else branch: `err` is not an Error instance and does
    // not have both `name` and `message` properties, so it is wrapped via String().
    const onEvent = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const primitiveStream = new ReadableStream<Uint8Array>({
      pull() {
         
        throw 42; // plain number — not an Error, not a DOMException-like object
      },
    });

    await readSseStream(primitiveStream, { onEvent, onDone, onError });

    expect(onError).toHaveBeenCalledTimes(1);
    const [wrapped] = onError.mock.calls[0] as [Error];
    expect(wrapped).toBeInstanceOf(Error);
    expect(wrapped.message).toBe("42");
    expect(onDone).not.toHaveBeenCalled();
  });
});
