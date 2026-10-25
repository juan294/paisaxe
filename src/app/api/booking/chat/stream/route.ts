import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

// Lightweight imports only; the Anthropic SDK, embeddings and search load on
// demand below, as in /api/chat/stream (rejected requests never pay for them).
import { requireBookingAccess } from "@/lib/booking/gate";
import { consume } from "@/lib/booking/metering";
import { buildRateLimitHeaders } from "@/lib/chat-route-utils";
import { GENERIC_REDIRECT_RESPONSE } from "@/lib/chat-config";
import { detectInjectionAttempt, detectPromptLeakage, sanitizeInput } from "@/lib/chat-safety";
import {
  BOOKING_CHAT_TOTAL_CAP_MS,
  CHAT_STREAM_STAGE_TIMEOUTS_MS,
  createBoundedGenerationTimer,
  createChildAbortController,
  withChatStreamStageTiming,
} from "@/lib/chat-stream-timeouts";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withRouteContext } from "@/lib/request-validation";
import { createAdminClient } from "@/lib/supabase-admin";
import { sanitizeInput as normalizeText } from "@/lib/validation";
import {
  BOOKING_CHAT_ERRORS,
  BOOKING_CHAT_HISTORY_ITEM_MAX,
  BOOKING_CHAT_HISTORY_LIMIT,
} from "@/types/booking-chat";
import { encodeSseEvent, type ChatStreamEvent } from "@/types/sse";

// Budget: rate limit 3 s + embedding 12 s + search 5 s + the tool loop's
// BOOKING_CHAT_TOTAL_CAP_MS 85 s = 105 s, under this ceiling with room for the
// gate, metering and state reads.
export const maxDuration = 120;

// Keyed on the user: every caller here has passed the voucher gate.
const BOOKING_CHAT_RATE_LIMIT = { windowMs: 60_000, maxRequests: 20, maxEntries: 10_000 };

const bookingChatRequestSchema = z
  .object({
    message: z.string().transform(normalizeText).pipe(z.string().max(500)),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().max(BOOKING_CHAT_HISTORY_ITEM_MAX),
        })
      )
      .max(BOOKING_CHAT_HISTORY_LIMIT)
      .default([]),
    locale: z.string().max(10).optional(),
    event: z.object({ type: z.literal("quote_accepted"), bookingId: z.guid() }).strict().optional(),
  })
  .refine((body) => body.message.length > 0 || body.event !== undefined, {
    message: "message is required unless an event is sent",
  });

type BookingChatBody = z.infer<typeof bookingChatRequestSchema>;

function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

function singleEventResponse(event: ChatStreamEvent): Response {
  const bytes = new TextEncoder().encode(encodeSseEvent(event));
  return sseResponse(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    })
  );
}

/**
 * POST /api/booking/chat/stream
 *
 * One turn of the booking conversation (PayPal hackathon plan, Phase 3):
 * voucher gate → per-user rate limit → validation → injection check → one
 * chat turn from the voucher's allowance → optional guide retrieval → the
 * tool loop (src/lib/booking/agent.ts), streamed as SSE text, tool, card,
 * done and error events. The discovery route /api/chat/stream is untouched.
 */
export async function POST(request: NextRequest) {
  return withRouteContext(request, () => handlePost(request));
}

