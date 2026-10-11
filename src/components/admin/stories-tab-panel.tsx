"use client";

/**
 * StoriesTabPanel
 *
 * Extracted from AdminShell (FE-M2). Owns all stories tab state:
 * stat card filters, search, story CRUD, selection, and server-side
 * pagination (PE-M5). Page position is persisted in URL via ?storiesPage=N.
 */

import dynamic from "next/dynamic";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useStoriesTab } from "./stories-tab-panel/use-stories-tab";

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

export function StoriesTabPanel() {
  const { currentPage, stories, total, filter, setFilter, searchQuery, setSearchQuery, isLoading, error, editingStory, setEditingStory, selectedIds, isBulkUpdating, isCreateDialogOpen, setIsCreateDialogOpen, isApproveAllConfirmOpen, setIsApproveAllConfirmOpen, isApprovingAll, totalPages, goToPage, filteredStories, needsCurationCount, approvedCount, missingTranslationsCount, handleStoryUpdate, handleToggleSelect, handleClearSelection, handleBulkMarkApproved, handleBulkMarkPending, handleStoryCreated, handleApproveAll, handleBulkDelete } = useStoriesTab();


  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page heading */}
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-widest text-admin-muted dark:text-admin-subtle">
          Admin / Stories
        </p>
        <h1 className="mt-2 text-4xl font-extralight tracking-tight text-admin-ink dark:text-admin-paper">
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-subtle" />
          <Input
            type="text"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 rounded-xl border-none bg-white pl-10 text-sm text-admin-ink placeholder:text-admin-subtle focus-visible:ring-1 focus-visible:ring-admin-warning dark:bg-admin-panel dark:text-admin-paper"
          />
        </div>
        {needsCurationCount > 0 && (
          <Button
            onClick={() => setIsApproveAllConfirmOpen(true)}
            disabled={isApprovingAll}
            className="h-11 rounded-xl bg-admin-approve text-sm font-medium text-white hover:bg-admin-approve-hover disabled:opacity-50"
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
          className="h-11 rounded-xl bg-admin-ink text-sm font-medium text-admin-paper hover:bg-admin-depth dark:bg-admin-paper dark:text-admin-ink dark:hover:bg-admin-line"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Story
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-admin-warning/10 px-5 py-4 text-sm text-[#8b6c2e] dark:bg-admin-warning/20 dark:text-[#d4b876]">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Stories list */}
      {isLoading && stories.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-admin-panel">
          <RefreshCw className="h-6 w-6 animate-spin text-admin-subtle" />
          <p className="mt-4 text-sm text-admin-muted dark:text-admin-subtle">
            Loading stories...
          </p>
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-admin-panel">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-admin-paper dark:bg-admin-ink">
            <ImageIcon className="h-8 w-8 text-admin-subtle" />
          </div>
          <p className="mt-4 text-sm font-medium text-admin-muted dark:text-admin-subtle">
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
            className="h-10 rounded-xl px-4 text-sm font-medium text-admin-muted hover:bg-white hover:text-admin-ink disabled:opacity-40 dark:text-admin-subtle dark:hover:bg-admin-panel dark:hover:text-admin-paper"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-admin-muted dark:text-admin-subtle">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
            className="h-10 rounded-xl px-4 text-sm font-medium text-admin-muted hover:bg-white hover:text-admin-ink disabled:opacity-40 dark:text-admin-subtle dark:hover:bg-admin-panel dark:hover:text-admin-paper"
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
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-admin-panel"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-admin-approve/10">
              <CheckCircle2 className="h-6 w-6 text-admin-approve" />
            </div>
            <h2 className="text-lg font-semibold text-admin-ink dark:text-admin-paper">
              Approve All Stories
            </h2>
            <p className="mt-2 text-sm text-admin-muted dark:text-admin-subtle">
              This will approve {needsCurationCount} pending{" "}
              {needsCurationCount === 1 ? "story" : "stories"}. This action can be
              reversed by marking stories as pending individually.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => setIsApproveAllConfirmOpen(false)}
                disabled={isApprovingAll}
                variant="ghost"
                className="flex-1 h-11 rounded-xl text-sm font-medium text-admin-muted hover:bg-admin-paper dark:text-admin-subtle dark:hover:bg-admin-ink"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApproveAll}
                disabled={isApprovingAll}
                className="flex-1 h-11 rounded-xl bg-admin-approve text-sm font-medium text-white hover:bg-admin-approve-hover disabled:opacity-50"
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
