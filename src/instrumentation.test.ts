import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
});
