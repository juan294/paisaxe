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

const CSRF_COOKIE_NAME = "__csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Builds the double-submit CSRF header the deployed app requires on every
 * state-changing /api request (src/lib/csrf.ts): the `__csrf` cookie, set on any
 * page response, echoed in `x-csrf-token`. Without it /api/chat/stream answers
 * 403 before any chat logic runs, so a probe that skips this step can never pass.
 * Fails loudly when no token was issued rather than sending a doomed request.
 */
export function csrfHeadersFromCookies(
  cookies: ReadonlyArray<{ name: string; value: string }>
): Record<string, string> {
  const token = cookies.find((cookie) => cookie.name === CSRF_COOKIE_NAME)?.value;
  if (!token) {
    throw new Error(
      `chat-smoke: no ${CSRF_COOKIE_NAME} cookie was set by the page request, so a CSRF-valid chat request cannot be built`
    );
  }
  return { [CSRF_HEADER_NAME]: token };
}

// BE-H1: a caller with no trusted Vercel IP header shares the tight "untrusted"
// rate-limit bucket (3 req/60s, shared by every such caller). Supplying our own
// x-vercel-forwarded-for gives this probe its own bucket under the default per-IP
// limit. 203.0.113.0/24 is reserved for documentation (RFC 5737) and never
// collides with a real visitor's IP.
const PROBE_FORWARDED_FOR = "203.0.113.42";

/**
 * Every header the deployed app needs to accept the probe's POST to
 * /api/chat/stream: the double-submit CSRF token, the target's own Origin (a
 * state-changing /api request with no Origin gets 403 "Origin not allowed"), and
 * the probe's rate-limit bucket. Throws on a non-URL target or a missing token.
 */
export function chatRequestHeaders(
  cookies: ReadonlyArray<{ name: string; value: string }>,
  targetUrl: string
): Record<string, string> {
  return {
    ...csrfHeadersFromCookies(cookies),
    Origin: new URL(targetUrl).origin,
    "x-vercel-forwarded-for": PROBE_FORWARDED_FOR,
  };
}

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
