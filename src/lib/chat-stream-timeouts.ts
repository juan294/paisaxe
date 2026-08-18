import { logger } from "@/lib/logger";

export const CHAT_STREAM_STAGE_TIMEOUTS_MS = {
  embedding: 12_000,
  search: 5_000,
  featureFlag: 2_000,
  response: 30_000,
} as const;

// PE-H5 (#808): `response` above is an IDLE window for the generation stage —
// the chat stream route resets it on every chunk, so a slow-but-alive
// trickle (a chunk arriving just under the idle window, forever) could keep
// resetting it indefinitely and never trip. This is a separate, non-resetting
// ceiling on the TOTAL duration of the generation stage: it's armed once when
// generation starts and is never reset by chunk arrival, so the stage is
// bounded even under that pathological trickle. Sized at 3x the idle window
// so a legitimately long (but continuously streaming) response has room to
// complete, while a stream that never makes real progress is still capped.
export const CHAT_STREAM_RESPONSE_TOTAL_CAP_MS =
  CHAT_STREAM_STAGE_TIMEOUTS_MS.response * 3;

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
  promise: Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  const timeoutMs = CHAT_STREAM_STAGE_TIMEOUTS_MS[stage];
  let timer!: ReturnType<typeof setTimeout>;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
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
