import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("clientLogger", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("emits structured JSON with level and msg", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { clientLogger } = await import("./client-logger");

    clientLogger.error("[BOOM]", { code: 42 });

    expect(console.error).toHaveBeenCalledTimes(1);
    const arg = (console.error as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.level).toBe("error");
    expect(parsed.msg).toBe("[BOOM]");
    expect(parsed.code).toBe(42);
    expect(typeof parsed.time).toBe("number");
  });

  it("emits info and warn in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { clientLogger } = await import("./client-logger");

    clientLogger.info("[INFO]");
    clientLogger.warn("[WARN]");

    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("suppresses info and warn in production but keeps error", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { clientLogger } = await import("./client-logger");

    clientLogger.info("[INFO]");
    clientLogger.warn("[WARN]");
    clientLogger.error("[ERROR]");

    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("emits debug messages in development — line 52", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const { clientLogger } = await import("./client-logger");

    clientLogger.debug("[DEBUG_EVENT]", { detail: "test" });

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.level).toBe("debug");
    expect(parsed.msg).toBe("[DEBUG_EVENT]");
    expect(parsed.detail).toBe("test");
  });

  it("merges child bindings into emitted entries", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { clientLogger } = await import("./client-logger");

    const child = clientLogger.child({ scope: "auth" });
    child.error("[CHILD]", { extra: true });

    const arg = (console.error as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.scope).toBe("auth");
    expect(parsed.extra).toBe(true);
  });
});
