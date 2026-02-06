import { describe, it, expect, vi, beforeEach } from "vitest";
import { queryPostHog } from "./posthog-query";

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
});
