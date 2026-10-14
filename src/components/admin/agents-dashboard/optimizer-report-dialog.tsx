"use client";

import { X } from "lucide-react";
import { relativeTime } from "./constants";
import { SafeMarkdown } from "./safe-markdown";

interface OptimizerReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportMarkdown: string;
  analyzedAt: string | null;
}

export function OptimizerReportDialog({
  open,
  onOpenChange,
  reportMarkdown,
  analyzedAt,
}: OptimizerReportDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      {/* Dialog */}
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl dark:bg-admin-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-admin-paper px-6 py-4 dark:border-admin-depth">
          <div>
            <h2 className="text-lg font-medium text-admin-ink dark:text-admin-paper">
              Subscription Optimizer Report
            </h2>
            {analyzedAt && (
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-admin-subtle dark:text-admin-muted">
                Last analyzed {relativeTime(analyzedAt)}
              </p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1.5 text-admin-subtle transition-colors hover:bg-admin-paper hover:text-admin-muted dark:hover:bg-admin-depth"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5">
          {reportMarkdown ? (
            <div className="prose-sm text-xs leading-relaxed text-admin-muted dark:text-admin-subtle">
              <SafeMarkdown content={reportMarkdown} />
            </div>
          ) : (
            <p className="text-sm text-admin-subtle">
              No report available yet. Run the optimizer to generate a report.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
