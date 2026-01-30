"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAdminRole } from "@/hooks/use-admin-role";
import { StoryGrid } from "@/components/admin/story-grid";
import { ImageEditorDialog } from "@/components/admin/image-editor-dialog";
import { SelectionToolbar } from "@/components/admin/selection-toolbar";
import { AdminTabs, type AdminTab } from "@/components/admin/admin-tabs";
import { FeatureTogglesPanel } from "@/components/admin/feature-toggles-panel";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { MarketingDashboard } from "@/components/admin/marketing-dashboard";
import { AdminThemeProvider } from "@/components/admin/theme-provider";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Button } from "@/components/ui/button";
import { fetchStories, bulkUpdateStoryStatus } from "@/lib/admin-api";
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
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Input } from "@/components/ui/input";
import type { AdminStory, CurationStatus } from "@/types/admin";
import { cn } from "@/lib/utils";

type FilterType = "all" | CurationStatus;

function AdminPageContent() {
  const { user, isLoading: isAuthLoading, signInWithGoogle, signOut } = useAuth();
  const { isAdmin, isLoading: isRoleLoading } = useAdminRole();

  const [allStories, setAllStories] = useState<AdminStory[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingStory, setEditingStory] = useState<AdminStory | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("stories");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Always fetch ALL stories - filter client-side for display
  const loadStories = useCallback(async () => {
    setIsLoading(true);
    setError("");

    // Always fetch all stories (no filter param)
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

  // Filter stories client-side for display
  const filteredStories = allStories.filter((story) => {
    // Status filter
    if (filter !== "all" && story.curationStatus !== filter) return false;

    // Search filter
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
      prev.map((story) =>
        story.id === storyId ? { ...story, ...updates } : story
      )
    );
    // Also update editingStory if it's the same story being edited
    // This ensures the dialog reflects the latest state (e.g., curation badge)
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
      // Update local state
      setAllStories((prev) =>
        prev.map((story) =>
          selectedIds.has(story.id)
            ? { ...story, curationStatus: "approved" }
            : story
        )
      );
      setSelectedIds(new Set());
    }

    setIsBulkUpdating(false);
  };

  const handleBulkMarkPending = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);

    const result = await bulkUpdateStoryStatus(Array.from(selectedIds), "needs_curation");

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      // Update local state
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

  // Loading state
  if (isAuthLoading || isRoleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3ee] dark:bg-[#1a1917]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#2d2a26] dark:bg-[#f5f3ee] p-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#f5f3ee] dark:text-[#2d2a26]" />
          </div>
          <p className="text-sm font-medium text-[#6b6560] dark:text-[#a39e98]">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated: show sign-in
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
          <p className="mt-4 text-center text-xs text-[#a39e98]">
            Protected area
          </p>
        </div>
      </div>
    );
  }

  // Authenticated but not admin: access denied
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
            <p className="mt-3 text-xs text-[#a39e98]">
              Signed in as {user.email}
            </p>
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

  // Admin panel - counts always from ALL stories (not filtered)
  const totalCount = allStories.length;
  const needsCurationCount = allStories.filter(
    (s) => s.curationStatus === "needs_curation"
  ).length;
  const approvedCount = allStories.filter(
    (s) => s.curationStatus === "approved"
  ).length;
  const withImagesCount = allStories.filter((s) => s.image).length;


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
            <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {activeTab === "stories" && (
              <button
                onClick={loadStories}
                disabled={isLoading}
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
        {/* Welcome section - Only on stories tab */}
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

            {/* Stat Cards - clickable as filters */}
            <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                icon={<Layers className="h-5 w-5" />}
                value={totalCount}
                label="Total"
                variant="default"
                isActive={filter === "all"}
                onClick={() => setFilter("all")}
              />
              <StatCard
                icon={<Clock className="h-5 w-5" />}
                value={needsCurationCount}
                label="Pending"
                variant="warning"
                isActive={filter === "needs_curation"}
                onClick={() => setFilter("needs_curation")}
              />
              <StatCard
                icon={<CheckCircle2 className="h-5 w-5" />}
                value={approvedCount}
                label="Approved"
                variant="success"
                isActive={filter === "approved"}
                onClick={() => setFilter("approved")}
              />
              <StatCard
                icon={<ImageIcon className="h-5 w-5" />}
                value={withImagesCount}
                label="With Images"
                variant="default"
              />
            </div>

            {/* Search input */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a39e98]" />
                <Input
                  type="text"
                  placeholder="Search stories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 rounded-xl border-none bg-white pl-10 text-sm text-[#2d2a26] placeholder:text-[#a39e98] focus-visible:ring-1 focus-visible:ring-[#c9a55c] dark:bg-[#252320] dark:text-[#f5f3ee]"
                />
              </div>
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

        {/* Tab content */}
        {activeTab === "stories" && (
          <>
            {isLoading && allStories.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
                <RefreshCw className="h-6 w-6 animate-spin text-[#a39e98]" />
                <p className="mt-4 text-sm text-[#6b6560] dark:text-[#a39e98]">Loading stories...</p>
              </div>
            ) : filteredStories.length === 0 ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white dark:bg-[#252320]">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f3ee] dark:bg-[#2d2a26]">
                  <ImageIcon className="h-8 w-8 text-[#a39e98]" />
                </div>
                <p className="mt-4 text-sm font-medium text-[#6b6560] dark:text-[#a39e98]">
                  {allStories.length === 0 ? "No stories found" : "No stories match this filter"}
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

        {activeTab === "toggles" && (
          <FeatureTogglesPanel />
        )}

        {activeTab === "analytics" && (
          <AnalyticsDashboard />
        )}

        {activeTab === "marketing" && (
          <MarketingDashboard />
        )}
      </main>

      {/* Image Editor Dialog */}
      <ImageEditorDialog
        story={editingStory}
        onClose={() => setEditingStory(null)}
        onUpdate={handleStoryUpdate}
      />

      {/* Selection Toolbar */}
      <SelectionToolbar
        selectedCount={selectedIds.size}
        onMarkApproved={handleBulkMarkApproved}
        onMarkPending={handleBulkMarkPending}
        onClearSelection={handleClearSelection}
        isLoading={isBulkUpdating}
      />
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminThemeProvider>
      <AdminPageContent />
    </AdminThemeProvider>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  variant: "default" | "warning" | "success";
  isActive?: boolean;
  onClick?: () => void;
}

function StatCard({ icon, value, label, variant, isActive, onClick }: StatCardProps) {
  const isClickable = !!onClick;

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
  };

  const v = variants[variant];

  const content = (
    <>
      <div className={cn("mb-4", isActive ? v.activeIcon : v.icon)}>
        {icon}
      </div>
      <p className={cn(
        "text-4xl font-extralight tabular-nums tracking-tighter",
        isActive ? v.activeText : v.text
      )}>
        {value}
      </p>
      <p className={cn(
        "mt-2 font-mono text-[10px] uppercase tracking-widest",
        isActive ? v.activeSubtext : v.subtext
      )}>
        {label}
      </p>
    </>
  );

  if (isClickable) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "rounded-2xl p-5 text-left transition-all",
          isActive ? v.activeBg : v.bg,
          !isActive && "hover:scale-[1.02] hover:shadow-md"
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cn("rounded-2xl p-5", v.bg)}>
      {content}
    </div>
  );
}
