import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useStoriesTab } from "./use-stories-tab";
const { fetchStories, approveAllPendingStories, push } = vi.hoisted(() => ({ fetchStories: vi.fn(), approveAllPendingStories: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/admin-api", () => ({ fetchStories, approveAllPendingStories, bulkUpdateStoryStatus: vi.fn(), bulkDeleteStories: vi.fn() }));
const snapshot = { stories: [], total: 129, page: 1, pageSize: 20, stats: { total: 200, approved: 71, pending: 129, missingTranslations: 150 }, pendingApprovalIds: ["first", "second"] };
beforeEach(() => { vi.clearAllMocks(); fetchStories.mockResolvedValue({ data: snapshot }); approveAllPendingStories.mockResolvedValue({ data: { approvedCount: 2, approvedIds: ["first", "second"] } }); });
describe("catalog dashboard contract", () => {
  it("uses catalog totals rather than the loaded page", async () => {
    const { result } = renderHook(() => useStoriesTab());
    await waitFor(() => expect(result.current.approvedCount).toBe(71));
    expect(result.current.needsCurationCount).toBe(129); expect(result.current.missingTranslationsCount).toBe(150); expect(result.current.total).toBe(200); expect(result.current.totalPages).toBe(7);
  });
  it("sends filter and search to the server", async () => {
    const { result } = renderHook(() => useStoriesTab());
    await waitFor(() => expect(fetchStories).toHaveBeenCalled());
    act(() => result.current.setFilter("approved"));
    await waitFor(() => expect(fetchStories).toHaveBeenLastCalledWith(expect.objectContaining({ filter: "approved", page: 1 })));
    act(() => result.current.setSearchQuery("Oviedo"));
    await waitFor(() => expect(fetchStories).toHaveBeenLastCalledWith(expect.objectContaining({ filter: "approved", search: "Oviedo", page: 1 })));
  });
  it("approves the IDs frozen when confirmation opened, not a later response", async () => {
    const { result } = renderHook(() => useStoriesTab());
    await waitFor(() => expect(result.current.needsCurationCount).toBe(129));
    act(() => result.current.setIsApproveAllConfirmOpen(true));
    fetchStories.mockResolvedValue({ data: { ...snapshot, pendingApprovalIds: ["first", "second", "late"] } });
    await act(async () => result.current.handleApproveAll());
    expect(approveAllPendingStories).toHaveBeenCalledWith(["first", "second"]);
  });
  it("ignores an older catalog response after the filter changes", async () => {
    let finish!: (value: unknown) => void;
    fetchStories.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fetchStories.mockResolvedValue({ data: { ...snapshot, stats: { ...snapshot.stats, approved: 72 } } });
    const { result } = renderHook(() => useStoriesTab());
    await waitFor(() => expect(fetchStories).toHaveBeenCalledOnce());
    act(() => result.current.setFilter("approved"));
    await waitFor(() => expect(result.current.approvedCount).toBe(72));
    await act(async () => finish({ data: snapshot }));
    expect(result.current.approvedCount).toBe(72);
    expect(result.current.isLoading).toBe(false);
  });

  it("refreshes counts after a partial approval and keeps the error and actual receipt visible", async () => {
    const { result } = renderHook(() => useStoriesTab());
    await waitFor(() => expect(result.current.approvedCount).toBe(71));
    act(() => result.current.setIsApproveAllConfirmOpen(true));
    approveAllPendingStories.mockResolvedValue({ error: "Second batch failed", data: { approvedCount: 1, approvedIds: ["first"] } });
    fetchStories.mockResolvedValue({ data: { ...snapshot, stats: { ...snapshot.stats, approved: 72, pending: 128 }, pendingApprovalIds: ["second"] } });
    await act(async () => result.current.handleApproveAll());
    expect(result.current.approvedCount).toBe(72);
    expect(result.current.needsCurationCount).toBe(128);
    expect(result.current.successMessage).toContain("1 historias");
    expect(result.current.error).toBe("Second batch failed");
  });

});
