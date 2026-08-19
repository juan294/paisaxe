import { describe, expect, it, vi } from "vitest";
import { getClientDsn, initSentryClient } from "./sentry-client-init";

describe("getClientDsn", () => {
  it("returns undefined when NEXT_PUBLIC_SENTRY_DSN is unset", () => {
    const original = process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    expect(getClientDsn()).toBeUndefined();

    if (original !== undefined) process.env.NEXT_PUBLIC_SENTRY_DSN = original;
  });

  it("trims whitespace and returns undefined for a blank value", () => {
    const original = process.env.NEXT_PUBLIC_SENTRY_DSN;
    process.env.NEXT_PUBLIC_SENTRY_DSN = "   ";

    expect(getClientDsn()).toBeUndefined();

    if (original === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = original;
  });

  it("returns the trimmed DSN when set", () => {
    const original = process.env.NEXT_PUBLIC_SENTRY_DSN;
    process.env.NEXT_PUBLIC_SENTRY_DSN = "  https://example@sentry.io/1  ";

    expect(getClientDsn()).toBe("https://example@sentry.io/1");

    if (original === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = original;
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
