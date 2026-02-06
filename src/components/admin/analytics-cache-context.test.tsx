import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import {
  AnalyticsCacheProvider,
  useAnalyticsData,
} from "./analytics-cache-context";
import type { AdminApiResponse } from "@/types/admin";

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AnalyticsCacheProvider>{children}</AnalyticsCacheProvider>;
  };
}

describe("useAnalyticsData", () => {
  it("returns cached data without refetching on subsequent renders", async () => {
    const mockData = { total: 42 };
    const fetchFn = vi
      .fn<() => Promise<AdminApiResponse<{ total: number }>>>()
      .mockResolvedValue({ data: mockData });

    const wrapper = createWrapper();
    const { result, rerender } = renderHook(
      () => useAnalyticsData("visitors", fetchFn, '{"from":"2024-01-01"}'),
      { wrapper }
    );

    // First render triggers fetch
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual(mockData));
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Rerender — should use cache, no new fetch
    rerender();
    expect(result.current.data).toEqual(mockData);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("shows isLoading true only on first load (no cache)", async () => {
    const fetchFn = vi
      .fn<() => Promise<AdminApiResponse<string>>>()
      .mockResolvedValue({ data: "hello" });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useAnalyticsData("voice", fetchFn, '{}'),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isRefreshing).toBe(false);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe("hello");
  });

  it("shows isRefreshing true during background revalidation", async () => {
    let resolveSecond!: (v: AdminApiResponse<string>) => void;
    const secondPromise = new Promise<AdminApiResponse<string>>((r) => {
      resolveSecond = r;
    });

    const fetchFn = vi
      .fn<() => Promise<AdminApiResponse<string>>>()
      .mockResolvedValueOnce({ data: "first" })
      .mockReturnValueOnce(secondPromise);

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useAnalyticsData("voice", fetchFn, '{}'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("first"));

    // Force refresh (background revalidation)
    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    expect(result.current.data).toBe("first"); // still shows old data

    await act(async () => resolveSecond({ data: "second" }));

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.data).toBe("second");
  });

  it("refresh() always fetches fresh data", async () => {
    const fetchFn = vi
      .fn<() => Promise<AdminApiResponse<number>>>()
      .mockResolvedValueOnce({ data: 1 })
      .mockResolvedValueOnce({ data: 2 });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useAnalyticsData("costs", fetchFn, '{}'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe(1));
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("params change triggers fetch with new cache key", async () => {
    const fetchFn = vi
      .fn<() => Promise<AdminApiResponse<string>>>()
      .mockResolvedValueOnce({ data: "range-a" })
      .mockResolvedValueOnce({ data: "range-b" });

    const wrapper = createWrapper();
    let params = '{"from":"2024-01"}';
    const { result, rerender } = renderHook(
      () => useAnalyticsData("visitors", fetchFn, params),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("range-a"));

    // Change params
    params = '{"from":"2024-02"}';
    rerender();

    await waitFor(() => expect(result.current.data).toBe("range-b"));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("enabled: false prevents fetching", async () => {
    const fetchFn = vi
      .fn<() => Promise<AdminApiResponse<string>>>()
      .mockResolvedValue({ data: "data" });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () =>
        useAnalyticsData("visitors", fetchFn, '{}', {
          enabled: false,
        }),
      { wrapper }
    );

    // Should not be loading and not have fetched
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("stale data triggers background revalidation after staleTime", async () => {
    const fetchFn = vi
      .fn<() => Promise<AdminApiResponse<string>>>()
      .mockResolvedValueOnce({ data: "fresh" })
      .mockResolvedValueOnce({ data: "revalidated" });

    const wrapper = createWrapper();

    const { result, rerender } = renderHook(
      () =>
        useAnalyticsData("visitors", fetchFn, '{"range":"a"}', {
          staleTime: 50, // 50ms for test speed
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("fresh"));
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // Wait past stale time
    await new Promise((r) => setTimeout(r, 100));

    // Re-render triggers staleness check
    rerender();

    await waitFor(() => expect(result.current.data).toBe("revalidated"));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("handles fetch errors", async () => {
    const fetchFn = vi
      .fn<() => Promise<AdminApiResponse<string>>>()
      .mockResolvedValue({ error: "Something went wrong" });

    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useAnalyticsData("visitors", fetchFn, '{}'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("Something went wrong");
    expect(result.current.data).toBeNull();
  });

  it("switching back to previously cached params uses cache", async () => {
    let callCount = 0;
    const fetchFn = vi
      .fn<() => Promise<AdminApiResponse<string>>>()
      .mockImplementation(async () => {
        callCount++;
        return { data: `result-${callCount}` };
      });

    const wrapper = createWrapper();
    let params = '{"from":"jan"}';
    const { result, rerender } = renderHook(
      () => useAnalyticsData("visitors", fetchFn, params),
      { wrapper }
    );

    await waitFor(() => expect(result.current.data).toBe("result-1"));

    // Switch to new params
    params = '{"from":"feb"}';
    rerender();
    await waitFor(() => expect(result.current.data).toBe("result-2"));
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // Switch back to original params — should use cache
    params = '{"from":"jan"}';
    rerender();
    expect(result.current.data).toBe("result-1");
    // No additional fetch (still 2) since it's from cache within stale time
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
