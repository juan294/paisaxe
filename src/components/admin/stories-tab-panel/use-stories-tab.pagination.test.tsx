import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useStoriesTab } from "./use-stories-tab";
import { selectStoryCatalog } from "@/lib/admin-story-catalog";
import type { AdminStory, StoryCatalogFilter } from "@/types/admin";

const navigation = vi.hoisted(() => ({ push: vi.fn(), query: "storiesPage=3" }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useSearchParams: () => new URLSearchParams(navigation.query) }));
let catalog: AdminStory[];
let requests: URL[];
beforeEach(() => {
  navigation.query = "storiesPage=3";
  navigation.push.mockClear();
  requests = [];
  catalog = Array.from({ length: 21 }, (_,i) => ({
    id: `story-${i}`, slug: `story-${i}`, title: `Story ${i}`, subtitle: "Subtitle", description: "Description",
    category: "nature", image: "", displayOrder: i, curationStatus: "needs_curation", createdAt: "2026-10-13", updatedAt: "2026-10-13",
  }));
  // Exercise the real API helper and catalog selector; only HTTP/navigation are replaced.
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input), window.location.origin);
    expect(url.pathname).toBe("/api/admin/stories");
    requests.push(url);
    return Response.json({ data: selectStoryCatalog(catalog, {
      page: Number(url.searchParams.get("page")), pageSize: Number(url.searchParams.get("pageSize")),
      filter: url.searchParams.get("filter") as StoryCatalogFilter, search: url.searchParams.get("search") ?? "",
    }) });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("catalog page recovery through the real API client", () => {
  it("repairs a stale URL page and recovers again when the matching catalog shrinks", async () => {
    const { result } = renderHook(() => useStoriesTab());
    await waitFor(() => expect(result.current.currentPage).toBe(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stories.map(s => s.id)).toEqual(["story-20"]);
    expect(navigation.push).toHaveBeenCalledWith("?storiesPage=2&tab=stories", { scroll: false });
    catalog = catalog.slice(0,1);
    act(() => result.current.handleStoryUpdate("story-20", { title: "Updated elsewhere" }));
    await waitFor(() => expect(result.current.currentPage).toBe(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stories.map(s => s.id)).toEqual(["story-0"]);
    expect(result.current.total).toBe(1);
    expect(navigation.push).toHaveBeenLastCalledWith("?storiesPage=1&tab=stories", { scroll: false });
  });

  it("keeps selection and the current page when the active filter or unchanged search is selected again", async () => {
    navigation.query = "storiesPage=2";
    const { result } = renderHook(() => useStoriesTab());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.stories).toHaveLength(1));
    const loaded = requests.length;
    act(() => {
      result.current.handleToggleSelect("story-20");
      result.current.setFilter("needs_curation");
      result.current.setSearchQuery("");
    });
    expect(result.current.currentPage).toBe(2);
    expect(result.current.selectedIds.has("story-20")).toBe(true);
    expect(result.current.stories.map(s => s.id)).toEqual(["story-20"]);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(requests).toHaveLength(loaded);
  });
});
