import { readSseStream } from "@/hooks/use-sse-stream";
import { parseSseEvent } from "@/types/sse";

type ChatApiErrorBody = {
  error?: unknown;
  message?: unknown;
  debug?: { message?: unknown };
};

export interface StreamedChatResponse {
  content: string;
  sources: Array<{ title: string; page?: number }>;
}

/**
 * QA-H3 (#870): parse a response from /api/chat/stream — the SSE endpoint
 * real users actually hit — into the same shape the QA test validators
 * expect. Falls back to plain JSON parsing for the non-streaming
 * short-circuit responses the route still returns for some cases (rate
 * limiting is handled before this is called; injection detection and the
 * generic-redirect path return `Content-Type: application/json` even though
 * the route is otherwise a streaming endpoint).
 *
 * An in-band SSE `{type: "error"}` event (e.g. "search_unavailable",
 * "response_timeout") is surfaced as a thrown Error even when the HTTP
 * status is 200 — the stream route always responds 200 for these and
 * signals failure only inside the event stream.
 */
export async function parseStreamResponse(
  response: Response
): Promise<StreamedChatResponse> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const data = (await response.json()) as {
      message?: string;
      content?: string;
      response?: string;
      sources?: StreamedChatResponse["sources"];
    };
    return {
      content: data.message || data.content || data.response || "",
      sources: data.sources || [],
    };
  }

  if (!response.body) {
    throw new Error("Streaming chat response has no body");
  }

  let content = "";
  let sources: StreamedChatResponse["sources"] = [];
  let sseError: string | null = null;
  let streamError: Error | null = null;

  // Reuse the same SSE buffer reader the browser chat UI uses
  // (src/hooks/use-sse-stream.ts) instead of re-implementing the
  // decode/split-on-double-newline loop here.
  await readSseStream(response.body, {
    onEvent: (rawLine) => {
      const event = parseSseEvent(rawLine);
      if (!event) return;

      if (event.type === "text") {
        content += event.content;
      } else if (event.type === "done") {
        sources = event.sources;
      } else if (event.type === "error") {
        sseError = event.message;
      }
    },
    onDone: () => {},
    onError: (err) => {
      streamError = err;
    },
  });

  if (streamError) {
    throw streamError;
  }
  if (sseError) {
    throw new Error(`Chat stream error: ${sseError}`);
  }

  return { content, sources };
}

export async function formatChatApiError(response: Response): Promise<string> {
  const bodyText = await response.text().catch(() => "");
  if (!bodyText) {
    return `Chat API error: ${response.status}`;
  }

  try {
    const errorBody = JSON.parse(bodyText) as ChatApiErrorBody;
    const reasons = [
      errorBody.error,
      errorBody.message,
      errorBody.debug?.message,
    ].filter(
      (reason, index, values): reason is string =>
        typeof reason === "string" && reason.length > 0 && values.indexOf(reason) === index
    );

    if (reasons.length > 0) {
      return `Chat API error: ${response.status} (${reasons.join(": ")})`;
    }
  } catch {
    // Fall through to a bounded raw-body preview for non-JSON errors.
  }

  return `Chat API error: ${response.status} (${bodyText.slice(0, 200)})`;
}

export class RepeatedServerFailureCircuit {
  private fingerprint = "";
  private identicalFailureCount = 0;
  private blockedError: Error | null = null;

  constructor(private readonly threshold = 4) {
    if (!Number.isInteger(threshold) || threshold < 1) {
      throw new Error("RepeatedServerFailureCircuit threshold must be a positive integer");
    }
  }

  assertRequestAllowed(): void {
    if (this.blockedError) {
      throw this.blockedError;
    }
  }

  recordFailure(status: number, detail: string): Error {
    const nextFingerprint = `${status}:${detail}`;
    if (nextFingerprint === this.fingerprint) {
      this.identicalFailureCount += 1;
    } else {
      this.fingerprint = nextFingerprint;
      this.identicalFailureCount = 1;
    }

    if (this.identicalFailureCount >= this.threshold) {
      this.blockedError = new Error(
        `QA BLOCKED: ${this.identicalFailureCount} identical HTTP ${status} responses — ${detail}`
      );
      return this.blockedError;
    }

    return new Error(detail);
  }

  recordSuccess(): void {
    this.fingerprint = "";
    this.identicalFailureCount = 0;
    this.blockedError = null;
  }
}
