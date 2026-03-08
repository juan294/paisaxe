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
      expect.stringContaining("PostHog query retry 1/2")
    );
    expect(result).toEqual({ results: [[99]] });
    warnSpy.mockRestore();
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
