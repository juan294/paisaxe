import { logger } from "@/lib/logger";

export const CHAT_STREAM_STAGE_TIMEOUTS_MS = {
  // PE-M3 (#811): the Upstash rate-limit check is the first I/O on this path
  // and previously had no timeout at all — a slow (not failing) Upstash region
  // added unbounded, invisible latency ahead of every other stage. A single
  // Redis round-trip is normally well under a few hundred ms, so this budget
  // is generous while still bounding the worst case.
  rateLimit: 3_000,
  embedding: 12_000,
  search: 5_000,
  featureFlag: 2_000,
  response: 30_000,
} as const;

// PE-H5 (#808): `response` above is an IDLE window that the chat stream
// route resets on every chunk, so a slow-but-alive trickle could reset it
// forever and never trip. This is a separate, non-resetting ceiling on the
// TOTAL generation duration, armed once and unaffected by chunk arrival.
// Sized at 3x the idle window so a legitimately long streaming response has
// room to complete, while a stream making no real progress is still capped.
export const CHAT_STREAM_RESPONSE_TOTAL_CAP_MS =
  CHAT_STREAM_STAGE_TIMEOUTS_MS.response * 3;

// Booking chat (PayPal hackathon plan, Phase 3): the non-resetting ceiling on
// the whole tool loop (model iterations plus tool calls). Sized so the stages
// before it (rate limit 3 s, gate and metering, embedding 12 s, search 5 s)
// still finish inside the route's maxDuration of 120 s.
export const BOOKING_CHAT_TOTAL_CAP_MS = 85_000;

export type ChatStreamStage = keyof typeof CHAT_STREAM_STAGE_TIMEOUTS_MS;

export class ChatStreamStageTimeoutError extends Error {
  constructor(
    readonly stage: ChatStreamStage,
    readonly timeoutMs: number
  ) {
    super(`${stage} timed out after ${timeoutMs}ms`);
    this.name = "ChatStreamStageTimeoutError";
  }
}

export function isChatStreamStageTimeout(
  error: unknown
): error is ChatStreamStageTimeoutError {
  return error instanceof ChatStreamStageTimeoutError;
}

export async function withChatStreamStageTiming<T>(
  stage: ChatStreamStage,
  promise: Promise<T>,
  abortController?: AbortController
): Promise<T> {
  const startedAt = Date.now();
  const timeoutMs = CHAT_STREAM_STAGE_TIMEOUTS_MS[stage];
  let timer!: ReturnType<typeof setTimeout>;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      // AR-H2 (#856): a bare Promise.race leaves the losing promise running
      // (and, for an Anthropic call, billing) after the caller has moved on.
      // Abort the controller the caller wired into `promise`'s construction
      // so the underlying call is actually cancelled, not just abandoned.
      abortController?.abort();
      reject(new ChatStreamStageTimeoutError(stage, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    if (isChatStreamStageTimeout(error)) {
      logger.warn("[CHAT_STREAM_STAGE_TIMEOUT]", {
        stage,
        timeoutMs,
      });
    }
    throw error;
  } finally {
    // timer is always assigned synchronously by the Promise executor above
    // before this finally block can run.
    clearTimeout(timer);
    logger.info("[CHAT_STREAM_STAGE_TIMING]", {
      stage,
      durationMs: Date.now() - startedAt,
      timeoutMs,
      timedOut,
    });
  }
}
