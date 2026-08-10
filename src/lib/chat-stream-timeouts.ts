import { logger } from "@/lib/logger";

export const CHAT_STREAM_STAGE_TIMEOUTS_MS = {
  embedding: 12_000,
  search: 5_000,
  featureFlag: 2_000,
  response: 30_000,
} as const;

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
