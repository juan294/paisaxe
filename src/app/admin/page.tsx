"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { StoryGrid } from "@/components/admin/story-grid";
import { ImageEditorDialog } from "@/components/admin/image-editor-dialog";
import { Button } from "@/components/ui/button";
import { fetchStories } from "@/lib/admin-api";
import type { AdminStory, CurationStatus } from "@/types/admin";

type FilterType = "all" | CurationStatus;

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [stories, setStories] = useState<AdminStory[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingStory, setEditingStory] = useState<AdminStory | null>(null);

  const loadStories = useCallback(async () => {
    if (!adminKey) return;

    setIsLoading(true);
    setError("");

    const filterParam = filter === "all" ? undefined : filter;
    const result = await fetchStories(adminKey, filterParam);

    if (result.error) {
      setError(result.error);
      // If unauthorized, clear admin key to show login
      if (result.error.includes("Invalid") || result.error.includes("Authorization")) {
        setAdminKey(null);
      }
    } else if (result.data) {
      setStories(result.data);
    }

    setIsLoading(false);
  }, [adminKey, filter]);

  useEffect(() => {
    if (adminKey) {
      loadStories();
    }
  }, [adminKey, filter, loadStories]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <h1 className="text-xl font-bold">Paisaxe Admin</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        {/* Filter Tabs */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All ({stories.length})
            </Button>
            <Button
              variant={filter === "needs_curation" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("needs_curation")}
            >
              Needs Curation ({needsCurationCount})
            </Button>
            <Button
              variant={filter === "approved" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("approved")}
            >
              Approved ({approvedCount})
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={loadStories} disabled={isLoading}>
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Stories Grid */}
        {isLoading && stories.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <p className="text-muted-foreground">Loading stories...</p>
          </div>
        ) : (
          <StoryGrid stories={stories} onEdit={setEditingStory} />
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
