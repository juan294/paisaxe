import { afterEach, describe, expect, it, vi } from "vitest";

const initSpy = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  init: initSpy,
}));

describe("sentry.client.config", () => {
  const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    vi.resetModules();
    initSpy.mockReset();

    if (originalDsn === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    } else {
      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    }
  });

  it("initializes Sentry without Replay sample rates", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "  https://examplePublicKey@o0.ingest.sentry.io/0  ";

    await import("../../sentry.client.config");

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(initSpy).toHaveBeenCalledWith({
      dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
      tracesSampleRate: 0.1,
    });
  });

  it("does not initialize Sentry when the DSN is missing", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    await import("../../sentry.client.config");

    expect(initSpy).not.toHaveBeenCalled();
  });
});
