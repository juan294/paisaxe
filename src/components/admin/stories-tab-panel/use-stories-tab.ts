import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchStories, bulkUpdateStoryStatus, bulkDeleteStories, approveAllPendingStories } from "@/lib/admin-api";
import type { AdminStory, CreateStoryResponse, StoryCatalogFilter, StoryCatalogStats } from "@/types/admin";

type FilterType = StoryCatalogFilter;

const PAGE_SIZE = 20;

export function useStoriesTab() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Pagination — page from URL ───────────────────────────────────────────
  const urlPage = Math.max(1, parseInt(searchParams.get("storiesPage") ?? "1", 10) || 1);
  const [currentPage, setCurrentPage] = useState<number>(urlPage);

  useEffect(() => {
    setCurrentPage(urlPage);
  }, [urlPage]);

  // ── Stories state ────────────────────────────────────────────────────────
  const [stories, setStories] = useState<AdminStory[]>([]);
  const [matchingTotal, setMatchingTotal] = useState(0);
  const [stats, setStats] = useState<StoryCatalogStats>({ total: 0, approved: 0, pending: 0, missingTranslations: 0 });
  const [pendingApprovalIds, setPendingApprovalIds] = useState<string[]>([]);
  const [approvalIds, setApprovalIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const requestSequence = useRef(0);
  const [filter, updateFilter] = useState<FilterType>("needs_curation");
  const [searchQuery, updateSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250); return () => clearTimeout(timer); }, [searchQuery]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingStory, setEditingStory] = useState<AdminStory | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApproveAllConfirmOpen, updateApproveAllConfirmOpen] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  const loadStories = useCallback(async (page: number = currentPage) => {
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError("");
    const result = await fetchStories({ page, pageSize: PAGE_SIZE, filter, search: debouncedSearch });
    if (sequence !== requestSequence.current) return;
    if (result.error) setError(result.error);
    else if (result.data) {
      setStories(result.data.stories);
      setMatchingTotal(result.data.total);
      setStats(result.data.stats);
      setPendingApprovalIds(result.data.pendingApprovalIds);
      if (result.data.page !== undefined && result.data.page !== page) {
        setCurrentPage(result.data.page);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", "stories"); params.set("storiesPage", String(result.data.page));
        router.push(`?${params.toString()}`, { scroll: false });
      }
    }
    setIsLoading(false);
  }, [currentPage, filter, debouncedSearch, router, searchParams]);

  // Router objects may be recreated by test/navigation adapters. The query
  // identity is the page/filter/search tuple, not the wrapper object's identity.
  const loadRef = useRef(loadStories);
  loadRef.current = loadStories;
  useEffect(() => {
    if (searchQuery === debouncedSearch) void loadRef.current(currentPage);
    return () => { requestSequence.current += 1; };
  }, [currentPage, filter, searchQuery, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(matchingTotal / PAGE_SIZE));
  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    if (clamped === currentPage) return;
    setSelectedIds(new Set());
    setStories([]);
    setSuccessMessage("");
    setCurrentPage(clamped);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "stories"); params.set("storiesPage", String(clamped));
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams, totalPages, currentPage]);

  const resetPage = () => {
    requestSequence.current += 1;
    setStories([]);
    setIsLoading(true);
    setSuccessMessage("");
    setSelectedIds(new Set());
    setCurrentPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "stories"); params.set("storiesPage", "1");
    router.push(`?${params.toString()}`, { scroll: false });
  };
  const setFilter = (value: FilterType) => { if (value === filter) return; resetPage(); updateFilter(value); };
  const setSearchQuery = (value: string) => { if (value === searchQuery) return; resetPage(); updateSearchQuery(value); };
  const setIsApproveAllConfirmOpen = (open: boolean) => {
    if (open) setApprovalIds([...pendingApprovalIds]);
    updateApproveAllConfirmOpen(open);
  };
  const filteredStories = stories;
  const total = stats.total;
  const needsCurationCount = stats.pending;
  const approvedCount = stats.approved;
  const missingTranslationsCount = stats.missingTranslations;

  // ── CRUD handlers ────────────────────────────────────────────────────────

  const handleStoryUpdate = (storyId: string, updates: Partial<AdminStory>) => {
    setStories((prev) =>
      prev.map((story) => (story.id === storyId ? { ...story, ...updates } : story))
    );
    setEditingStory((prev) =>
      prev && prev.id === storyId ? { ...prev, ...updates } : prev
    );
    void loadRef.current();
  };

  const handleToggleSelect = (storyId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  const handleBulkMarkApproved = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);

    const result = await bulkUpdateStoryStatus(Array.from(selectedIds), "approved");

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSelectedIds(new Set());
      await loadRef.current();
    }

    setIsBulkUpdating(false);
  };

  const handleBulkMarkPending = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);

    const result = await bulkUpdateStoryStatus(
      Array.from(selectedIds),
      "needs_curation"
    );

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSelectedIds(new Set());
      await loadRef.current();
    }

    setIsBulkUpdating(false);
  };

  const handleStoryCreated = (_story: CreateStoryResponse) => {
    void loadRef.current(1);
    goToPage(1);
  };

  const handleApproveAll = async () => {
    setIsApprovingAll(true);
    setError("");

    const result = await approveAllPendingStories(approvalIds);

    if (result.data) setSuccessMessage(`Se han aprobado ${result.data.approvedCount} historias.`);
    setSelectedIds(new Set());
    await loadRef.current();
    if (result.error) setError(result.error);

    setIsApprovingAll(false);
    setIsApproveAllConfirmOpen(false);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} ${
        selectedIds.size === 1 ? "story" : "stories"
      }? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsBulkUpdating(true);

    const result = await bulkDeleteStories(Array.from(selectedIds));

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSelectedIds(new Set());
      await loadRef.current();
    }

    setIsBulkUpdating(false);
  };
  return { approvalCount: approvalIds.length, successMessage, currentPage, stories, total, filter, setFilter, searchQuery, setSearchQuery, isLoading, error, editingStory, setEditingStory, selectedIds, isBulkUpdating, isCreateDialogOpen, setIsCreateDialogOpen, isApproveAllConfirmOpen, setIsApproveAllConfirmOpen, isApprovingAll, totalPages, goToPage, filteredStories, needsCurationCount, approvedCount, missingTranslationsCount, handleStoryUpdate, handleToggleSelect, handleClearSelection, handleBulkMarkApproved, handleBulkMarkPending, handleStoryCreated, handleApproveAll, handleBulkDelete };
}
