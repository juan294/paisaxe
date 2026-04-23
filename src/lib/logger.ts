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

type LogLevel = "info" | "warn" | "error";

const REDACTED = "[REDACTED]";
const CIRCULAR = "[Circular]";
const isProduction = process.env.NODE_ENV === "production";
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const phonePattern = /\+?\d[\d\s().-]{7,}\d/g;
const bearerPattern = /(Bearer\s+)[^\s",]+/gi;
const stripeSecretPattern = /\b(?:sk|pk|rk|whsec)_[A-Za-z0-9_-]+\b/g;
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
const sensitiveKeys = new Set([
  "authorization",
  "apikey",
  "cookie",
  "customeremail",
  "customerphone",
  "email",
  "idtoken",
  "paymentproviderid",
  "password",
  "phone",
  "refreshtoken",
  "secret",
  "sessiontoken",
  "stripecustomerid",
  "token",
  "userid",
  "xapikey",
]);

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string) {
  return sensitiveKeys.has(normalizeKey(key));
}

function looksLikeJson(value: string) {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function redactPhoneLikeContent(value: string) {
  return value.replace(phonePattern, (match) => {
    const digits = match.replace(/\D/g, "");
    return digits.length >= 8 ? REDACTED : match;
  });
}

function sanitizeString(value: string, key?: string, seen?: WeakSet<object>): string {
  if (key && isSensitiveKey(key)) {
    return REDACTED;
  }

  if (looksLikeJson(value)) {
    try {
      return JSON.stringify(sanitizeValue(JSON.parse(value), key, seen));
    } catch {
      // Fall through to pattern-based sanitization.
    }
  }

  return redactPhoneLikeContent(
    value
      .replace(emailPattern, REDACTED)
      .replace(bearerPattern, `$1${REDACTED}`)
      .replace(stripeSecretPattern, REDACTED),
  );
}

function sanitizeError(error: Error, seen: WeakSet<object>) {
  return {
    name: error.name,
    message: sanitizeString(error.message, undefined, seen),
    stack: error.stack ? sanitizeString(error.stack, undefined, seen) : undefined,
  };
}

export function sanitizeValue(value: unknown, key?: string, seen = new WeakSet<object>()): unknown {
  if (key && isSensitiveKey(key)) {
    return REDACTED;
  }

  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value, key, seen);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return sanitizeError(value, seen);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, undefined, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return CIRCULAR;
    }

    seen.add(value);

    const sanitized = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childValue, childKey, seen),
      ]),
    );

    seen.delete(value);
    return sanitized;
  }

  return String(value);
}

function sanitizeMeta(meta?: Record<string, unknown>) {
  if (!meta) {
    return undefined;
  }

  return sanitizeValue(meta) as Record<string, unknown>;
}

export type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
};

function makeDevLogger(bindings?: Record<string, unknown>): Logger {
  const sanitizedBindings = sanitizeMeta(bindings);

  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    const entry = JSON.stringify({
      time: Date.now(),
      level,
      msg: sanitizeString(msg),
      ...sanitizedBindings,
      ...sanitizeMeta(meta),
    });

    process.stdout.write(entry);
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
    const sanitizedMeta = sanitizeMeta(meta);
    const sanitizedMsg = sanitizeString(msg);

    if (sanitizedMeta) {
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
