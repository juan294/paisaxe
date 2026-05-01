"use client";

/**
 * StoriesTabPanel
 *
 * Extracted from AdminShell (FE-M2). Owns all stories tab state:
 * stat card filters, search, story CRUD, selection, and server-side
 * pagination (PE-M5). Page position is persisted in URL via ?storiesPage=N.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchStories,
  bulkUpdateStoryStatus,
  bulkDeleteStories,
  approveAllPendingStories,
} from "@/lib/admin-api";
import { hasMissingTranslations } from "@/lib/admin-formatters";
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  ImageIcon,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Plus,
  Languages,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { AdminStory, CurationStatus, CreateStoryResponse } from "@/types/admin";

const StoryGrid = dynamic(
  () => import("@/components/admin/story-grid").then((m) => ({ default: m.StoryGrid })),
  { ssr: false }
);

const StoryEditorDialog = dynamic(
  () =>
    import("@/components/admin/story-editor-dialog").then((m) => ({
      default: m.StoryEditorDialog,
    })),
  { ssr: false }
);

const CreateStoryDialog = dynamic(
  () =>
    import("@/components/admin/create-story-dialog").then((m) => ({
      default: m.CreateStoryDialog,
    })),
  { ssr: false }
);

const SelectionToolbar = dynamic(
  () =>
    import("@/components/admin/selection-toolbar").then((m) => ({
      default: m.SelectionToolbar,
    })),
  { ssr: false }
);

type FilterType = "all" | CurationStatus | "missing_translations";

const PAGE_SIZE = 20;

export function StoriesTabPanel() {
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
      router.push(`?storiesPage=${clamped}`, { scroll: false });
    },
    [router, totalPages]
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page heading */}
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
          Admin / Stories
        </p>
        <h1 className="mt-2 text-4xl font-extralight tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
          Content Dashboard
        </h1>
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          value={needsCurationCount}
          label="Pending"
          variant="warning"
          isActive={filter === "needs_curation"}
          onClick={() => setFilter("needs_curation")}
          ariaLabel="Filter: show pending stories"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={approvedCount}
          label="Approved"
          variant="success"
          isActive={filter === "approved"}
          onClick={() => setFilter("approved")}
          ariaLabel="Filter: show approved stories"
        />
        <StatCard
          icon={<Languages className="h-5 w-5" />}
          value={missingTranslationsCount}
          label="Missing i18n"
          variant="purple"
          isActive={filter === "missing_translations"}
          onClick={() => setFilter("missing_translations")}
          ariaLabel="Filter: show missing translations"
        />
        <StatCard
          icon={<Layers className="h-5 w-5" />}
          value={total}
          label="Total"
          variant="default"
          isActive={filter === "all"}
          onClick={() => setFilter("all")}
          ariaLabel="Filter: show all stories"
        />
      </div>

      {/* Search + actions toolbar */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a39e98]" />
          <Input
            type="text"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 rounded-xl border-none bg-white pl-10 text-sm text-[#2d2a26] placeholder:text-[#a39e98] focus-visible:ring-1 focus-visible:ring-[#c9a55c] dark:bg-[#252320] dark:text-[#f5f3ee]"
          />
        </div>
        {needsCurationCount > 0 && (
          <Button
            onClick={() => setIsApproveAllConfirmOpen(true)}
            disabled={isApprovingAll}
            className="h-11 rounded-xl bg-[#5a7a5a] text-sm font-medium text-white hover:bg-[#4a6a4a] disabled:opacity-50"
          >
            {isApprovingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Approve All ({needsCurationCount})
          </Button>
        )}
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="h-11 rounded-xl bg-[#2d2a26] text-sm font-medium text-[#f5f3ee] hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Story
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-[#c9a55c]/10 px-5 py-4 text-sm text-[#8b6c2e] dark:bg-[#c9a55c]/20 dark:text-[#d4b876]">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Stories list */}
      {isLoading && stories.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
          <RefreshCw className="h-6 w-6 animate-spin text-[#a39e98]" />
          <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">
            Loading stories...
          </p>
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f3ee] dark:bg-[#2d2a26]">
            <ImageIcon className="h-8 w-8 text-[#a39e98]" />
          </div>
          <p className="mt-4 text-sm font-medium text-[#6b6560] dark:text-[#a39e98]">
            {stories.length === 0 ? "No stories found" : "No stories match this filter"}
          </p>
        </div>
      ) : (
        <StoryGrid
          stories={filteredStories}
          onEdit={setEditingStory}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          selectionMode={selectedIds.size > 0}
        />
      )}

      {/* Pagination controls — only shown when there are multiple pages */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            className="h-10 rounded-xl px-4 text-sm font-medium text-[#6b6560] hover:bg-white hover:text-[#2d2a26] disabled:opacity-40 dark:text-[#a39e98] dark:hover:bg-[#252320] dark:hover:text-[#f5f3ee]"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-[#6b6560] dark:text-[#a39e98]">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            className="h-10 rounded-xl px-4 text-sm font-medium text-[#6b6560] hover:bg-white hover:text-[#2d2a26] disabled:opacity-40 dark:text-[#a39e98] dark:hover:bg-[#252320] dark:hover:text-[#f5f3ee]"
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <StoryEditorDialog
        story={editingStory}
        onClose={() => setEditingStory(null)}
        onUpdate={handleStoryUpdate}
      />

      <CreateStoryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={handleStoryCreated}
      />

      {/* Approve All Confirmation Dialog */}
      {isApproveAllConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-[#252320]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#5a7a5a]/10">
              <CheckCircle2 className="h-6 w-6 text-[#5a7a5a]" />
            </div>
            <h2 className="text-lg font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
              Approve All Stories
            </h2>
            <p className="mt-2 text-sm text-[#6b6560] dark:text-[#a39e98]">
              This will approve {needsCurationCount} pending{" "}
              {needsCurationCount === 1 ? "story" : "stories"}. This action can be
              reversed by marking stories as pending individually.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => setIsApproveAllConfirmOpen(false)}
                disabled={isApprovingAll}
                variant="ghost"
                className="flex-1 h-11 rounded-xl text-sm font-medium text-[#6b6560] hover:bg-[#f5f3ee] dark:text-[#a39e98] dark:hover:bg-[#2d2a26]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApproveAll}
                disabled={isApprovingAll}
                className="flex-1 h-11 rounded-xl bg-[#5a7a5a] text-sm font-medium text-white hover:bg-[#4a6a4a] disabled:opacity-50"
              >
                {isApprovingAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {isApprovingAll ? "Approving..." : "Approve All"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selection Toolbar */}
      <SelectionToolbar
        selectedCount={selectedIds.size}
        onMarkApproved={handleBulkMarkApproved}
        onMarkPending={handleBulkMarkPending}
        onDelete={handleBulkDelete}
        onClearSelection={handleClearSelection}
        isLoading={isBulkUpdating}
      />
    </>
  );
}
