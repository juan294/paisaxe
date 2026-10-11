import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchStories, bulkUpdateStoryStatus, bulkDeleteStories, approveAllPendingStories } from "@/lib/admin-api";
import { hasMissingTranslations } from "@/lib/admin-formatters";
import type { AdminStory, CurationStatus, CreateStoryResponse } from "@/types/admin";

type FilterType = "all" | CurationStatus | "missing_translations";

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
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterType>("needs_curation");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingStory, setEditingStory] = useState<AdminStory | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApproveAllConfirmOpen, setIsApproveAllConfirmOpen] = useState(false);
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  const loadStories = useCallback(
    async (page: number = currentPage) => {
      setIsLoading(true);
      setError("");

      const result = await fetchStories({ page, pageSize: PAGE_SIZE });

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setStories(result.data.stories);
        setTotal(result.data.total);
      }

      setIsLoading(false);
    },
    [currentPage]
  );

  useEffect(() => {
    loadStories(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // ── Pagination helpers ───────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(totalPages, page));
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set("tab", "stories");
      nextParams.set("storiesPage", String(clamped));
      router.push(`?${nextParams.toString()}`, { scroll: false });
    },
    [router, searchParams, totalPages]
  );

  // ── Client-side filter (applied on top of the page) ──────────────────────
  const filteredStories = stories.filter((story) => {
    if (filter === "missing_translations") {
      if (!hasMissingTranslations(story)) return false;
    } else if (filter !== "all" && story.curationStatus !== filter) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        story.title.toLowerCase().includes(query) ||
        story.subtitle.toLowerCase().includes(query) ||
        story.description.toLowerCase().includes(query) ||
        story.category.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // ── Stat card counts (from current page; page-local) ─────────────────────
  const needsCurationCount = stories.filter(
    (s) => s.curationStatus === "needs_curation"
  ).length;
  const approvedCount = stories.filter((s) => s.curationStatus === "approved").length;
  const missingTranslationsCount = stories.filter(hasMissingTranslations).length;

  // ── CRUD handlers ────────────────────────────────────────────────────────

  const handleStoryUpdate = (storyId: string, updates: Partial<AdminStory>) => {
    setStories((prev) =>
      prev.map((story) => (story.id === storyId ? { ...story, ...updates } : story))
    );
    setEditingStory((prev) =>
      prev && prev.id === storyId ? { ...prev, ...updates } : prev
    );
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
      setStories((prev) =>
        prev.map((story) =>
          selectedIds.has(story.id) ? { ...story, curationStatus: "approved" } : story
        )
      );
      setSelectedIds(new Set());
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
      setStories((prev) =>
        prev.map((story) =>
          selectedIds.has(story.id)
            ? { ...story, curationStatus: "needs_curation" }
            : story
        )
      );
      setSelectedIds(new Set());
    }

    setIsBulkUpdating(false);
  };

  const handleStoryCreated = (_story: CreateStoryResponse) => {
    loadStories(1);
    goToPage(1);
  };

  const handleApproveAll = async () => {
    setIsApprovingAll(true);
    setError("");

    const result = await approveAllPendingStories();

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setStories((prev) =>
        prev.map((story) =>
          story.curationStatus === "needs_curation"
            ? { ...story, curationStatus: "approved" }
            : story
        )
      );
    }

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
      setStories((prev) => prev.filter((story) => !selectedIds.has(story.id)));
      setSelectedIds(new Set());
    }

    setIsBulkUpdating(false);
  };
  return { currentPage, stories, total, filter, setFilter, searchQuery, setSearchQuery, isLoading, error, editingStory, setEditingStory, selectedIds, isBulkUpdating, isCreateDialogOpen, setIsCreateDialogOpen, isApproveAllConfirmOpen, setIsApproveAllConfirmOpen, isApprovingAll, totalPages, goToPage, filteredStories, needsCurationCount, approvedCount, missingTranslationsCount, handleStoryUpdate, handleToggleSelect, handleClearSelection, handleBulkMarkApproved, handleBulkMarkPending, handleStoryCreated, handleApproveAll, handleBulkDelete };
}
