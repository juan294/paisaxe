export const CHAT_STREAM_STAGE_TIMEOUTS_MS = {
  embedding: 8_000,
  search: 5_000,
  featureFlag: 2_000,
} as const;

export type ChatStreamStage = keyof typeof CHAT_STREAM_STAGE_TIMEOUTS_MS;
