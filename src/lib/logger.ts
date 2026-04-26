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
import { getRequestId } from "./request-context";
import { sanitizeLogMessage, sanitizeValue } from "./logger-sanitize";

type LogLevel = "info" | "warn" | "error";

const REDACTED = "[REDACTED]";
const isProduction = process.env.NODE_ENV === "production";
const pinoRedactPaths = [
  "*.email",
  "*.phone",
  "*.token",
  "*.authorization",
  "*.cookie",
  "*.password",
  "*.api_key",
  "*.apiKey",
  "*.stripe_customer_id",
  "*.payment_provider_id",
  "*.user_id",
  "*.session_token",
  "*.access_token",
  "*.refresh_token",
  "*.id_token",
  "*.secret",
  "headers.cookie",
  "headers.authorization",
  "req.headers.cookie",
  "req.headers.authorization",
  "request.headers.cookie",
  "request.headers.authorization",
  "*.headers.cookie",
  "*.headers.authorization",
  "*.req.headers.cookie",
  "*.req.headers.authorization",
  "*.request.headers.cookie",
  "*.request.headers.authorization",
];
function sanitizeMeta(meta?: Record<string, unknown>) {
  if (!meta) {
    return undefined;
  }

  return sanitizeValue(meta) as Record<string, unknown>;
}

function getRequestIdBindings() {
  const requestId = getRequestId();
  return requestId ? { request_id: requestId } : undefined;
}

type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
};

function makeDevLogger(bindings?: Record<string, unknown>): Logger {
  const sanitizedBindings = sanitizeMeta(bindings);

  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    const requestIdBindings = sanitizeMeta(getRequestIdBindings());
    const entry = JSON.stringify({
      time: Date.now(),
      level,
      msg: sanitizeLogMessage(msg),
      ...requestIdBindings,
      ...sanitizedBindings,
      ...sanitizeMeta(meta),
    });

    const consoleSink = globalThis.__paisaxeOriginalConsole ?? console;
    consoleSink[level](entry);
  };

  return {
    info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
    child: (childBindings: Record<string, unknown>) =>
      makeDevLogger({
        ...bindings,
        ...childBindings,
      }),
  };
}

function makePinoLogger(instance = pino({
  level: "info",
  redact: {
    paths: pinoRedactPaths,
    censor: REDACTED,
  },
})): Logger {
  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    const sanitizedMeta = {
      ...sanitizeMeta(getRequestIdBindings()),
      ...sanitizeMeta(meta),
    };
    const sanitizedMsg = sanitizeLogMessage(msg);

    if (Object.keys(sanitizedMeta).length > 0) {
      instance[level](sanitizedMeta, sanitizedMsg);
      return;
    }

    instance[level](sanitizedMsg);
  };

  return {
    info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
    child: (bindings: Record<string, unknown>) => makePinoLogger(instance.child(sanitizeMeta(bindings) ?? {})),
  };
}

export const logger: Logger = isProduction ? makePinoLogger() : makeDevLogger();
