"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { StoryGrid } from "@/components/admin/story-grid";
import { ImageEditorDialog } from "@/components/admin/image-editor-dialog";
import { AdminTabs, type AdminTab } from "@/components/admin/admin-tabs";
import { FeatureTogglesPanel } from "@/components/admin/feature-toggles-panel";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { Button } from "@/components/ui/button";
import { fetchStories } from "@/lib/admin-api";
import {
  RefreshCw,
  LogOut,
  AlertCircle,
} from "lucide-react";
import type { AdminStory, CurationStatus } from "@/types/admin";
import { cn } from "@/lib/utils";

type FilterType = "all" | CurationStatus;

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [stories, setStories] = useState<AdminStory[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingStory, setEditingStory] = useState<AdminStory | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("stories");

  const loadStories = useCallback(async () => {
    if (!adminKey) return;

    setIsLoading(true);
    setError("");

    const filterParam = filter === "all" ? undefined : filter;
    const result = await fetchStories(adminKey, filterParam);

    if (result.error) {
      setError(result.error);
      if (result.error.includes("Invalid") || result.error.includes("Authorization")) {
        setAdminKey(null);
      }
    } else if (result.data) {
      setStories(result.data);
    }

    setIsLoading(false);
  }, [adminKey, filter]);

  useEffect(() => {
    if (adminKey && activeTab === "stories") {
      loadStories();
    }
  }, [adminKey, filter, loadStories, activeTab]);

  const handleLogin = (key: string) => {
    setAdminKey(key);
  };

  const handleLogout = () => {
    setAdminKey(null);
    setStories([]);
    setFilter("all");
  };

  const handleStoryUpdate = (storyId: string, updates: Partial<AdminStory>) => {
    setStories((prev) =>
      prev.map((story) =>
        story.id === storyId ? { ...story, ...updates } : story
      )
    );
  };

  if (!adminKey) {
    return <AdminLoginForm onLogin={handleLogin} />;
  }

  const needsCurationCount = stories.filter(
    (s) => s.curationStatus === "needs_curation"
  ).length;
  const approvedCount = stories.filter(
    (s) => s.curationStatus === "approved"
  ).length;
  const withImagesCount = stories.filter((s) => s.image).length;

  const filterOptions = [
    { value: "all" as FilterType, label: "All", count: stories.length },
    { value: "needs_curation" as FilterType, label: "Pending", count: needsCurationCount },
    { value: "approved" as FilterType, label: "Approved", count: approvedCount },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Paisaxe Admin
            </h1>
            <div className="hidden h-4 w-px bg-neutral-200 dark:bg-neutral-700 sm:block" />
            {/* Tab navigation */}
            <div className="hidden sm:block">
              <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Compact metrics - only shown on stories tab */}
            {activeTab === "stories" && (
              <>
                <div className="hidden items-center gap-4 text-xs md:flex">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                    <span className="text-neutral-500 dark:text-neutral-400">{stories.length} total</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span className="text-neutral-500 dark:text-neutral-400">{needsCurationCount} pending</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-neutral-500 dark:text-neutral-400">{approvedCount} approved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                    <span className="text-neutral-500 dark:text-neutral-400">{withImagesCount} with images</span>
                  </div>
                </div>
                <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
              </>
            )}

            {activeTab === "stories" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadStories}
                disabled={isLoading}
                className="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 gap-1.5 px-2 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile tabs + filters */}
        <div className="border-t border-neutral-100 dark:border-neutral-800 sm:hidden">
          <div className="flex gap-1 px-4 py-2">
            <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          {activeTab === "stories" && (
            <div className="flex gap-1 border-t border-neutral-100 px-4 py-2 dark:border-neutral-800">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    filter === option.value
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  )}
                >
                  {option.label} ({option.count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop story filters - only on stories tab */}
        {activeTab === "stories" && (
          <div className="hidden border-t border-neutral-100 dark:border-neutral-800 sm:block">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <nav className="flex items-center gap-1 py-2">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      filter === option.value
                        ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                    )}
                  >
                    {option.label}
                    <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                      {option.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Error Message */}
        {error && activeTab === "stories" && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Tab content */}
        {activeTab === "stories" && (
          <>
            {isLoading && stories.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-neutral-400" />
                <p className="mt-3 text-sm text-neutral-500">Loading...</p>
              </div>
            ) : stories.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center">
                <p className="text-sm text-neutral-500">No stories found</p>
              </div>
            ) : (
              <StoryGrid stories={stories} onEdit={setEditingStory} />
            )}
          </>
        )}

        {activeTab === "toggles" && (
          <FeatureTogglesPanel adminKey={adminKey} />
        )}

        {activeTab === "analytics" && (
          <AnalyticsDashboard adminKey={adminKey} />
        )}
      </main>

      {/* Image Editor Dialog */}
      <ImageEditorDialog
        story={editingStory}
        adminKey={adminKey}
        onClose={() => setEditingStory(null)}
        onUpdate={handleStoryUpdate}
      />
    </div>
  );
}
