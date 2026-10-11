"use client";

import { cn } from "@/lib/utils";
import { CreateStoryDialog } from "./create-story-dialog";
import {
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  MapPin,
  User,
  Calendar,
  AtSign,
} from "lucide-react";
import type { SuggestionStatus } from "@/types/suggestions";
import { STATUS_LABELS, STATUS_COLORS, LOCATION_LABELS } from "./suggestions-panel/constants";
import { useSuggestions } from "./suggestions-panel/use-suggestions";
import { SuggestionDetails } from "./suggestions-panel/suggestion-details";

export function SuggestionsPanel() {
  const {
    suggestions,
    isLoading,
    error,
    filterStatus,
    setFilterStatus,
    expandedId,
    updatingId,
    adminNotes,
    setAdminNotes,
    convertingSuggestion,
    setConvertingSuggestion,
    loadSuggestions,
    handleStatusChange,
    handleSaveNotes,
    handleDelete,
    toggleExpanded,
    handleConvertToStory,
    handleStoryCreated,
    statusCounts,
    filteredSuggestions
  } = useSuggestions();

  if (isLoading && suggestions.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-admin-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-admin-line pb-6 dark:border-admin-depth">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-admin-subtle">Admin / Content</p>
          <h2 className="mt-2 text-4xl font-extralight tracking-tight text-admin-ink dark:text-admin-paper">
            Story Suggestions
          </h2>
        </div>
        <div className="flex items-center gap-6">
          <p className="font-mono text-xs uppercase tracking-widest text-admin-subtle">
            {suggestions.length} Total
          </p>
          <button
            onClick={loadSuggestions}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-admin-subtle transition-colors hover:text-admin-ink disabled:opacity-50 dark:hover:text-admin-paper"
          >
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-3 font-mono text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Status Filter Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setFilterStatus(null)}
          className={cn(
            "px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-colors",
            filterStatus === null
              ? "bg-admin-ink text-admin-paper dark:bg-admin-paper dark:text-admin-ink"
              : "text-admin-subtle hover:bg-admin-paper dark:hover:bg-admin-depth"
          )}
        >
          All ({suggestions.length})
        </button>
        {(["pending", "reviewed", "converted", "rejected"] as SuggestionStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              "px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-colors flex items-center gap-2",
              filterStatus === status
                ? "bg-admin-ink text-admin-paper dark:bg-admin-paper dark:text-admin-ink"
                : "text-admin-subtle hover:bg-admin-paper dark:hover:bg-admin-depth"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLORS[status].dot)} />
            {STATUS_LABELS[status]} ({statusCounts[status] || 0})
          </button>
        ))}
      </div>

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-white dark:bg-admin-ink">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-admin-paper dark:bg-admin-depth">
            <Lightbulb className="h-8 w-8 text-admin-subtle" />
          </div>
          <p className="mt-4 text-sm font-medium text-admin-muted">
            {filterStatus ? `No ${filterStatus} suggestions` : "No suggestions yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={cn(
                "rounded-2xl bg-white p-5 transition-all dark:bg-admin-ink",
                expandedId === suggestion.id && "ring-1 ring-admin-line dark:ring-admin-secondary"
              )}
            >
              {/* Main Row */}
              <div className="flex items-start gap-4">
                {/* Expand Button */}
                <button
                  onClick={() => toggleExpanded(suggestion.id)}
                  className="mt-1 flex h-6 w-6 items-center justify-center rounded text-admin-subtle transition-colors hover:bg-admin-paper hover:text-admin-muted dark:hover:bg-admin-depth"
                  aria-label={expandedId === suggestion.id ? "Collapse" : "Expand"}
                >
                  {expandedId === suggestion.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-admin-ink dark:text-admin-paper">
                        {suggestion.placeName}
                      </h3>
                      {suggestion.comment && (
                        <p className="mt-1 text-sm text-admin-muted line-clamp-1">
                          {suggestion.comment}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-admin-subtle">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {suggestion.userId ? (suggestion.userEmail || "Unknown user") : "Anonymous"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(suggestion.createdAt).toLocaleDateString()}
                        </span>
                        {suggestion.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {LOCATION_LABELS[suggestion.location] || suggestion.location}
                          </span>
                        )}
                        {suggestion.attribution && (
                          <span className="flex items-center gap-1">
                            <AtSign className="h-3 w-3" />
                            {suggestion.attribution}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                        STATUS_COLORS[suggestion.status].bg,
                        STATUS_COLORS[suggestion.status].text
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLORS[suggestion.status].dot)} />
                      {STATUS_LABELS[suggestion.status]}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === suggestion.id && (
                <SuggestionDetails
                  suggestion={suggestion}
                  notes={adminNotes[suggestion.id] || ""}
                  isUpdating={updatingId === suggestion.id}
                  onNotesChange={(value) => setAdminNotes((prev) => ({ ...prev, [suggestion.id]: value }))}
                  onSaveNotes={() => handleSaveNotes(suggestion.id)}
                  onStatusChange={(status) => handleStatusChange(suggestion.id, status)}
                  onConvertToStory={() => handleConvertToStory(suggestion)}
                  onDelete={() => handleDelete(suggestion.id)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <p className="font-mono text-xs uppercase tracking-widest text-admin-subtle">
        Suggestions from visitors
      </p>

      {/* Create Story Dialog for conversions */}
      <CreateStoryDialog
        open={!!convertingSuggestion}
        onOpenChange={(open) => !open && setConvertingSuggestion(null)}
        onCreated={handleStoryCreated}
        suggestion={convertingSuggestion}
      />
    </div>
  );
}
