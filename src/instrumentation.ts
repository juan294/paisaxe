import * as Sentry from "@sentry/nextjs";
import { sanitizeValue } from "@/lib/logger-sanitize";

/**
 * DO-H1: Next.js 15/16 calls this named export to forward server-side errors to Sentry.
 * Without it, unhandled route/middleware errors are never captured.
 */
export const onRequestError = Sentry.captureRequestError;

declare global {
  var __paisaxeConsolePatched: boolean | undefined;
  var __paisaxeOriginalConsole:
    | Pick<Console, "debug" | "error" | "info" | "warn">
    | undefined;
}

function normalizeConsoleMessage(message: unknown) {
  if (message == null) {
    return "[CONSOLE_MESSAGE_EMPTY]";
  }

  if (typeof message === "string") {
    return message;
  }

  const sanitized = sanitizeValue(message);

  if (typeof sanitized === "string") {
    return sanitized;
  }

  return JSON.stringify(sanitized) ?? "[CONSOLE_MESSAGE_EMPTY]";
}

function buildConsoleMeta(method: "debug" | "error" | "info" | "warn", args: unknown[]) {
  return args.length > 0
    ? { args, source: `console.${method}` }
    : { source: `console.${method}` };
}

function wrapConsoleMethod(
  method: "debug" | "error" | "info" | "warn",
  log: (message: string, meta?: Record<string, unknown>) => void,
) {
  return (message?: unknown, ...args: unknown[]) => {
    log(normalizeConsoleMessage(message), buildConsoleMeta(method, args));
  };
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || globalThis.__paisaxeConsolePatched) {
    return;
  }

  const { logger } = await import("@/lib/logger");

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) {
    logger.warn("[SENTRY_UNCONFIGURED] NEXT_PUBLIC_SENTRY_DSN is not set — error reporting is disabled");
  }

  globalThis.__paisaxeOriginalConsole = {
    debug: console.debug.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
  };
  globalThis.__paisaxeConsolePatched = true;

  console.debug = wrapConsoleMethod("debug", logger.debug);
  console.error = wrapConsoleMethod("error", logger.error);
  console.info = wrapConsoleMethod("info", logger.info);
  console.warn = wrapConsoleMethod("warn", logger.warn);
}
