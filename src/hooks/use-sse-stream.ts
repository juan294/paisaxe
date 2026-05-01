/**
 * readSseStream — low-level SSE buffer reader.
 *
 * Reads a ReadableStream<Uint8Array>, splits on double-newlines (\n\n),
 * and calls `onEvent` for each non-empty line. Calls `onDone` when the
 * stream ends cleanly, or `onError` if an error is thrown.
 *
 * Design notes:
 * - This is a plain async function, not a React hook, so it can be tested
 *   without @testing-library/react and reused anywhere.
 * - The caller is responsible for parsing the raw line (e.g. with parseSseEvent).
 * - AbortError and all other errors are forwarded to onError — the caller
 *   decides whether to ignore AbortError.
 */

interface SseStreamOptions {
  /** Called for each non-empty double-newline-delimited SSE line. */
  onEvent: (rawLine: string) => void;
  /** Called once when the stream ends cleanly. */
  onDone: () => void;
  /** Called if an error occurs (including AbortError). */
  onError: (error: Error) => void;
}

export async function readSseStream(
  stream: ReadableStream<Uint8Array>,
  options: SseStreamOptions
): Promise<void> {
  const { onEvent, onDone, onError } = options;

  if (!stream) {
    onError(new Error("No readable stream provided"));
    return;
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      // Keep the last (potentially incomplete) chunk in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim()) {
          onEvent(line);
        }
      }
    }

    // Process any remaining buffer content after stream ends
    if (buffer.trim()) {
      onEvent(buffer.trim());
    }

    onDone();
  } catch (err) {
    // DOMException (e.g. AbortError) is not always an Error subclass in all environments,
    // so we cast it when it has name + message, otherwise wrap it.
    if (err instanceof Error) {
      onError(err);
    } else if (
      err !== null &&
      typeof err === "object" &&
      "name" in err &&
      "message" in err
    ) {
      // DOMException quacks like an Error — pass it through as-is
      onError(err as Error);
    } else {
      onError(new Error(String(err)));
    }
  }
}
