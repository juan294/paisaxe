import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Sentry from "@sentry/nextjs";

describe("instrumentation register", () => {
  const originalConsole = {
    error: console.error,
    info: console.info,
    warn: console.warn,
  };

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    globalThis.__paisaxeConsolePatched = undefined;
    globalThis.__paisaxeOriginalConsole = undefined;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    globalThis.__paisaxeConsolePatched = undefined;
    globalThis.__paisaxeOriginalConsole = undefined;
  });

  it("routes console.error through the shared logger with redaction", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { register } = await import("./instrumentation");
    await register();

    console.error("secret email: traveler@example.com", {
      phone: "+34 611 22 33 44",
      token: "sk_live_secret_123",
    });

    const written = spy.mock.calls.flatMap((args) => args).join("");
    expect(written).not.toContain("traveler@example.com");
    expect(written).not.toContain("+34 611 22 33 44");
    expect(written).not.toContain("sk_live_secret_123");

    const parsed = JSON.parse(written);
    expect(parsed.level).toBe("error");
    expect(parsed.source).toBe("console.error");
    expect(parsed.msg).toContain("[REDACTED]");
    expect(parsed.args[0].phone).toBe("[REDACTED]");
    expect(parsed.args[0].token).toBe("[REDACTED]");
  });

  it("returns early without patching when not running in nodejs runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    const original = console.info;

    const { register } = await import("./instrumentation");
    await register();

    expect(globalThis.__paisaxeConsolePatched).toBeUndefined();
    expect(console.info).toBe(original);
  });

  it("returns early when console has already been patched", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");
    globalThis.__paisaxeConsolePatched = true;
    const original = console.info;

    const { register } = await import("./instrumentation");
    await register();

    expect(console.info).toBe(original);
  });

  it("warns when NEXT_PUBLIC_SENTRY_DSN is missing", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { register } = await import("./instrumentation");
    await register();

    const written = spy.mock.calls.flatMap((args) => args).join("");
    expect(written).toContain("SENTRY_UNCONFIGURED");
  });

  it("normalizes empty messages to a placeholder token", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    const { register } = await import("./instrumentation");
    await register();

    console.info(null);
    console.info(undefined);

    const written = spy.mock.calls.flatMap((args) => args).join("\n");
    expect(written).toContain("[CONSOLE_MESSAGE_EMPTY]");
  });

  it("returns sanitized string when message is a Date", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://example@sentry.io/1");
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    const { register } = await import("./instrumentation");
    await register();

    const date = new Date("2026-05-08T00:00:00.000Z");
    console.info(date);

    const last = spy.mock.calls.at(-1)?.[0] ?? "";
    const parsed = JSON.parse(String(last));
    expect(parsed.msg).toContain("T00:00:00.000Z");
    expect(typeof parsed.msg).toBe("string");
  });

  // DO-M4 (#831): boot-time credential manifest — warns in production when
  // any of the ~15 service credentials /api/health never checks are missing.
  describe("DO-M4: production env manifest", () => {
    it("warns when production is missing expected credentials", async () => {
      vi.stubEnv("NEXT_RUNTIME", "nodejs");
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("STRIPE_SECRET_KEY", "");
      vi.stubEnv("ELEVENLABS_API_KEY", "");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { register } = await import("./instrumentation");
      await register();

      const written = spy.mock.calls.flatMap((args) => args).join("\n");
      expect(written).toContain("ENV_MANIFEST_MISSING");
      expect(written).toContain("STRIPE_SECRET_KEY");
      expect(written).toContain("ELEVENLABS_API_KEY");
    });

    it("does not warn in preview even when credentials are missing", async () => {
      vi.stubEnv("NEXT_RUNTIME", "nodejs");
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("STRIPE_SECRET_KEY", "");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { register } = await import("./instrumentation");
      await register();

      const written = spy.mock.calls.flatMap((args) => args).join("\n");
      expect(written).not.toContain("ENV_MANIFEST_MISSING");
    });

    it("does not warn in development even when credentials are missing", async () => {
      vi.stubEnv("NEXT_RUNTIME", "nodejs");
      vi.stubEnv("NODE_ENV", "test");
      // VERCEL_ENV intentionally left unset — local/CI runs have no value here.
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { register } = await import("./instrumentation");
      await register();

      const written = spy.mock.calls.flatMap((args) => args).join("\n");
      expect(written).not.toContain("ENV_MANIFEST_MISSING");
    });

    it("does not warn in production when all required credentials are present", async () => {
      vi.stubEnv("NEXT_RUNTIME", "nodejs");
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("SUPABASE_SERVICE_KEY", "test-service-key");
      vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
      vi.stubEnv("ELEVENLABS_API_KEY_FINGERPRINT", "sha256:1234567890abcdef");
      vi.stubEnv("STRIPE_SECRET_KEY", "test-key");
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test-key");
      vi.stubEnv("STRIPE_DAY_PASS_PRICE_ID", "price_test");
      vi.stubEnv("STRIPE_WEEKLY_PRICE_ID", "price_test");
      vi.stubEnv("STRIPE_MONTHLY_PRICE_ID", "price_test");
      vi.stubEnv("TWILIO_ACCOUNT_SID", "test-sid");
      vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
      vi.stubEnv("RESEND_API_KEY", "test-key");
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://test.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
      vi.stubEnv("GOOGLE_CLIENT_ID", "test-client-id");
      vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
      vi.stubEnv("CRON_SECRET", "test-cron-secret");
      vi.stubEnv("HEALTH_PROBE_SECRET", "test-health-probe-secret");
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://test@o123.ingest.sentry.io/456");
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { register } = await import("./instrumentation");
      await register();

      const written = spy.mock.calls.flatMap((args) => args).join("\n");
      expect(written).not.toContain("ENV_MANIFEST_MISSING");
    });
  });

  it("stringifies object messages that the sanitizer keeps as objects", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://example@sentry.io/1");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { register } = await import("./instrumentation");
    await register();

    console.warn({ kind: "structured-warning", code: 42 });

    const last = spy.mock.calls.at(-1)?.[0] ?? "";
    const parsed = JSON.parse(String(last));
    expect(parsed.source).toBe("console.warn");
    expect(parsed.msg).toContain("structured-warning");
    expect(parsed.msg).toContain("42");
  });
});

describe("instrumentation onRequestError (DO-H1)", () => {
  it("exports onRequestError so Next.js 15/16 forwards server errors to Sentry", async () => {
    vi.resetModules();
    const mod = await import("./instrumentation");
    // The export must be a function (Sentry.captureRequestError)
    expect(typeof (mod as Record<string, unknown>).onRequestError).toBe("function");
  });

  it("onRequestError is Sentry.captureRequestError", async () => {
    vi.resetModules();
    const sentryMod = await import("@sentry/nextjs") as typeof Sentry & { captureRequestError: unknown };
    const mod = await import("./instrumentation") as Record<string, unknown>;
    expect(mod.onRequestError).toBe(sentryMod.captureRequestError);
  });
});
