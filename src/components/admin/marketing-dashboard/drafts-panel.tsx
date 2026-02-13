"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Copy, Check, Trash2, Plus } from "lucide-react";
import type { MarketingPost } from "@/types/marketing";
import { csrfHeaders } from "@/lib/csrf-client";
import { PLATFORM_BADGES } from "./constants";
import { CreateDraftDialog } from "./create-draft-dialog";

export function DraftsPanel({ onDraftPosted }: { onDraftPosted: () => void }) {
  const [drafts, setDrafts] = useState<MarketingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/marketing/posts?status=draft");
      const result = await response.json();
      if (response.ok) {
        setDrafts(result.data || []);
      }
    } catch (error) {
      console.error("Failed to load drafts:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleCopy = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleMarkAsPosted = async (postId: string) => {
    try {
      const response = await fetch(
        `/api/admin/marketing/posts?id=${postId}&action=mark-posted`,
        { method: "PATCH", headers: csrfHeaders() }
      );
      if (response.ok) {
        loadDrafts();
        onDraftPosted();
      }
    } catch (error) {
      console.error("Failed to mark as posted:", error);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this draft?")) return;
    try {
      const response = await fetch(`/api/admin/marketing/posts?id=${postId}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });
      if (response.ok) {
        loadDrafts();
      }
    } catch (error) {
      console.error("Failed to delete draft:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-[#a39e98]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6b6560]">
          {drafts.length === 0
            ? "No drafts yet. Chat with the marketing agents to create content."
            : `${drafts.length} draft${drafts.length === 1 ? "" : "s"} ready to post`}
        </p>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-[#a39e98] transition-colors hover:text-[#2d2a26] dark:hover:text-[#f5f3ee]"
        >
          <Plus className="h-3 w-3" />
          New Draft
        </button>
      </div>

      {/* Drafts list */}
      {drafts.length > 0 && (
        <div className="divide-y divide-[#f5f3ee] border border-[#e5e3de] dark:divide-[#3d3a36] dark:border-[#3d3a36]">
          {drafts.map((draft) => (
            <div key={draft.id} className="p-4">
              <div className="flex items-start gap-3">
                {/* Platform badge */}
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-[#e5e3de] font-mono text-xs font-medium text-[#6b6560] dark:border-[#4d4944] dark:text-[#a39e98]">
                  {PLATFORM_BADGES[draft.platform]}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm text-[#4d4944] dark:text-[#a39e98]">
                    {draft.content}
                  </p>
                  {draft.hashtags.length > 0 && (
                    <p className="mt-2 text-xs text-[#a39e98]">
                      {draft.hashtags.join(" ")}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-[10px] text-[#a39e98]">
                    Created {new Date(draft.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleCopy(draft.content, draft.id)}
                    className="flex h-8 w-8 items-center justify-center text-[#a39e98] transition-colors hover:text-[#6b6560]"
                    title="Copy content"
                  >
                    {copiedId === draft.id ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleMarkAsPosted(draft.id)}
                    className="flex h-8 items-center gap-1 rounded px-2 font-mono text-[10px] uppercase tracking-widest text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    title="Mark as posted"
                  >
                    Posted
                  </button>
                  <button
                    onClick={() => handleDelete(draft.id)}
                    className="flex h-8 w-8 items-center justify-center text-[#a39e98] transition-colors hover:text-red-500"
                    title="Delete draft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Draft Dialog */}
      <CreateDraftDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => {
          setShowCreateDialog(false);
          loadDrafts();
        }}
      />
    </div>
  );
}
