import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewedStories } from "./use-viewed-stories";

describe("useViewedStories", () => {
  it("should initially contain index 0 (auto-marked on mount)", () => {
    const { result } = renderHook(() => useViewedStories());

    expect(result.current.viewedIndices.has(0)).toBe(true);
    expect(result.current.viewedIndices.size).toBe(1);
  });

  it("should add indices to the set via markViewed", () => {
    const { result } = renderHook(() => useViewedStories());

    act(() => {
      result.current.markViewed(3);
    });

    expect(result.current.viewedIndices.has(0)).toBe(true);
    expect(result.current.viewedIndices.has(3)).toBe(true);
    expect(result.current.viewedIndices.size).toBe(2);
  });

  it("should mark multiple indices as viewed", () => {
    const { result } = renderHook(() => useViewedStories());

    act(() => {
      result.current.markViewed(1);
    });
    act(() => {
      result.current.markViewed(2);
    });
    act(() => {
      result.current.markViewed(5);
    });

    expect(result.current.viewedIndices.has(0)).toBe(true);
    expect(result.current.viewedIndices.has(1)).toBe(true);
    expect(result.current.viewedIndices.has(2)).toBe(true);
    expect(result.current.viewedIndices.has(5)).toBe(true);
    expect(result.current.viewedIndices.size).toBe(4);
  });

  it("should not create a new set reference if index is already viewed", () => {
    const { result } = renderHook(() => useViewedStories());

    // Capture the set reference after mount (index 0 is already marked)
    const setAfterMount = result.current.viewedIndices;

    act(() => {
      result.current.markViewed(0);
    });

    // The set reference should be the same since 0 was already in the set
    expect(result.current.viewedIndices).toBe(setAfterMount);
  });

  it("should create a new set reference when adding a new index", () => {
    const { result } = renderHook(() => useViewedStories());

    const setAfterMount = result.current.viewedIndices;

    act(() => {
      result.current.markViewed(7);
    });

    // A new Set should have been created since 7 was not yet viewed
    expect(result.current.viewedIndices).not.toBe(setAfterMount);
    expect(result.current.viewedIndices.has(7)).toBe(true);
  });
});
