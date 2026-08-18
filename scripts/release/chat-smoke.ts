/**
 * Chat-smoke probe assertions (QA-H2, #869).
 *
 * Every browser-level chat test intercepts `/api/chat/stream` with a canned
 * SSE response, and none of the required release probes exercises the real
 * embedding → search → rerank → generate pipeline. A Voyage dimension
 * change, a `match_chunks` signature drift, an SDK breaking change, or an
 * expired key (the exact incident class this project has already lived
 * through) would produce green CI and a broken product.
 *
 * This module holds the pure SSE-parsing and shape-assertion logic so it can
 * be unit-tested against a mocked stream (see chat-smoke.test.ts), mirroring
 * probe-guards.ts. The Playwright spec (e2e/release-required.spec.ts) drives
 * the real HTTP call against a deployed origin and delegates to these
 * functions for the assertions.
 *
 * Assertions are on SHAPE only, never on answer content: HTTP 200,
 * text/event-stream, at least one non-empty text event, and a terminal done
 * event carrying at least one source — proof that retrieval actually ran,
 * not just that Claude answered from nothing.
 */

export type ChatSmokeEvent =
  | { type: "text"; content: string }
  | { type: "done"; images: unknown[]; sources: unknown[] }
  | { type: "error"; message: string };

/**
 * Parses a raw SSE response body (`data: {...}\n\n` lines) into typed chat
 * events. Malformed or unrecognized lines are skipped rather than thrown —
 * the caller decides what an incomplete stream means.
 */
export function parseChatSmokeEvents(body: string): ChatSmokeEvent[] {
  const events: ChatSmokeEvent[] = [];

  for (const chunk of body.split("\n\n")) {
    const line = chunk.trim();
    if (!line.startsWith("data: ")) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line.slice("data: ".length));
    } catch {
      continue;
    }

    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) continue;
    const event = parsed as Record<string, unknown>;

    if (event.type === "text" && typeof event.content === "string") {
      events.push({ type: "text", content: event.content });
    } else if (
      event.type === "done" &&
      Array.isArray(event.images) &&
      Array.isArray(event.sources)
    ) {
      events.push({ type: "done", images: event.images, sources: event.sources });
    } else if (event.type === "error" && typeof event.message === "string") {
      events.push({ type: "error", message: event.message });
    }
  }

  return events;
}

/**
 * Throws a descriptive error unless the parsed events prove the full
 * retrieval-and-generation pipeline ran. A required probe that passes on a
 * vacuous or errored stream is the exact failure mode this probe exists to
 * catch, so every violation fails closed rather than skipping.
 */
export function assertChatSmokeShape(events: ChatSmokeEvent[]): void {
  const errorEvent = events.find(
    (event): event is Extract<ChatSmokeEvent, { type: "error" }> => event.type === "error"
  );
  if (errorEvent) {
    throw new Error(`chat-smoke: stream returned an error event: "${errorEvent.message}"`);
  }

  const hasNonEmptyText = events.some(
    (event) => event.type === "text" && event.content.trim().length > 0
  );
  if (!hasNonEmptyText) {
    throw new Error("chat-smoke: no non-empty text event was found in the SSE stream");
  }

  const doneEvent = events.find(
    (event): event is Extract<ChatSmokeEvent, { type: "done" }> => event.type === "done"
  );
  if (!doneEvent) {
    throw new Error("chat-smoke: no terminal done event was found in the SSE stream");
  }

  if (doneEvent.sources.length === 0) {
    throw new Error(
      "chat-smoke: done event carries zero sources — retrieval did not run (or found nothing)"
    );
  }
}