async function handlePost(request: NextRequest): Promise<Response> {
  const access = await requireBookingAccess(request);
  if (access instanceof NextResponse) return access;
  const { userId, redemption } = access;
  if (request.signal.aborted) return sseResponse(new ReadableStream({ start(controller) { controller.close(); } }));

  const rateLimit = await withChatStreamStageTiming(
    "rateLimit",
    checkRateLimit(`booking-chat:${userId}`, BOOKING_CHAT_RATE_LIMIT)
  ).catch(() => null);
  if (!rateLimit?.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimit ? buildRateLimitHeaders(rateLimit, true) : undefined }
    );
  }

  const parsed = bookingChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }
  const body: BookingChatBody = parsed.data;

  // Every history item comes from the client, assistant turns included.
  if ([body.message, ...body.history.map((item) => item.content)].some(detectInjectionAttempt)) {
    logger.warn("[BOOKING_CHAT_INJECTION]", { userId });
    return NextResponse.json({ message: GENERIC_REDIRECT_RESPONSE, flagged: true });
  }
  const message = sanitizeInput(body.message);
  const history = body.history.map((item) => ({
    role: item.role,
    content: sanitizeInput(item.content, BOOKING_CHAT_HISTORY_ITEM_MAX),
  }));

  const admin = createAdminClient();
  const [{ getOrCreateOpenDraft }, { getBookingForUser, listBookingsForUser }] = await Promise.all([
    import("@/lib/booking/drafts"),
    import("@/lib/booking/bookings"),
  ]);

  // An event that does not verify, with no typed text, leaves nothing to answer.
  const acceptedBooking = await verifyAcceptedEvent(body, userId, (id) => getBookingForUser(admin, userId, id));
  if (!message && !acceptedBooking) {
    return singleEventResponse({ type: "done", images: [], sources: [] });
  }

  const allowance = await consume(admin, redemption.id, "chat_turns");
  if (!allowance.allowed) {
    return singleEventResponse({ type: "error", message: BOOKING_CHAT_ERRORS.limitReached });
  }

  const turn = createChildAbortController(request.signal);
  const turnAbort = turn.controller;
  let prepared: [Awaited<ReturnType<typeof getOrCreateOpenDraft>>, Awaited<ReturnType<typeof listBookingsForUser>>, Awaited<ReturnType<typeof retrieveGuideContext>>];
  try {
    prepared = await Promise.all([
      getOrCreateOpenDraft(admin, userId),
      listBookingsForUser(admin, userId),
      message ? retrieveGuideContext(message, turnAbort.signal) : Promise.resolve(null),
    ]);
  } catch (error) {
    turn.dispose();
    throw error;
  }
  if (turnAbort.signal.aborted) {
    turn.dispose();
    return sseResponse(new ReadableStream({ start(controller) { controller.close(); } }));
  }
  const [draft, bookings, retrieval] = prepared;
  const encoder = new TextEncoder();

  let ended = false;
  let generationTimer: ReturnType<typeof createBoundedGenerationTimer> | undefined;
  let removeGenerationAbort: (() => void) | undefined;
  const cleanup = () => {
    generationTimer?.dispose();
    removeGenerationAbort?.();
    turn.dispose();
  };
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The stream ends at most once: on completion, a timeout, the leak
      // filter, a model failure or a client disconnect. Later sends are no-ops,
      // so a turn still unwinding in the background cannot write or throw.
      const send = (event: ChatStreamEvent) => {
        if (ended || turnAbort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(encodeSseEvent(event)));
        } catch {
          ended = true;
          cleanup();
          turnAbort.abort();
        }
      };
      const end = () => {
        if (ended) return;
        ended = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // Already cancelled by the client.
        }
      };
      /** Ends the turn now with a typed error and stops the model loop. */
      const stop = (message: string) => {
        send({ type: "error", message });
        end();
        turnAbort.abort();
      };
      const onAbort = () => {
        if (!ended) logger.info("[BOOKING_CHAT_CLIENT_ABORT]", { userId });
        end();
      };
      turnAbort.signal.addEventListener("abort", onAbort, { once: true });
      removeGenerationAbort = () => turnAbort.signal.removeEventListener("abort", onAbort);
      if (turnAbort.signal.aborted) { end(); return; }
      generationTimer = createBoundedGenerationTimer({
        idleMs: CHAT_STREAM_STAGE_TIMEOUTS_MS.response,
        totalMs: BOOKING_CHAT_TOTAL_CAP_MS,
        onTimeout(reason, limitMs) {
          logger.warn("[BOOKING_CHAT_TIMEOUT]", { userId, limitMs, reason });
          stop("response_timeout");
        },
      });

      try {
        const { createBookingModelClient, streamBookingTurn } = await import("@/lib/booking/agent");
        const anthropic = await createBookingModelClient();
        let assistantText = "";

        for await (const event of streamBookingTurn({
          anthropic,
          tools: { userId, redemptionId: redemption.id, client: admin },
          message,
          history,
          draft,
          bookings,
          contextText: retrieval?.contextText ?? null,
          acceptedBooking,
          locale: body.locale ?? null,
          signal: turnAbort.signal,
          onProgress: () => generationTimer?.resetIdle(),
        })) {
          if (ended || turnAbort.signal.aborted) break;
          generationTimer.resetIdle();
          if (event.type === "text") {
            assistantText += event.content;
            // Leak filter over assistant text only, never over tool results.
            if (detectPromptLeakage(assistantText)) {
              logger.warn("[BOOKING_CHAT_OUTPUT_FILTERED]", { userId });
              stop("output_filtered");
              break;
            }
          }
          send(event);
        }

        send({ type: "done", images: [], sources: retrieval?.sources ?? [] });
      } catch (error) {
        if (ended) {
          // Already reported (timeout or leak filter) or the client is gone.
        } else if (turnAbort.signal.aborted) {
          // The SDK's abort error is not named "AbortError"; the signal is the truth.
          logger.info("[BOOKING_CHAT_CLIENT_ABORT]", { userId });
        } else {
          logger.error("[BOOKING_CHAT_FAILED]", {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
          send({ type: "error", message: BOOKING_CHAT_ERRORS.aiUnavailable });
        }
      } finally {
        end();
      }
    },
    cancel() {
      ended = true;
      cleanup();
      turnAbort.abort();
    },
  });

  return sseResponse(stream);
}

/**
 * The quote_accepted event counts only for the visitor's own booking that is
 * still waiting for payment (a booking exists only once accept_quote ran).
 */
async function verifyAcceptedEvent(
  body: BookingChatBody,
  userId: string,
  load: (bookingId: string) => Promise<{ id: string; reference: string; status: string } | null>
): Promise<{ id: string; reference: string } | null> {
  if (!body.event) return null;
  const booking = await load(body.event.bookingId);
  if (booking?.status === "pending_payment") return { id: booking.id, reference: booking.reference };
  logger.warn("[BOOKING_CHAT_EVENT_IGNORED]", { userId, bookingId: body.event.bookingId, status: booking?.status ?? null });
  return null;
}

/** Guide passages for descriptive questions. Failure only drops the context. */
async function retrieveGuideContext(
  message: string,
  signal: AbortSignal
): Promise<{ contextText: string; sources: ReturnType<typeof import("@/lib/claude").extractSourcesFromChunks> } | null> {
  try {
    const [{ retrieveChatContext }, { buildContextText, extractSourcesFromChunks }] = await Promise.all([
      import("@/lib/retrieve-chat-context"),
      import("@/lib/claude"),
    ]);
    const { chunks } = await retrieveChatContext(message, 3, { signal });
    signal.throwIfAborted();
    if (chunks.length === 0) return null;
    return { contextText: buildContextText(chunks), sources: extractSourcesFromChunks(chunks) };
  } catch (error) {
    logger.warn("[BOOKING_CHAT_RETRIEVAL_SKIPPED]", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
