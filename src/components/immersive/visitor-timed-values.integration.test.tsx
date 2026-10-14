import { favoritesStorageKey } from "@/lib/client-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { BookmarkButton } from "./bookmark-button";
import { useShareStory } from "@/hooks/use-share-story";
import FavoritesPage from "@/app/favorites/page";
import { AuthProvider } from "@/components/auth/auth-provider";
import { StoriesProvider } from "@/hooks/use-stories";
import { LanguageProvider, useTranslation } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Story } from "@/types/immersive";

// Next router is a platform boundary. Owned hooks, providers and components
// below are real, including the Supabase browser wrapper and installed SDK.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const story: Story = { id: "phase6-story-one", slug: "phase6-story-one", title: "Lugar uno", subtitle: "Asturias", description: "Primero", image: "", category: "nature", sourcePdf: "local.pdf" };
const second: Story = { ...story, id: "phase6-story-two", slug: "phase6-story-two", title: "Lugar dos" };
const Language = ({ children }: { children: ReactNode }) => <LanguageProvider initialLocale="es">{children}</LanguageProvider>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let sdk: ReturnType<typeof createSupabaseBrowserClient> = null;
const fetchBoundary = vi.fn<typeof fetch>();
let writeText: ReturnType<typeof vi.fn<(value: string) => Promise<void>>>;

