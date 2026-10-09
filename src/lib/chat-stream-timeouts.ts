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

/** A cancellable child whose parent listener is explicitly released by its owner. */
export function createChildAbortController(parent?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  return { controller, dispose: () => parent?.removeEventListener("abort", abort) };
}

export type GenerationTimeoutReason = "idle_window" | "total_duration_cap";

/** One generation deadline, with a resetting idle window and a fixed hard cap. */
export function createBoundedGenerationTimer(options: {
  idleMs: number;
  totalMs: number;
  onTimeout: (reason: GenerationTimeoutReason, timeoutMs: number) => void;
}) {
  let reason: GenerationTimeoutReason | undefined;
  let disposed = false;
  let idleTimer: ReturnType<typeof setTimeout>;
  let capTimer: ReturnType<typeof setTimeout>;
  const dispose = () => {
    disposed = true;
    clearTimeout(idleTimer);
    clearTimeout(capTimer);
  };
  const expire = (nextReason: GenerationTimeoutReason, timeoutMs: number) => {
    if (disposed) return;
    reason = nextReason;
    dispose();
    options.onTimeout(nextReason, timeoutMs);
  };
  const resetIdle = () => {
    if (disposed) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => expire("idle_window", options.idleMs), options.idleMs);
  };
  resetIdle();
  capTimer = setTimeout(() => expire("total_duration_cap", options.totalMs), options.totalMs);
  return { resetIdle, dispose, get reason() { return reason; } };
}

export async function withChatStreamStageTiming<T>(
  stage: ChatStreamStage,
  promise: Promise<T>,
  abortController?: AbortController
): Promise<T> {
  const startedAt = Date.now();
  const timeoutMs = CHAT_STREAM_STAGE_TIMEOUTS_MS[stage];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let onAbort: (() => void) | undefined;
  const signal = abortController?.signal;
  const cancellation = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      const error = new ChatStreamStageTimeoutError(stage, timeoutMs);
      // Settle with the typed stage error before cancellation unwinds the transport.
      reject(error);
      abortController?.abort(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise, cancellation]);
  } catch (error) {
    if (isChatStreamStageTimeout(error)) logger.warn("[CHAT_STREAM_STAGE_TIMEOUT]", { stage, timeoutMs });
    throw error;
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener("abort", onAbort);
    logger.info("[CHAT_STREAM_STAGE_TIMING]", {
      stage, durationMs: Date.now() - startedAt, timeoutMs, timedOut,
    });
  }
}
