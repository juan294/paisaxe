"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import type { MarketingPlatform } from "@/types/marketing";
import { PLATFORM_BADGES, PLATFORM_NAMES } from "./constants";

export function CreateDraftDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [platform, setPlatform] = useState<MarketingPlatform>("x");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const maxLength = platform === "x" ? 280 : platform === "instagram" ? 2200 : 500;

  const handleSave = async () => {
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/marketing/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, content: content.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create draft");
      }

      setContent("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md border-[#e5e3de] bg-white dark:border-[#3d3a36] dark:bg-[#252320]">
        <DialogHeader>
          <DialogTitle className="text-[#2d2a26] dark:text-[#f5f3ee]">
            Create Draft
          </DialogTitle>
          <DialogDescription className="font-mono text-xs text-[#6b6560]">
            Create a new content draft for manual posting
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Platform selector */}
          <div>
            <label className="mb-2 block font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Platform
            </label>
            <div className="flex gap-2">
              {(["x", "instagram", "pinterest"] as MarketingPlatform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center border font-mono text-xs font-medium transition-colors",
                    platform === p
                      ? "border-[#2d2a26] text-[#2d2a26] dark:border-[#f5f3ee] dark:text-[#f5f3ee]"
                      : "border-[#e5e3de] text-[#a39e98] hover:border-[#a39e98] dark:border-[#4d4944]"
                  )}
                >
                  {PLATFORM_BADGES[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="mb-2 flex items-center justify-between font-mono text-xs uppercase tracking-widest text-[#a39e98]">
              Content
              <span className={cn(
                "normal-case",
                content.length > maxLength ? "text-red-500" : ""
              )}>
                {content.length}/{maxLength}
              </span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write your ${PLATFORM_NAMES[platform]} post...`}
              rows={5}
              className="w-full resize-none border border-[#e5e3de] bg-transparent px-3 py-2 text-sm text-[#2d2a26] placeholder-[#a39e98] outline-none transition-colors focus:border-[#a39e98] dark:border-[#4d4944] dark:text-[#f5f3ee]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 font-mono text-xs text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-[#e5e3de] pt-4 dark:border-[#3d3a36]">
            <Button
              variant="ghost"
              onClick={onClose}
              className="flex-1 font-mono text-xs uppercase tracking-widest text-[#a39e98] hover:text-[#2d2a26] dark:hover:text-[#f5f3ee]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || content.length > maxLength}
              className="flex-1 bg-[#2d2a26] font-mono text-xs uppercase tracking-widest text-white hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Draft"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
