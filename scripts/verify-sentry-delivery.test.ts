import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const captureException = vi.fn();
const flush = vi.fn().mockResolvedValue(true);

vi.mock("@sentry/nextjs", () => ({
  init: (...args: unknown[]) => init(...args),
  captureException: (...args: unknown[]) => captureException(...args),
  flush: (...args: unknown[]) => flush(...args),
}));

import { runVerification, buildMarker, SYNTHETIC_ERROR_TAG } from "./verify-sentry-delivery";

describe("verify-sentry-delivery", () => {
  const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    vi.clearAllMocks();
    flush.mockResolvedValue(true);
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@o0.ingest.sentry.io/0";
  });

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    } else {
      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    }
  });

  it("initializes the SDK with the configured DSN", async () => {
    await runVerification();

    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://public@o0.ingest.sentry.io/0" }),
    );
  });

  it("fires a synthetic exception tagged as a delivery check, distinct from real errors", async () => {
    const result = await runVerification();

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0] as [
      Error,
      { tags?: Record<string, string> },
    ];

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain(result.marker);
    expect(context.tags?.[SYNTHETIC_ERROR_TAG]).toBe("true");
  });

  it("flushes before returning, and reports whether the flush confirmed handoff", async () => {
    const result = await runVerification();

    expect(flush).toHaveBeenCalledWith(expect.any(Number));
    expect(result.flushed).toBe(true);
  });

  it("surfaces a flush timeout instead of silently claiming success", async () => {
    flush.mockResolvedValueOnce(false);

    const result = await runVerification();

    expect(result.flushed).toBe(false);
  });

  it("refuses to run without a DSN, so it can't produce a false 'it works' signal", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;

    await expect(runVerification()).rejects.toThrow(/NEXT_PUBLIC_SENTRY_DSN/);
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("generates a unique marker per invocation", () => {
    const first = buildMarker(new Date("2026-08-18T00:00:00.000Z"));
    const second = buildMarker(new Date("2026-08-18T00:00:00.000Z"));

    expect(first).not.toBe(second);
    expect(first).toContain("2026-08-18");
  });
});
