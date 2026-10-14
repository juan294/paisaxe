import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "./use-countdown";

const NOW = new Date("2026-10-07T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const inSeconds = (s: number) => new Date(NOW.getTime() + s * 1000).toISOString();

describe("useCountdown", () => {
  it("counts down once a second as m:ss", () => {
    const { result } = renderHook(() => useCountdown(inSeconds(65)));
    expect(result.current).toMatchObject({ label: "1:05", expired: false });
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.label).toBe("1:04");
    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current.label).toBe("0:59");
  });

  it("stops at 0:00 and reports expiry (the hold-lapse stuck state ends on its own)", () => {
    const { result } = renderHook(() => useCountdown(inSeconds(2)));
    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current).toMatchObject({ remainingMs: 0, label: "0:00", expired: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("is already expired for a past instant and starts no timer", () => {
    const { result } = renderHook(() => useCountdown(inSeconds(-30)));
    expect(result.current).toMatchObject({ label: "0:00", expired: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does nothing without an expiry", () => {
    const { result } = renderHook(() => useCountdown(null));
    expect(result.current).toEqual({ remainingMs: null, label: null, expired: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer on unmount", () => {
    const { unmount } = renderHook(() => useCountdown(inSeconds(60)));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
