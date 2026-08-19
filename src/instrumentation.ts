import * as Sentry from "@sentry/nextjs";
import { sanitizeValue } from "@/lib/logger-sanitize";
import { getEnv } from "@/lib/env";
import type { logger as loggerInstance } from "@/lib/logger";

/**
 * #657: Next.js 15/16 calls this named export to forward server-side errors to Sentry.
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

/**
 * DO-M4 (#831): boot-time credential manifest. /api/health only probes three
 * of the ~15 service credentials this app depends on (Supabase, Sentry, the
 * rate-limit backend) — a missing Stripe or ElevenLabs key currently
 * surfaces only when a user reaches that code path and gets a runtime 500.
 * This check runs once per cold start (register() itself only runs once per
 * process) and logs a structured warning listing any missing keys; it never
 * throws, so a missing var converts "invisible until first customer
 * contact" into "visible in the boot log" without risking a partial outage
 * becoming a total one.
 *
 * Scoped to VERCEL_ENV === "production" only: Preview and local legitimately
 * lack many of these (Stripe/ElevenLabs/Twilio credentials are routinely
 * unset outside production), so checking them there would just be noise.
 *
 * NEXT_PUBLIC_SENTRY_DSN is deliberately not in this list — it already has
 * its own dedicated [SENTRY_UNCONFIGURED] check a few lines below in
 * register(); including it here would just double-log the same gap.
 */
const PRODUCTION_REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
  "ANTHROPIC_API_KEY",
  "VOYAGE_API_KEY",
  "ELEVENLABS_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_DAY_PASS_PRICE_ID",
  "STRIPE_WEEKLY_PRICE_ID",
  "STRIPE_MONTHLY_PRICE_ID",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "RESEND_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "CRON_SECRET",
] as const;

function checkProductionEnvManifest(logger: Pick<typeof loggerInstance, "warn">): void {
  if (process.env.VERCEL_ENV !== "production") {
    return;
  }

  const missing = PRODUCTION_REQUIRED_ENV_VARS.filter((key) => !getEnv(key));

  if (missing.length > 0) {
    logger.warn(
      "[ENV_MANIFEST_MISSING] Production deployment is missing expected credentials",
      { missing_keys: missing, missing_count: missing.length }
    );
  }
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

  checkProductionEnvManifest(logger);

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
