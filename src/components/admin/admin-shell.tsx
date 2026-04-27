"use client";

/**
 * AdminShell
 *
 * Handles auth gating, tab state, and routing between admin tab panels.
 * Extracted from src/app/admin/page.tsx (AR-M2).
 *
 * FE-M3: Tab panels are conditionally rendered — unmounted when inactive.
 * This prevents idle panels from polling/fetching and keeps the React tree clean.
 * The analytics cache context (useAnalyticsData) handles data persistence across
 * remounts, so users don't pay a reload cost when revisiting a tab.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/use-auth";
import { useAdminRole } from "@/hooks/use-admin-role";
import { StoryGrid } from "@/components/admin/story-grid";
import { AdminTabs, TABS, type AdminTab } from "@/components/admin/admin-tabs";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  fetchStories,
  bulkUpdateStoryStatus,
  bulkDeleteStories,
  approveAllPendingStories,
} from "@/lib/admin-api";
import { hasMissingTranslations } from "@/lib/admin-formatters";
import {
  RefreshCw,
  LogOut,
  AlertCircle,
  ShieldX,
  Loader2,
  ImageIcon,
  CheckCircle2,
  Clock,
  Layers,
  ArrowUpRight,
  Search,
  Plus,
  Languages,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import type { AdminStory, CurationStatus, CreateStoryResponse } from "@/types/admin";
import { cn } from "@/lib/utils";

// Lazy-load tab panel components to reduce initial bundle size
function TabPanelFallback() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
      <Loader2 className="h-6 w-6 animate-spin text-[#a39e98]" />
      <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">Loading...</p>
    </div>
  );
}

const FeatureTogglesPanel = dynamic(
  () =>
    import("@/components/admin/feature-toggles-panel").then((m) => ({
      default: m.FeatureTogglesPanel,
    })),
  { ssr: false, loading: TabPanelFallback }
);

const AnalyticsDashboard = dynamic(
  () =>
    import("@/components/admin/analytics-dashboard").then((m) => ({
      default: m.AnalyticsDashboard,
    })),
  { ssr: false, loading: TabPanelFallback }
);

const MarketingDashboard = dynamic(
  () =>
    import("@/components/admin/marketing-dashboard").then((m) => ({
      default: m.MarketingDashboard,
    })),
  { ssr: false, loading: TabPanelFallback }
);

const SuggestionsPanel = dynamic(
  () =>
    import("@/components/admin/suggestions-panel").then((m) => ({
      default: m.SuggestionsPanel,
    })),
  { ssr: false, loading: TabPanelFallback }
);

const AgentsDashboard = dynamic(
  () =>
    import("@/components/admin/agents-dashboard").then((m) => ({
      default: m.AgentsDashboard,
    })),
  { ssr: false, loading: TabPanelFallback }
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

export function AdminShell() {
  const {
    user,
    isLoading: isAuthLoading,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const { isAdmin, isLoading: isRoleLoading } = useAdminRole();
  const router = useRouter();
  const searchParams = useSearchParams();

  // FE-H5: derive activeTab from URL — single source of truth, no ping-pong
  const activeTab = (searchParams.get("tab") ?? "analytics") as AdminTab;

  const [allStories, setAllStories] = useState<AdminStory[]>([]);
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

  const handleTabChange = useCallback(
    (tab: AdminTab) => {
      router.push(`?tab=${tab}`, { scroll: false });
    },
    [router]
  );

  // Always fetch ALL stories — filter client-side for display
  const loadStories = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const result = await fetchStories(undefined);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setAllStories(result.data);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin && activeTab === "stories") {
      loadStories();
    }
  }, [isAdmin, loadStories, activeTab]);

  // Keyboard shortcuts: Cmd+1 through Cmd+N to switch tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;

      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= TABS.length) {
        e.preventDefault();
        const tab = TABS[keyNum - 1];
        if (tab) {
          handleTabChange(tab.value);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTabChange]);

  // Filter stories client-side for display
  const filteredStories = allStories.filter((story) => {
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

  const handleLogout = async () => {
    setAllStories([]);
    setFilter("all");
    await signOut();
  };

  const handleStoryUpdate = (storyId: string, updates: Partial<AdminStory>) => {
    setAllStories((prev) =>
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

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkMarkApproved = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);

    const result = await bulkUpdateStoryStatus(Array.from(selectedIds), "approved");

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setAllStories((prev) =>
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
      setAllStories((prev) =>
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
    loadStories();
  };

  const handleApproveAll = async () => {
    setIsApprovingAll(true);
    setError("");

    const result = await approveAllPendingStories();

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setAllStories((prev) =>
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
      setAllStories((prev) => prev.filter((story) => !selectedIds.has(story.id)));
      setSelectedIds(new Set());
    }

    setIsBulkUpdating(false);
  };

  // ── Auth gating ─────────────────────────────────────────────────────────────

  if (isAuthLoading || isRoleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3ee] dark:bg-[#1a1917]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#2d2a26] dark:bg-[#f5f3ee] p-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#f5f3ee] dark:text-[#2d2a26]" />
          </div>
          <p className="text-sm font-medium text-[#6b6560] dark:text-[#a39e98]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3ee] dark:bg-[#1a1917] p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-[#252320]">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2d2a26] p-3 dark:bg-[#f5f3ee]">
              <Logo className="text-[#f5f3ee] dark:text-[#2d2a26]" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
              Paisaxe Admin
            </h1>
            <p className="mt-2 text-sm text-[#6b6560] dark:text-[#a39e98]">
              Sign in to access the admin panel
            </p>
            <Button
              onClick={() => signInWithGoogle("/admin")}
              className="mt-6 h-12 w-full rounded-2xl bg-[#2d2a26] text-sm font-medium text-[#f5f3ee] transition-all hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
            >
              Sign in with Google
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <p className="mt-4 text-center text-xs text-[#a39e98]">Protected area</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3ee] dark:bg-[#1a1917] p-4">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl bg-white p-8 shadow-sm dark:bg-[#252320]">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c9a55c]">
              <ShieldX className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
              Access Denied
            </h1>
            <p className="mt-2 text-sm text-[#6b6560] dark:text-[#a39e98]">
              Your account does not have admin privileges.
            </p>
            <p className="mt-3 text-xs text-[#a39e98]">Signed in as {user.email}</p>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="mt-6 h-12 w-full rounded-2xl text-sm font-medium text-[#6b6560] hover:bg-[#f5f3ee] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:bg-[#2d2a26] dark:hover:text-[#f5f3ee]"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin panel ──────────────────────────────────────────────────────────────

  const totalCount = allStories.length;
  const needsCurationCount = allStories.filter(
    (s) => s.curationStatus === "needs_curation"
  ).length;
  const approvedCount = allStories.filter(
    (s) => s.curationStatus === "approved"
  ).length;
  const missingTranslationsCount = allStories.filter(hasMissingTranslations).length;

  return (
    <div className="min-h-screen bg-[#f5f3ee] dark:bg-[#1a1917]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f5f3ee]/80 backdrop-blur-xl dark:bg-[#1a1917]/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2d2a26] p-2 dark:bg-[#f5f3ee]">
              <Logo className="text-[#f5f3ee] dark:text-[#2d2a26]" />
            </div>
            <span className="text-sm font-semibold text-[#2d2a26] dark:text-[#f5f3ee]">
              Paisaxe
            </span>
          </div>

          {/* Center tabs */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <AdminTabs activeTab={activeTab} onTabChange={handleTabChange} />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {activeTab === "stories" && (
              <button
                onClick={loadStories}
                disabled={isLoading}
                aria-label="Refresh stories"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                  "text-[#6b6560] hover:bg-white hover:text-[#2d2a26]",
                  "dark:text-[#a39e98] dark:hover:bg-[#252320] dark:hover:text-[#f5f3ee]",
                  "disabled:opacity-50"
                )}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </button>
            )}

            <ThemeToggle />

            <button
              onClick={handleLogout}
              aria-label="Logout"
              className={cn(
                "flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
                "text-[#6b6560] hover:bg-white hover:text-[#2d2a26]",
                "dark:text-[#a39e98] dark:hover:bg-[#252320] dark:hover:text-[#f5f3ee]"
              )}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome section — only on stories tab */}
        {activeTab === "stories" && (
          <>
            <div className="mb-8">
              <p className="font-mono text-xs uppercase tracking-widest text-[#6b6560] dark:text-[#a39e98]">
                Admin / Stories
              </p>
              <h1 className="mt-2 text-4xl font-extralight tracking-tight text-[#2d2a26] dark:text-[#f5f3ee]">
                Content Dashboard
              </h1>
            </div>

            {/* Stat Cards — clickable as filters */}
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
                value={totalCount}
                label="Total"
                variant="default"
                isActive={filter === "all"}
                onClick={() => setFilter("all")}
                ariaLabel="Filter: show all stories"
              />
            </div>

            {/* Search input and Create button */}
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
          </>
        )}

        {/* Error Message */}
        {error && activeTab === "stories" && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-[#c9a55c]/10 px-5 py-4 text-sm text-[#8b6c2e] dark:bg-[#c9a55c]/20 dark:text-[#d4b876]">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Tab panels — conditionally rendered (FE-M3: unmount on hide) */}

        {/* Stories: conditional render with dependent state inline */}
        {activeTab === "stories" && (
          <>
            {isLoading && allStories.length === 0 ? (
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
                  {allStories.length === 0
                    ? "No stories found"
                    : "No stories match this filter"}
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
          </>
        )}

        {/* Lazy-loaded tab panels: unmounted when not active (FE-M3) */}
        {activeTab === "features" && <FeatureTogglesPanel />}
        {activeTab === "analytics" && <AnalyticsDashboard />}
        {activeTab === "marketing" && <MarketingDashboard />}
        {activeTab === "suggestions" && <SuggestionsPanel />}
        {activeTab === "agents" && <AgentsDashboard />}
      </main>

      {/* Story Editor Dialog */}
      <StoryEditorDialog
        story={editingStory}
        onClose={() => setEditingStory(null)}
        onUpdate={handleStoryUpdate}
      />

      {/* Create Story Dialog */}
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
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  variant: "default" | "warning" | "success" | "purple";
  isActive?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}

function StatCard({
  icon,
  value,
  label,
  variant,
  isActive,
  onClick,
  ariaLabel,
}: StatCardProps) {
  const variants = {
    default: {
      bg: "bg-white dark:bg-[#252320]",
      activeBg: "bg-[#2d2a26] dark:bg-[#f5f3ee]",
      icon: "text-[#6b6560] dark:text-[#a39e98]",
      activeIcon: "text-[#a39e98] dark:text-[#6b6560]",
      text: "text-[#2d2a26] dark:text-[#f5f3ee]",
      activeText: "text-[#f5f3ee] dark:text-[#2d2a26]",
      subtext: "text-[#6b6560] dark:text-[#a39e98]",
      activeSubtext: "text-[#a39e98] dark:text-[#6b6560]",
    },
    warning: {
      bg: "bg-white dark:bg-[#252320]",
      activeBg: "bg-[#8b7355] dark:bg-[#8b7355]",
      icon: "text-[#c9a55c]",
      activeIcon: "text-[#c9a55c]",
      text: "text-[#2d2a26] dark:text-[#f5f3ee]",
      activeText: "text-[#f5f3ee]",
      subtext: "text-[#6b6560] dark:text-[#a39e98]",
      activeSubtext: "text-[#d4c4a8]",
    },
    success: {
      bg: "bg-white dark:bg-[#252320]",
      activeBg: "bg-[#5a7a5a] dark:bg-[#5a7a5a]",
      icon: "text-[#7a9e7a]",
      activeIcon: "text-[#a8c9a8]",
      text: "text-[#2d2a26] dark:text-[#f5f3ee]",
      activeText: "text-[#f5f3ee]",
      subtext: "text-[#6b6560] dark:text-[#a39e98]",
      activeSubtext: "text-[#c4d9c4]",
    },
    purple: {
      bg: "bg-white dark:bg-[#252320]",
      activeBg: "bg-[#6b5a8a] dark:bg-[#6b5a8a]",
      icon: "text-[#9b7ac9]",
      activeIcon: "text-[#c9b7e8]",
      text: "text-[#2d2a26] dark:text-[#f5f3ee]",
      activeText: "text-[#f5f3ee]",
      subtext: "text-[#6b6560] dark:text-[#a39e98]",
      activeSubtext: "text-[#d4c9e8]",
    },
  };

  const v = variants[variant];

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "rounded-2xl p-5 text-left transition-all",
        isActive ? v.activeBg : v.bg,
        !isActive && "hover:scale-[1.02] hover:shadow-md"
      )}
    >
      <div className={cn("mb-4", isActive ? v.activeIcon : v.icon)}>{icon}</div>
      <p
        className={cn(
          "text-4xl font-extralight tabular-nums tracking-tighter",
          isActive ? v.activeText : v.text
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-[10px] uppercase tracking-widest",
          isActive ? v.activeSubtext : v.subtext
        )}
      >
        {label}
      </p>
    </button>
  );
}
