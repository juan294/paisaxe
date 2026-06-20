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
