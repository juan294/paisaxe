/**
 * QA-L1: Unit tests for withChatStreamStageTiming.
 *
 * Verifies that the helper:
 * - Resolves and clears the timer on success
 * - Rejects with ChatStreamStageTimeoutError at the boundary
 * - Logs [CHAT_STREAM_STAGE_TIMING] with timedOut set correctly in both cases
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withChatStreamStageTiming,
  ChatStreamStageTimeoutError,
  isChatStreamStageTimeout,
  CHAT_STREAM_STAGE_TIMEOUTS_MS,
} from "./chat-stream-timeouts";

const mockLogger = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("./logger", () => ({ logger: mockLogger }));

describe("withChatStreamStageTiming", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("resolves with the promise value when it settles before the timeout", async () => {
    const result = await withChatStreamStageTiming(
      "featureFlag",
      Promise.resolve(true)
    );

    expect(result).toBe(true);
  });

  it("clears the timer on success (no dangling timer)", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    await withChatStreamStageTiming("featureFlag", Promise.resolve("value"));

    // clearTimeout must have been called to disarm the race timer
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("rejects with ChatStreamStageTimeoutError when the promise does not settle in time", async () => {
    // A promise that never resolves or rejects — simulates a stalled upstream
    const neverSettles = new Promise<never>(() => {
      /* intentionally empty */
    });
    // Attach a no-op rejection handler so Node doesn't treat the pending
    // promise as unhandled if the timer fires while this promise is GC'd.
    neverSettles.catch(() => {});

    const racePromise = withChatStreamStageTiming("embedding", neverSettles);
    // Suppress the rejection we expect, so it doesn't become an unhandled rejection
    racePromise.catch(() => {});

    // Advance past the embedding timeout
    await vi.advanceTimersByTimeAsync(
      CHAT_STREAM_STAGE_TIMEOUTS_MS.embedding + 1
    );

    await expect(racePromise).rejects.toBeInstanceOf(ChatStreamStageTimeoutError);
  });

  it("rejects with the correct stage and timeoutMs on timeout", async () => {
    const neverSettles = new Promise<never>(() => {
      /* intentionally empty */
    });
    neverSettles.catch(() => {});

    const racePromise = withChatStreamStageTiming("search", neverSettles);
    racePromise.catch(() => {});

    await vi.advanceTimersByTimeAsync(
      CHAT_STREAM_STAGE_TIMEOUTS_MS.search + 1
    );

    await expect(racePromise).rejects.toMatchObject({
      stage: "search",
      timeoutMs: CHAT_STREAM_STAGE_TIMEOUTS_MS.search,
    });
  });

  it("logs [CHAT_STREAM_STAGE_TIMING] with timedOut=false on success", async () => {
    await withChatStreamStageTiming("featureFlag", Promise.resolve(42));

    expect(mockLogger.info).toHaveBeenCalledWith(
      "[CHAT_STREAM_STAGE_TIMING]",
      expect.objectContaining({
        stage: "featureFlag",
        timedOut: false,
        timeoutMs: CHAT_STREAM_STAGE_TIMEOUTS_MS.featureFlag,
      })
    );
  });

  it("logs [CHAT_STREAM_STAGE_TIMING] with timedOut=true on timeout", async () => {
    const neverSettles = new Promise<never>(() => {
      /* intentionally empty */
    });
    neverSettles.catch(() => {});
    const racePromise = withChatStreamStageTiming("response", neverSettles);
    racePromise.catch(() => {});

    await vi.advanceTimersByTimeAsync(
      CHAT_STREAM_STAGE_TIMEOUTS_MS.response + 1
    );

    await expect(racePromise).rejects.toBeInstanceOf(ChatStreamStageTimeoutError);

    expect(mockLogger.info).toHaveBeenCalledWith(
      "[CHAT_STREAM_STAGE_TIMING]",
      expect.objectContaining({
        stage: "response",
        timedOut: true,
        timeoutMs: CHAT_STREAM_STAGE_TIMEOUTS_MS.response,
      })
    );
  });

  it("logs [CHAT_STREAM_STAGE_TIMEOUT] warn on timeout", async () => {
    const neverSettles = new Promise<never>(() => {
      /* intentionally empty */
    });
    neverSettles.catch(() => {});
    const racePromise = withChatStreamStageTiming("embedding", neverSettles);
    racePromise.catch(() => {});

    await vi.advanceTimersByTimeAsync(
      CHAT_STREAM_STAGE_TIMEOUTS_MS.embedding + 1
    );

    await expect(racePromise).rejects.toBeInstanceOf(ChatStreamStageTimeoutError);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[CHAT_STREAM_STAGE_TIMEOUT]",
      expect.objectContaining({ stage: "embedding" })
    );
  });

  it("re-throws non-timeout errors from the wrapped promise", async () => {
    const upstreamError = new Error("upstream failure");
    const racePromise = withChatStreamStageTiming(
      "featureFlag",
      Promise.reject(upstreamError)
    );

    await expect(racePromise).rejects.toBe(upstreamError);
    // Must NOT be misidentified as a timeout
    expect(isChatStreamStageTimeout(upstreamError)).toBe(false);
  });

  it("isChatStreamStageTimeout returns true for ChatStreamStageTimeoutError", async () => {
    const err = new ChatStreamStageTimeoutError("search", 5000);
    expect(isChatStreamStageTimeout(err)).toBe(true);
  });

  it("isChatStreamStageTimeout returns false for plain Error", async () => {
    expect(isChatStreamStageTimeout(new Error("plain"))).toBe(false);
  });

  it("isChatStreamStageTimeout returns false for non-Error values", async () => {
    expect(isChatStreamStageTimeout(null)).toBe(false);
    expect(isChatStreamStageTimeout(undefined)).toBe(false);
    expect(isChatStreamStageTimeout("string")).toBe(false);
  });
});
