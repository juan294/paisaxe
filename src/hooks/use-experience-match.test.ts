import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExperienceMatch } from "./use-experience-match";
import type { MatchRequest } from "@/types/experience-match";

const request: MatchRequest = {
  locale: "es",
  preference: "Un paseo tranquilo",
  partySize: 2,
};
const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => Response.json(body, { status });
const result = {
  status: "no_results",
  suggestions: [],
  catalog: [],
  examinedCount: 0,
  truncated: false,
  remaining: 4,
};
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("useExperienceMatch", () => {
  it("does nothing on mount/rerender; opening only checks capability and explicit submit posts once", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(json(result));
    const { result: hook, rerender } = renderHook(() =>
      useExperienceMatch({ accessToken: "token", locale: "es" }),
    );
    rerender();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(() => hook.current.open());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: "GET",
      cache: "no-store",
      headers: { Authorization: "Bearer token" },
    });
    await act(() => hook.current.submit(request));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(request),
    });
    expect(hook.current.result).toEqual(result);
    expect(hook.current.submittedCriteria).toEqual({ partySize: 2 });
  });
  it("retry rechecks capability and sends one fresh POST; unavailable capability never posts", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(json(result))
      .mockResolvedValueOnce(json({ available: false }))
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(json(result));
    const { result: h } = renderHook(() =>
      useExperienceMatch({ accessToken: "token", locale: "es" }),
    );
    await act(() => h.current.open());
    await act(() => h.current.submit(request));
    await act(() => h.current.retry(request));
    expect(h.current.capability).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await act(() => h.current.retry(request));
    expect(fetchMock.mock.calls.map((c) => c[1]?.method)).toEqual([
      "GET",
      "POST",
      "GET",
      "GET",
      "POST",
    ]);
  });
  it("aborts superseded POSTs and ignores responses even when transport ignores abort", async () => {
    const old = deferred();
    const fresh = { ...result, remaining: 2 };
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(json(fresh));
    const { result: h } = renderHook(() =>
      useExperienceMatch({ accessToken: "token", locale: "es" }),
    );
    await act(() => h.current.open());
    let first!: Promise<void>;
    act(() => {
      first = h.current.submit(request);
    });
    const oldSignal = fetchMock.mock.calls[1]![1]!.signal as AbortSignal;
    await act(() =>
      h.current.submit({ ...request, preference: "Una visita corta" }),
    );
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      old.resolve(json({ ...result, remaining: 99 }));
      await first;
    });
    expect(h.current.result).toEqual(fresh);
  });
  it("close cancels an active search without automatic retries or stale results", async () => {
    const pending = deferred();
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockReturnValueOnce(pending.promise);
    const { result: h } = renderHook(() =>
      useExperienceMatch({ accessToken: "token", locale: "es" }),
    );
    await act(() => h.current.open());
    let work!: Promise<void>;
    act(() => {
      work = h.current.submit(request);
    });
    act(() => h.current.close());
    expect((fetchMock.mock.calls[1]![1]!.signal as AbortSignal).aborted).toBe(
      true,
    );
    await act(async () => {
      pending.resolve(json(result));
      await work;
    });
    expect(h.current.isOpen).toBe(false);
    expect(h.current.isSearching).toBe(false);
    expect(h.current.result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("token/locale changes invalidate work and require explicit reopen; unmount aborts", async () => {
    const pending = deferred();
    fetchMock
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(json({ available: true }));
    const {
      result: h,
      rerender,
      unmount,
    } = renderHook(
      ({ token, locale }) => useExperienceMatch({ accessToken: token, locale }),
      { initialProps: { token: "one", locale: "es" } },
    );
    let opening!: Promise<void>;
    act(() => {
      opening = h.current.open();
    });
    rerender({ token: "two", locale: "en" });
    expect((fetchMock.mock.calls[0]![1]!.signal as AbortSignal).aborted).toBe(
      true,
    );
    expect(h.current.isOpen).toBe(false);
    await act(async () => {
      pending.resolve(json({ available: true }));
      await opening;
    });
    expect(h.current.capability).toBe("idle");
    await act(() => h.current.open());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    unmount();
  });
  it("unmount aborts an in-flight POST even if its response later resolves", async () => {
    const pending = deferred();
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockReturnValueOnce(pending.promise);
    const { result: h, unmount } = renderHook(() =>
      useExperienceMatch({ accessToken: "token", locale: "es" }),
    );
    await act(() => h.current.open());
    let work!: Promise<void>;
    act(() => {
      work = h.current.submit(request);
    });
    const signal = fetchMock.mock.calls[1]![1]!.signal as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      pending.resolve(json(result));
      await work;
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("preserves field, access and rate/allowance errors without retrying", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(
        json(
          { status: "invalid_input", fields: { preference: "invalid" } },
          400,
        ),
      )
      .mockResolvedValueOnce(
        json({ status: "rate_limited", retryAfter: 17 }, 429),
      )
      .mockResolvedValueOnce(json({ status: "allowance_exhausted" }, 429))
      .mockResolvedValueOnce(json({ error: "Not found" }, 404));
    const { result: h } = renderHook(() =>
      useExperienceMatch({ accessToken: "token", locale: "es" }),
    );
    await act(() => h.current.open());
    await act(() => h.current.submit(request));
    expect(h.current.error).toMatchObject({
      kind: "invalid_input",
      fields: { preference: "invalid" },
    });
    await act(() => h.current.submit(request));
    expect(h.current.error).toEqual({ kind: "rate_limited", retryAfter: 17 });
    await act(() => h.current.submit(request));
    expect(h.current.error?.kind).toBe("allowance_exhausted");
    await act(() => h.current.submit(request));
    expect(h.current.capability).toBe("access_expired");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
  it("cancel exits loading and retains a may-have-consumed state until explicit search", async () => {
    const pending = deferred();
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockReturnValueOnce(pending.promise);
    const { result: h } = renderHook(() =>
      useExperienceMatch({ accessToken: "token", locale: "es" }),
    );
    await act(() => h.current.open());
    let work!: Promise<void>;
    act(() => {
      work = h.current.submit(request);
    });
    act(() => h.current.cancel());
    expect(h.current.cancelled).toBe(true);
    expect(h.current.isSearching).toBe(false);
    await act(async () => {
      pending.resolve(json(result));
      await work;
    });
    expect(h.current.result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("a network failure permits a later explicit retry without a sticky failure", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ available: true }))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(json({ available: true }))
      .mockResolvedValueOnce(json(result));
    const { result: h } = renderHook(() =>
      useExperienceMatch({ accessToken: "token", locale: "es" }),
    );
    await act(() => h.current.open());
    await act(() => h.current.submit(request));
    expect(h.current.error?.kind).toBe("unavailable");
    await act(() => h.current.retry(request));
    await waitFor(() => expect(h.current.result).toEqual(result));
  });
});


describe("useExperienceMatch recovery boundaries", () => {
  it.each([
    ["concealed access", () => json({ error: "Not found" }, 404), "access_expired"],
    ["server failure", () => json({ error: "temporarily unavailable" }, 503), "error"],
    ["malformed JSON", () => new Response("not-json", { status: 200 }), "error"],
    ["missing capability", () => json({}), "error"],
  ] as const)("does not charge on GET %s and recovers on an explicit reopen", async (_name, response, capability) => {
    fetchMock.mockResolvedValueOnce(response()).mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(json(result));
    const { result: h } = renderHook(() => useExperienceMatch({ locale: "es" }));
    await act(() => h.current.open()); expect(h.current.capability).toBe(capability);
    expect(fetchMock.mock.calls[0]![1]!.headers).not.toHaveProperty("Authorization");
    await act(() => h.current.submit(request)); expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(() => h.current.open()); await act(() => h.current.submit(request));
    expect(h.current.result).toEqual(result); expect(fetchMock.mock.calls.map(c => c[1]?.method)).toEqual(["GET", "GET", "POST"]);
  });
  it("handles rejected capability transport without sticking, and ignores a rejected obsolete GET", async () => {
    let rejectOld!: (reason: Error) => void;
    const obsolete = new Promise<Response>((_resolve, reject) => { rejectOld = reject; });
    fetchMock.mockRejectedValueOnce(new TypeError("offline")).mockReturnValueOnce(obsolete).mockResolvedValueOnce(json({ available: true }));
    const { result: h } = renderHook(() => useExperienceMatch({ locale: "es", accessToken: "token" }));
    await act(() => h.current.open()); expect(h.current.capability).toBe("error");
    let old!: Promise<void>; act(() => { old = h.current.open(); }); await act(() => h.current.open());
    await act(async () => { rejectOld(new DOMException("aborted", "AbortError")); await old; });
    expect(h.current.capability).toBe("available"); expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it.each([
    ["non-JSON failure", () => new Response("unavailable", { status: 503 })],
    ["JSON failure", () => json({ error: "unavailable" }, 503)],
    ["unavailable result at non-success status", () => json({ status: "unavailable", reason: "catalog_unavailable", guidance: "retry_or_chat", turnMayBeConsumed: true }, 503)],
  ] as const)("exits loading safely after POST %s without automatic retry", async (_name, response) => {
    fetchMock.mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(response());
    const { result: h } = renderHook(() => useExperienceMatch({ accessToken: "token", locale: "es" }));
    await act(() => h.current.open()); await act(() => h.current.submit(request));
    expect(h.current.error).toEqual({ kind: "unavailable" }); expect(h.current.isSearching).toBe(false); expect(h.current.result).toBeNull(); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("preserves server Retry-After seconds when no retry timing is in the JSON body", async () => {
    fetchMock.mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(Response.json({ status: "rate_limited" }, { status: 429, headers: { "Retry-After": "23" } }));
    const { result: h } = renderHook(() => useExperienceMatch({ accessToken: "token", locale: "es" }));
    await act(() => h.current.open()); await act(() => h.current.submit(request));
    expect(h.current.error).toEqual({ kind: "rate_limited", retryAfter: 23 }); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("closed submit/retry/cancel remain free, and an unsupported locale cannot submit after capability checking", async () => {
    const { result: h } = renderHook(() => useExperienceMatch({ accessToken: "token", locale: "en" }));
    await act(() => h.current.submit(request)); await act(() => h.current.retry(request)); act(() => h.current.cancel()); expect(fetchMock).not.toHaveBeenCalled(); expect(h.current.cancelled).toBe(false);
    fetchMock.mockResolvedValueOnce(json({ available: false })); await act(() => h.current.open()); await act(() => h.current.submit(request));
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(h.current.capability).toBe("unavailable");
  });
  it("retains all explicit structured criteria and a server-declared unavailable result", async () => {
    const unavailable = { status: "unavailable", reason: "metering_unknown", guidance: "retry_or_chat", turnMayBeConsumed: true };
    fetchMock.mockResolvedValueOnce(json({ available: true })).mockResolvedValueOnce(json(unavailable));
    const { result: h } = renderHook(() => useExperienceMatch({ accessToken: "token", locale: "es" }));
    await act(() => h.current.open()); await act(() => h.current.submit({ ...request, date: "2026-11-02", budgetCents: 0, constraints: { public_transport: true, pets: true, min_age: 0, language: "it" } }));
    expect(h.current.result).toEqual(unavailable); expect(h.current.submittedCriteria).toEqual({ date: "2026-11-02", partySize: 2, budgetCents: 0, constraints: { public_transport: true, pets: true, min_age: 0, language: "it" } }); expect(h.current.isSearching).toBe(false);
  });
});
