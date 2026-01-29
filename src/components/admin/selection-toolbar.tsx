"use client";

import { CheckCircle2, Clock, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectionToolbarProps {
  selectedCount: number;
  onMarkApproved: () => void;
  onMarkPending: () => void;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export function SelectionToolbar({
  selectedCount,
  onMarkApproved,
  onMarkPending,
  onClearSelection,
  isLoading = false,
}: SelectionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 rounded-2xl bg-[#2d2a26] px-4 py-3 shadow-2xl dark:bg-[#f5f3ee]">
        {/* Selection count */}
        <div className="flex items-center gap-2 border-r border-white/20 pr-4 dark:border-[#2d2a26]/20">
          <span className="text-sm font-medium text-white dark:text-[#2d2a26]">
            {selectedCount} selected
          </span>
          <button
            onClick={onClearSelection}
            disabled={isLoading}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white dark:text-[#2d2a26]/60 dark:hover:bg-[#2d2a26]/10 dark:hover:text-[#2d2a26]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onMarkApproved}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
              "bg-[#5a7a5a] text-white hover:bg-[#4a6a4a]",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Mark Approved
          </button>

          <button
            onClick={onMarkPending}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
              "bg-[#c9a55c] text-white hover:bg-[#b89545]",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            Mark Pending
          </button>
        </div>
      </div>
    </div>
  );
}
