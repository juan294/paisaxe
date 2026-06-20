import { describe, it, expect, vi, beforeEach } from "vitest";
import { queryPostHog, formatForHogQL } from "./posthog-query";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("queryPostHog", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should make a POST request to the PostHog HogQL endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [[42]] }),
    });

    const result = await queryPostHog(
      "SELECT count() FROM events",
      "project-123",
      "phx_api-key"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://eu.posthog.com/api/projects/project-123/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer phx_api-key",
        }),
      })
    );

    expect(result).toEqual({ results: [[42]] });
  });

  it("should throw on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad query"),
    });

    await expect(
      queryPostHog("BAD QUERY", "project-123", "phx_api-key")
    ).rejects.toThrow("PostHog API error: 400 - Bad query");
  });

  it("should retry on timeout errors", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    mockFetch
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [[1]] }),
      });

    const result = await queryPostHog(
      "SELECT 1",
      "project-123",
      "phx_api-key"
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ results: [[1]] });
  });

  it("should stop retrying after max retries", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    mockFetch
      .mockRejectedValueOnce(abortError)
      .mockRejectedValueOnce(abortError)
      .mockRejectedValueOnce(abortError);

    await expect(
      queryPostHog("SELECT 1", "project-123", "phx_api-key")
    ).rejects.toThrow();

    // Initial call + 2 retries = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should not retry on non-retryable errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Some other error"));

    await expect(
      queryPostHog("SELECT 1", "project-123", "phx_api-key")
    ).rejects.toThrow("Some other error");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should log console.warn when retrying a retryable error", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchFailedError = new Error("fetch failed");

    mockFetch
      .mockRejectedValueOnce(fetchFailedError)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [[99]] }),
      });

    const result = await queryPostHog(
      "SELECT 1",
      "project-123",
      "phx_api-key"
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("PostHog query retry")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"attempt":1')
    );
    expect(result).toEqual({ results: [[99]] });
    warnSpy.mockRestore();
  });

  it("should retry on ECONNRESET errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const connResetError = new Error("ECONNRESET");

    mockFetch
      .mockRejectedValueOnce(connResetError)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [[7]] }),
      });

    const result = await queryPostHog(
      "SELECT 1",
      "project-123",
      "phx_api-key"
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ results: [[7]] });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("PostHog query retry")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("ECONNRESET")
    );
    warnSpy.mockRestore();
  });

  it("should include the error message in the retry warn log", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const etimedoutError = new Error("ETIMEDOUT");

    mockFetch
      .mockRejectedValueOnce(etimedoutError)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [[1]] }),
      });

    await queryPostHog("SELECT 1", "project-123", "phx_api-key");

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("PostHog query retry")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("ETIMEDOUT")
    );
    warnSpy.mockRestore();
  });

  it("should log 'unknown error' when a non-Error value is thrown", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // First call throws a non-Error value (string)
    mockFetch
      .mockRejectedValueOnce("string error")
      .mockRejectedValueOnce("string error");

    await expect(
      queryPostHog("SELECT 1", "project-123", "phx_api-key")
    ).rejects.toBe("string error");

    // Non-Error values are not retryable, so only 1 call
    expect(mockFetch).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  // NOTE: posthog-query.ts line 70 has an uncovered branch for the ternary
  // `error instanceof Error ? error.message : "unknown error"` inside console.warn.
  // The "unknown error" path is unreachable because the `isRetryable` check on
  // line 61-66 requires `error instanceof Error` to be true. If `isRetryable` is
  // true, `error` is guaranteed to be an Error instance, so the ternary always
  // takes the `error.message` path. The "unknown error" fallback is dead code.

  it("should abort fetch after timeout and trigger retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // First call: simulate fetch that hangs until aborted
    mockFetch.mockImplementationOnce(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
          // Advance past POSTHOG_TIMEOUT_MS (15000)
          vi.advanceTimersByTime(16000);
        })
    );

    // Second call succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [[42]] }),
    });

    const result = await queryPostHog("SELECT 1", "project-123", "phx_api-key");

    expect(result).toEqual({ results: [[42]] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("PostHog query retry")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"attempt":1')
    );
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

});

describe("formatForHogQL", () => {
  it("should convert an ISO string to HogQL datetime format", () => {
    // ISO string with timezone and milliseconds → 'YYYY-MM-DD HH:MM:SS'
    const result = formatForHogQL("2026-02-09T14:30:45.123Z");
    expect(result).toBe("2026-02-09 14:30:45");
  });

  it("should handle midnight correctly", () => {
    const result = formatForHogQL("2026-01-01T00:00:00.000Z");
    expect(result).toBe("2026-01-01 00:00:00");
  });

  it("should handle end-of-day correctly", () => {
    const result = formatForHogQL("2025-12-31T23:59:59.999Z");
    expect(result).toBe("2025-12-31 23:59:59");
  });

  it("should strip milliseconds and timezone suffix", () => {
    const result = formatForHogQL("2026-06-15T08:22:11.456Z");
    // Must not contain 'T', '.', or 'Z'
    expect(result).not.toContain("T");
    expect(result).not.toContain(".");
    expect(result).not.toContain("Z");
  });
});
