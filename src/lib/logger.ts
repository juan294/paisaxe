/**
 * Structured logger for Paisaxe.
 *
 * - Production: uses pino for JSON log output (compatible with Vercel log drains).
 * - Development / test: uses a lightweight console shim that emits the same
 *   JSON schema so tooling and tests can rely on a consistent structure.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("[CHAT_STREAM_FAILURE]", { error: msg, duration_ms: 123 });
 *   logger.warn("[FEATURE_FLAG_FAILURE]", { flag: "visitor_voice_agent" });
 *   logger.error("[TABLE_FALLBACK]", { table: "chunks" });
 */

import pino from "pino";

// In test / development environments, write synchronously to stdout so that
// tests can spy on `process.stdout.write` and assert the emitted JSON.
const isProduction = process.env.NODE_ENV === "production";

function makeDevLogger() {
  const emit = (level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>) => {
    const entry = JSON.stringify({ time: Date.now(), level, msg, ...meta });
    process.stdout.write(entry);
  };

  return {
    info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
  };
}

function makePinoLogger() {
  const instance = pino({ level: "info" });
  return {
    info: (msg: string, meta?: Record<string, unknown>) =>
      meta ? instance.info(meta, msg) : instance.info(msg),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      meta ? instance.warn(meta, msg) : instance.warn(msg),
    error: (msg: string, meta?: Record<string, unknown>) =>
      meta ? instance.error(meta, msg) : instance.error(msg),
  };
}

export type Logger = ReturnType<typeof makeDevLogger>;

export const logger: Logger = isProduction ? makePinoLogger() : makeDevLogger();
