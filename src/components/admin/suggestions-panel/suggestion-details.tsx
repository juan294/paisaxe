import { cn } from "@/lib/utils";
import { MessageSquare, AtSign, Clock, XCircle, ArrowRight, Trash2 } from "lucide-react";
import type { AdminStorySuggestion, SuggestionStatus } from "@/types/suggestions";

interface SuggestionDetailsProps {
  suggestion: AdminStorySuggestion;
  notes: string;
  isUpdating: boolean;
  onNotesChange: (value: string) => void;
  onSaveNotes: () => void;
  onStatusChange: (status: SuggestionStatus) => void;
  onConvertToStory: () => void;
  onDelete: () => void;
}

export function SuggestionDetails({ suggestion, notes, isUpdating, onNotesChange, onSaveNotes, onStatusChange, onConvertToStory, onDelete }: SuggestionDetailsProps) {
  return (
  <div className="mt-5 border-t border-admin-paper pt-5 dark:border-admin-depth">
    {/* Full Comment */}
    {suggestion.comment && (
      <div className="mb-4">
        <label className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-widest text-admin-subtle">
          <MessageSquare className="h-3 w-3" />
          Comment
        </label>
        <p className="text-sm text-admin-muted dark:text-admin-subtle">
          {suggestion.comment}
        </p>
      </div>
    )}

    {/* Attribution */}
    {suggestion.attribution && (
      <div className="mb-4">
        <label className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-widest text-admin-subtle">
          <AtSign className="h-3 w-3" />
          Credit As
        </label>
        <p className="text-sm text-admin-muted dark:text-admin-subtle">
          {suggestion.attribution}
        </p>
      </div>
    )}

    {/* Admin Notes */}
    <div className="mb-4">
      <label htmlFor={`admin-notes-${suggestion.id}`} className="mb-1 block text-xs font-medium uppercase tracking-widest text-admin-subtle">
        Admin Notes
      </label>
      <textarea
        id={`admin-notes-${suggestion.id}`}
        value={notes}
        onChange={(e) =>
          onNotesChange(e.target.value)
        }
        placeholder="Add internal notes..."
        rows={3}
        className="w-full rounded-lg border border-admin-line bg-admin-paper px-3 py-2 text-sm text-admin-ink placeholder:text-admin-subtle focus-visible:border-admin-subtle focus-visible:outline-none dark:border-admin-secondary dark:bg-admin-depth dark:text-admin-paper"
      />
      <button
        onClick={() => onSaveNotes()}
        disabled={isUpdating}
        className="mt-2 font-mono text-xs uppercase tracking-widest text-admin-subtle transition-colors hover:text-admin-ink disabled:opacity-50 dark:hover:text-admin-paper"
      >
        {isUpdating ? "Saving..." : "Save Notes"}
      </button>
    </div>

    {/* Actions */}
    <div className="flex flex-wrap items-center gap-2">
      {suggestion.status !== "reviewed" && (
        <button
          onClick={() => onStatusChange("reviewed")}
          disabled={isUpdating}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            "bg-blue-50 text-blue-700 hover:bg-blue-100",
            "dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30",
            "disabled:opacity-50"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          Mark Reviewed
        </button>
      )}

      {suggestion.status !== "rejected" && (
        <button
          onClick={() => onStatusChange("rejected")}
          disabled={isUpdating}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            "bg-admin-paper text-admin-muted hover:bg-admin-line",
            "dark:bg-admin-depth dark:text-admin-subtle dark:hover:bg-admin-secondary",
            "disabled:opacity-50"
          )}
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </button>
      )}

      {suggestion.status !== "converted" && (
        <button
          onClick={() => onConvertToStory()}
          disabled={isUpdating}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
            "dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30",
            "disabled:opacity-50"
          )}
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Convert to Story
        </button>
      )}

      <button
        onClick={() => onDelete()}
        disabled={isUpdating}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
          "text-red-600 hover:bg-red-50",
          "dark:text-red-400 dark:hover:bg-red-900/20",
          "disabled:opacity-50"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </button>
    </div>
  </div>
  );
}
