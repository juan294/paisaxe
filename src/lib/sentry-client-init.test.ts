import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientDsn, initSentryClient, loadSentryIfConfigured } from "./sentry-client-init";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getClientDsn", () => {
  it("returns undefined when NEXT_PUBLIC_SENTRY_DSN is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");

    expect(getClientDsn()).toBeUndefined();
  });

  it("trims whitespace and returns undefined for a blank value", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "   ");

    expect(getClientDsn()).toBeUndefined();
  });

  it("returns the trimmed DSN when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "  https://example@sentry.io/1  ");

    expect(getClientDsn()).toBe("https://example@sentry.io/1");
  });
});

describe("loadSentryIfConfigured", () => {
  it("resolves to undefined without loading the SDK when no DSN is configured", async () => {
    const loadSentry = vi.fn();

    const result = await loadSentryIfConfigured(undefined, loadSentry);

    expect(result).toBeUndefined();
    expect(loadSentry).not.toHaveBeenCalled();
  });

  it("resolves to the loaded SDK module when a DSN is present — reusable by other call sites (#941)", async () => {
    const sentryModule = { init: vi.fn(), captureException: vi.fn() };
    const loadSentry = vi.fn().mockResolvedValue(sentryModule);

    const result = await loadSentryIfConfigured("https://example@sentry.io/1", loadSentry);

    expect(result).toBe(sentryModule);
    expect(loadSentry).toHaveBeenCalledTimes(1);
  });
});

describe("initSentryClient", () => {
  it("never loads the Sentry SDK when no DSN is configured — the whole point of #818", async () => {
    const loadSentry = vi.fn();

    await initSentryClient(undefined, loadSentry);

    expect(loadSentry).not.toHaveBeenCalled();
  });

  it("loads and initializes Sentry with the DSN and existing config when a DSN is present", async () => {
    const init = vi.fn();
    const loadSentry = vi.fn().mockResolvedValue({ init });

    await initSentryClient("https://example@sentry.io/1", loadSentry);

    expect(loadSentry).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://example@sentry.io/1",
        tracesSampleRate: 0.1,
      }),
    );
  });
});