beforeEach(() => {
  vi.useFakeTimers();
  writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(undefined);
  vi.stubGlobal("fetch", fetchBoundary);
  fetchBoundary.mockReset();
  fetchBoundary.mockImplementation(async () => { throw new Error("Unexpected network boundary request"); });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(pointer: fine)", media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  if (sdk) {
    await sdk.auth.signOut({ scope: "local" });
    await sdk.auth.stopAutoRefresh();
    sdk = null;
  }
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Phase 6 real bookmark timed feedback", () => {
  it("keeps replacement feedback for exactly 1500ms and preserves both toggles", () => {
    const onToggle = vi.fn();
    const view = render(<BookmarkButton isFavorite={false} onToggle={onToggle} />, { wrapper: Language });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("status")).toHaveTextContent("Guardado en favoritos");
    act(() => vi.advanceTimersByTime(1000));
    view.rerender(<BookmarkButton isFavorite onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("status")).toHaveTextContent("Eliminado de favoritos");
    act(() => vi.advanceTimersByTime(999));
    expect(screen.getByRole("status")).toHaveTextContent("Eliminado de favoritos");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("cancels its pending feedback timer on unmount", () => {
    const baseline = vi.getTimerCount();
    const view = render(<BookmarkButton onToggle={vi.fn()} />, { wrapper: Language });
    fireEvent.click(screen.getByRole("button"));
    expect(vi.getTimerCount()).toBe(baseline + 1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(baseline);
  });
});

describe("Phase 6 real share feedback and stale async ownership", () => {
  it("replaces its 1500ms timeout without shortening newer error feedback", async () => {
    const { result } = renderHook(() => useShareStory(story), { wrapper: Language });
    await act(async () => { await result.current.handleShare(); });
    act(() => vi.advanceTimersByTime(1000));
    writeText.mockRejectedValueOnce(new Error("denied"));
    await act(async () => { await result.current.handleShare(); });
    expect(result.current.toast).toBe("No se pudo copiar");
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.toast).toBe("No se pudo copiar");
    act(() => vi.advanceTimersByTime(999));
    expect(result.current.toast).toBe("No se pudo copiar");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it("cancels an existing share timer on unmount", async () => {
    const baseline = vi.getTimerCount();
    const view = renderHook(() => useShareStory(story), { wrapper: Language });
    await act(async () => { await view.result.current.handleShare(); });
    expect(view.result.current.toast).toBe("Enlace copiado");
    view.unmount();
    expect(vi.getTimerCount()).toBe(baseline);
  });

  it("does not let an older failed clipboard operation replace a newer success", async () => {
    const old = deferred<void>();
    writeText.mockImplementationOnce(() => old.promise);
    const { result } = renderHook(() => useShareStory(story), { wrapper: Language });
    let oldAction!: Promise<void>;
    await act(async () => { oldAction = result.current.handleShare(); });
    await act(async () => { await result.current.handleShare(); });
    expect(result.current.toast).toBe("Enlace copiado");
    await act(async () => { old.reject(new Error("late denial")); await oldAction; });
    expect(result.current.toast).toBe("Enlace copiado");
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("P6-T4: old success cannot replace newer error or renew its exact 1500ms deadline", async () => {
    const old = deferred<void>();
    writeText.mockImplementationOnce(() => old.promise);
    const { result } = renderHook(() => useShareStory(story), { wrapper: Language });
    let oldAction!: Promise<void>;
    await act(async () => { oldAction = result.current.handleShare(); });
    writeText.mockRejectedValueOnce(new Error("newer denial"));
    await act(async () => { await result.current.handleShare(); });
    expect(result.current.toast).toBe("No se pudo copiar");
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(500));
    await act(async () => { old.resolve(); await oldAction; });
    expect(result.current.toast).toBe("No se pudo copiar");
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(999));
    expect(result.current.toast).toBe("No se pudo copiar");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it("invalidates pending feedback when the displayed story changes", async () => {
    const old = deferred<void>();
    writeText.mockImplementationOnce(() => old.promise);
    const view = renderHook(({ selected }) => useShareStory(selected), { initialProps: { selected: story }, wrapper: Language });
    let action!: Promise<void>;
    await act(async () => { action = view.result.current.handleShare(); });
    view.rerender({ selected: second });
    await act(async () => { old.resolve(); await action; });
    expect(view.result.current.toast).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/story/phase6-story-one"));
  });

  it("a real locale change invalidates pending feedback from the old locale", async () => {
    const pending = deferred<void>();
    writeText.mockImplementationOnce(() => pending.promise);
    const { result } = renderHook(() => ({ share: useShareStory(story), language: useTranslation() }), { wrapper: Language });
    let action!: Promise<void>;
    await act(async () => { action = result.current.share.handleShare(); });
    act(() => result.current.language.setLocale("en"));
    expect(result.current.language.locale).toBe("en");
    await act(async () => { pending.resolve(); await action; });
    expect(result.current.share.toast).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears displayed feedback and its timer when the story changes", async () => {
    const view = renderHook(({ selected }) => useShareStory(selected), { initialProps: { selected: story }, wrapper: Language });
    await act(async () => { await view.result.current.handleShare(); });
    expect(view.result.current.toast).toBe("Enlace copiado");
    view.rerender({ selected: second });
    expect(view.result.current.toast).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start clipboard fallback after an unmounted native-share rejection", async () => {
    const pending = deferred<void>();
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn(() => pending.promise) });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    vi.mocked(window.matchMedia).mockImplementation((query) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    const view = renderHook(() => useShareStory(story), { wrapper: Language });
    let action!: Promise<void>;
    await act(async () => { action = view.result.current.handleShare(); });
    view.unmount();
    await act(async () => { pending.reject(new Error("late native failure")); await action; });
    expect(writeText).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["success", "failure"])("cannot schedule feedback after unmount and late clipboard %s", async (outcome) => {
    const pending = deferred<void>();
    writeText.mockImplementationOnce(() => pending.promise);
    const baseline = vi.getTimerCount();
    const view = renderHook(() => useShareStory(story), { wrapper: Language });
    let action!: Promise<void>;
    await act(async () => { action = view.result.current.handleShare(); });
    view.unmount();
    await act(async () => {
      if (outcome === "success") pending.resolve();
      else pending.reject(new Error("late denial"));
      await action;
    });
    expect(vi.getTimerCount()).toBe(baseline);
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("clearing feedback cancels its timer and invalidates a pending clipboard rejection", async () => {
    const { result } = renderHook(() => useShareStory(story), { wrapper: Language });
    await act(async () => { await result.current.handleShare(); });
    const pending = deferred<void>();
    writeText.mockImplementationOnce(() => pending.promise);
    let action!: Promise<void>;
    await act(async () => { action = result.current.handleShare(); });
    // Planned narrow clear operation; this API gap is reported separately from
    // the existing-behavior stale/unmount failures, never counted as their RED.
    act(() => result.current.clearToast());
    expect(result.current.toast).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { pending.reject(new Error("late denial")); await action; });
    expect(result.current.toast).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Phase 6 favorites undo through real auth/stories/favorites providers", () => {
  const user = { id: "00000000-0000-4000-8000-000000000929", email: "phase6@example.invalid", aud: "authenticated", role: "authenticated", user_metadata: {}, app_metadata: {}, created_at: "2026-10-09T00:00:00Z" };
  let removed: ReturnType<typeof deferred<Response>>;
  let added: ReturnType<typeof deferred<Response>>;
  let serverIds: string[];
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

  async function renderFavorites() {
    // SDK initialization runs on the real clock; only the undo interval below
    // uses fake time. Every fetch is denied unless matched by this local model.
    vi.useRealTimers();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJ_phase6_synthetic_anon");
    document.cookie = "__csrf=phase6-synthetic-csrf";
    removed = deferred<Response>(); added = deferred<Response>();
    serverIds = [story.id, second.id];
    fetchBoundary.mockImplementation(async (input, init) => {
      const raw = input instanceof Request ? input.url : String(input);
      const url = new URL(raw, window.location.origin);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      if (url.origin === "http://127.0.0.1:54321" && url.pathname === "/auth/v1/user") return json(user);
      if (url.origin === "http://127.0.0.1:54321" && url.pathname === "/auth/v1/logout") return json({});
      if (url.origin !== window.location.origin || url.pathname !== "/api/favorites") throw new Error(`Forbidden boundary: ${method} ${url.pathname}`);
      if (method === "GET") return json(serverIds);
      if (method === "DELETE") return removed.promise.then((response) => { if (response.ok) serverIds = serverIds.filter((id) => id !== url.searchParams.get("storyId")); return response; });
      if (method === "POST") return added.promise.then((response) => { if (response.ok) serverIds = [...new Set([...serverIds, ...JSON.parse(String(init?.body)).storyIds])]; return response; });
      throw new Error(`Forbidden favorites method: ${method}`);
    });
    sdk = createSupabaseBrowserClient();
    expect(sdk).not.toBeNull();
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
    const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.c3ludGhldGlj`;
    const session = await sdk!.auth.setSession({ access_token: token, refresh_token: "phase6-synthetic-refresh" });
    expect(session.error).toBeNull();
    await sdk!.auth.stopAutoRefresh();
    await act(async () => {
      render(<Language><AuthProvider><StoriesProvider initialStories={[story, second]}><FavoritesPage /></StoriesProvider></AuthProvider></Language>);
    });
    // Dynamic auth bootstrap imports are awaited by real-time RTL polling.
    await screen.findAllByRole("button", { name: "Quitar de guardados" });
    await act(async () => { await Promise.resolve(); });
    vi.useFakeTimers();
  }

  const removeFirst = async () => { await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Quitar de guardados" })[0]!); }); };
  const undo = () => screen.queryByRole("button", { name: "Deshacer" });

  it("expires at exactly 6000ms and a late successful DELETE cannot revive Undo", async () => {
    await renderFavorites();
    await removeFirst();
    expect(undo()).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5999));
    expect(undo()).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(undo()).not.toBeInTheDocument();
    await act(async () => { removed.resolve(json({})); });
    expect(undo()).not.toBeInTheDocument();
    expect(serverIds).toEqual([second.id]);
    expect(JSON.parse(localStorage.getItem(favoritesStorageKey(user.id))!).data).toEqual([second.id]);
    expect(fetchBoundary.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("Undo clears the timer immediately while pending DELETE/POST outcomes remain real", async () => {
    await renderFavorites();
    const timers = vi.spyOn(globalThis, "setTimeout");
    const clearTimer = vi.spyOn(globalThis, "clearTimeout");
    await removeFirst();
    const ownedTimer = timers.mock.results[timers.mock.calls.findIndex(([, delay]) => delay === 6000)]!.value;
    expect(ownedTimer).toBeDefined();
    fireEvent.click(undo()!);
    expect(undo()).not.toBeInTheDocument();
    expect(clearTimer).toHaveBeenCalledWith(ownedTimer);
    await act(async () => { removed.resolve(json({})); });
    expect(undo()).not.toBeInTheDocument();
    await act(async () => { added.resolve(json({})); });
    expect(undo()).not.toBeInTheDocument();
    expect(new Set(serverIds)).toEqual(new Set([story.id, second.id]));
    expect(new Set(JSON.parse(localStorage.getItem(favoritesStorageKey(user.id))!).data)).toEqual(new Set([story.id, second.id]));
    const writes = fetchBoundary.mock.calls.filter(([, init]) => init?.method === "DELETE" || init?.method === "POST");
    expect(writes.map(([, init]) => init?.method)).toEqual(["DELETE", "POST"]);
    expect(writes[1]?.[1]?.body).toBe(JSON.stringify({ storyIds: [story.id] }));
    expect(writes[0]?.[1]?.headers).toMatchObject({ "x-csrf-token": "phase6-synthetic-csrf" });
    act(() => vi.advanceTimersByTime(6000));
    expect(undo()).not.toBeInTheDocument();
  });

  it("replacement removal gets a fresh 6000ms and unmount cancels the owned timer", async () => {
    await renderFavorites();
    const timers = vi.spyOn(globalThis, "setTimeout");
    const clearTimer = vi.spyOn(globalThis, "clearTimeout");
    await removeFirst();
    act(() => vi.advanceTimersByTime(1000));
    await removeFirst();
    expect(screen.getByRole("status")).toHaveTextContent("Lugar dos");
    act(() => vi.advanceTimersByTime(5000));
    expect(undo()).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(999));
    expect(undo()).toBeInTheDocument();
    const index = timers.mock.calls.map(([, delay]) => delay).lastIndexOf(6000);
    const ownedTimer = timers.mock.results[index]!.value;
    expect(ownedTimer).toBeDefined();
    cleanup();
    expect(clearTimer).toHaveBeenCalledWith(ownedTimer);
    await act(async () => { removed.resolve(json({})); });
    expect(undo()).not.toBeInTheDocument();
  });

  it("failed re-add preserves the real rollback without reviving a cleared Undo notice", async () => {
    await renderFavorites();
    await removeFirst();
    fireEvent.click(undo()!);
    await act(async () => { removed.resolve(json({})); });
    await act(async () => { added.resolve(new Response("rejected", { status: 500 })); });
    expect(undo()).not.toBeInTheDocument();
    expect(serverIds).toEqual([second.id]);
    expect(JSON.parse(localStorage.getItem(favoritesStorageKey(user.id))!).data).toEqual([second.id]);
    expect(within(screen.getByRole("main")).queryByText(story.title)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6000));
    expect(undo()).not.toBeInTheDocument();
  });
});
