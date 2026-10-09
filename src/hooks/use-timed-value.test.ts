import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { useTimedValue } from "./use-timed-value";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("useTimedValue", () => {
  it.each([1500, 6000])("expires at exactly %ims", (duration) => {
    const { result } = renderHook(() => useTimedValue<string>(duration));
    expect(result.current.value).toBeNull();
    act(() => result.current.show("saved"));
    act(() => vi.advanceTimersByTime(duration - 1));
    expect(result.current.value).toBe("saved");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.value).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("replacement owns a fresh full interval and only one timer", () => {
    const { result } = renderHook(() => useTimedValue<string>(1500));
    act(() => result.current.show("first"));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.show("second"));
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.value).toBe("second");
    act(() => vi.advanceTimersByTime(999));
    expect(result.current.value).toBe("second");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.value).toBeNull();
  });

  it("manual clear cancels the timer and invalidates pending intent", () => {
    const { result } = renderHook(() => useTimedValue<string>(1500));
    act(() => result.current.show("first"));
    act(() => result.current.clear());
    expect(result.current.value).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    let isCurrent!: () => boolean;
    act(() => { isCurrent = result.current.startIntent(); });
    expect(isCurrent()).toBe(true);
    act(() => result.current.clear());
    expect(isCurrent()).toBe(false);
  });

  it("a newer intent clears old feedback and supersedes the older pending result", () => {
    const { result } = renderHook(() => useTimedValue<string>(1500));
    act(() => result.current.show("old feedback"));
    let older!: () => boolean;
    let latest!: () => boolean;
    act(() => { older = result.current.startIntent(); });
    expect(result.current.value).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { latest = result.current.startIntent(); });
    expect(older()).toBe(false);
    expect(latest()).toBe(true);
  });

  it("scope change clears value/timer and invalidates the prior scope's async result", () => {
    const view = renderHook(({ scope }) => useTimedValue<string>(1500, scope), { initialProps: { scope: "one" } });
    let isCurrent!: () => boolean;
    act(() => { isCurrent = view.result.current.startIntent(); });
    view.rerender({ scope: "two" });
    expect(isCurrent()).toBe(false);
    act(() => view.result.current.show("second scope"));
    view.rerender({ scope: "three" });
    expect(view.result.current.value).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("same scope rerender retains the existing deadline", () => {
    const view = renderHook(({ scope }) => useTimedValue<string>(1500, scope), { initialProps: { scope: "one" } });
    act(() => view.result.current.show("saved"));
    act(() => vi.advanceTimersByTime(1000));
    view.rerender({ scope: "one" });
    act(() => vi.advanceTimersByTime(500));
    expect(view.result.current.value).toBeNull();
  });

  it("unmount invalidates pending intent and forbids creating another timer", () => {
    const view = renderHook(() => useTimedValue<string>(1500));
    let isCurrent!: () => boolean;
    act(() => { isCurrent = view.result.current.startIntent(); });
    view.unmount();
    expect(isCurrent()).toBe(false);
    view.result.current.show("late result");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("unmount cancels an already displayed value's timer", () => {
    const view = renderHook(() => useTimedValue<string>(1500));
    act(() => view.result.current.show("saved"));
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("StrictMode cleanup invalidates first-mount intent while the remount stays usable", () => {
    const intents: (() => boolean)[] = [];
    const view = renderHook(() => {
      const timed = useTimedValue<string>(1500);
      const { startIntent } = timed;
      useEffect(() => { intents.push(startIntent()); }, [startIntent]);
      return timed;
    }, { reactStrictMode: true });
    expect(intents).toHaveLength(2);
    expect(intents[0]!()).toBe(false);
    expect(intents[1]!()).toBe(true);
    act(() => view.result.current.show("second mount"));
    expect(view.result.current.value).toBe("second mount");
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(intents[1]!()).toBe(false);
  });

});
