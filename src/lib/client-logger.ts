/**
 * Client-safe structured logger for Paisaxe.
 *
 * The server logger (`@/lib/logger`) is built on pino, which pulls in Node.js
 * built-ins and cannot run in the browser bundle. This module provides a
 * matching API surface for client components and client-bundled modules.
 *
 * Behaviour:
 * - Development: emits structured JSON to the console so logs stay greppable
 *   and consistent with the server logger's schema.
 * - Production: `info`/`warn` are suppressed to keep the browser console quiet;
 *   `error` is always emitted so user-impacting failures remain visible and can
 *   be picked up by error-tracking (Sentry breadcrumbs/console capture).
 *
 * Usage:
 *   import { clientLogger } from "@/lib/client-logger";
 *   clientLogger.error("[AUTH_INIT_FAILURE]", { error: String(err) });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const isProduction = process.env.NODE_ENV === "production";

export type ClientLogger = {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => ClientLogger;
};

function makeClientLogger(bindings?: Record<string, unknown>): ClientLogger {
  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>) => {
    // In production, suppress info/warn to avoid leaking internals into the
    // browser console. Errors are always surfaced.
    if (isProduction && level !== "error") {
      return;
    }

    const entry = JSON.stringify({
      time: Date.now(),
      level,
      msg,
      ...bindings,
      ...meta,
    });

    console[level](entry);
  };

  return {
    debug: (msg, meta) => emit("debug", msg, meta),
    info: (msg, meta) => emit("info", msg, meta),
    warn: (msg, meta) => emit("warn", msg, meta),
    error: (msg, meta) => emit("error", msg, meta),
    child: (childBindings) =>
      makeClientLogger({ ...bindings, ...childBindings }),
  };
}

export const clientLogger: ClientLogger = makeClientLogger();
