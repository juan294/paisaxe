"use client";

import { X } from "lucide-react";
import { renderMarkdown } from "./markdown";
import { relativeTime } from "./constants";

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
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl dark:bg-[#252320]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f5f3ee] px-6 py-4 dark:border-[#3d3a36]">
          <div>
            <h2 className="text-lg font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
              Subscription Optimizer Report
            </h2>
            {analyzedAt && (
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-[#a39e98] dark:text-[#6b6560]">
                Last analyzed {relativeTime(analyzedAt)}
              </p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1.5 text-[#a39e98] transition-colors hover:bg-[#f5f3ee] hover:text-[#6b6560] dark:hover:bg-[#3d3a36]"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5">
          {reportMarkdown ? (
            <div
              className="prose-sm text-xs leading-relaxed text-[#6b6560] dark:text-[#a39e98]"
              dangerouslySetInnerHTML={{
                __html: renderMarkdown(reportMarkdown),
              }}
            />
          ) : (
            <p className="text-sm text-[#a39e98]">
              No report available yet. Run the optimizer to generate a report.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
