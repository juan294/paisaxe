"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { fetchSuggestions, updateSuggestion, deleteSuggestion } from "@/lib/admin-api";
import {
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
  XCircle,
  ArrowRight,
  Clock,
  Lightbulb,
  MapPin,
  User,
  Calendar,
  MessageSquare,
} from "lucide-react";
import type { AdminStorySuggestion, SuggestionStatus } from "@/types/suggestions";

const STATUS_LABELS: Record<SuggestionStatus, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  converted: "Converted",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<SuggestionStatus, { bg: string; text: string; dot: string }> = {
  pending: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  reviewed: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  converted: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  rejected: {
    bg: "bg-stone-100 dark:bg-stone-800",
    text: "text-stone-500 dark:text-stone-400",
    dot: "bg-stone-400",
  },
};

const LOCATION_LABELS: Record<string, string> = {
  eastern: "Eastern Asturias",
  central: "Central Asturias",
  western: "Western Asturias",
};

export function SuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<AdminStorySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<SuggestionStatus | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError("");

    const result = await fetchSuggestions(filterStatus || undefined);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSuggestions(result.data);
      // Initialize admin notes from fetched data
      const notes: Record<string, string> = {};
      result.data.forEach((s) => {
        if (s.adminNotes) {
          notes[s.id] = s.adminNotes;
        }
      });
      setAdminNotes(notes);
    }
    setIsLoading(false);
  }, [filterStatus]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleStatusChange = async (id: string, newStatus: SuggestionStatus) => {
    setUpdatingId(id);
    const result = await updateSuggestion(id, { status: newStatus });

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
      );
    }
    setUpdatingId(null);
  };

  const handleSaveNotes = async (id: string) => {
    setUpdatingId(id);
    const result = await updateSuggestion(id, { adminNotes: adminNotes[id] || "" });

    if (result.error) {
      setError(result.error);
    }
    setUpdatingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this suggestion?")) {
      return;
    }

    setUpdatingId(id);
    const result = await deleteSuggestion(id);

    if (result.error) {
      setError(result.error);
    } else {
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    }
    setUpdatingId(null);
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Count suggestions by status (from all suggestions, not filtered)
  const statusCounts = suggestions.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    {} as Record<SuggestionStatus, number>
  );

  const filteredSuggestions = filterStatus
    ? suggestions.filter((s) => s.status === filterStatus)
    : suggestions;

  if (isLoading && suggestions.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-stone-300" />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {/* Header */}
      <header className="flex items-end justify-between border-b border-stone-200 pb-6 dark:border-stone-800">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">Admin / Content</p>
          <h1 className="mt-2 text-4xl font-extralight tracking-tight text-stone-900 dark:text-stone-100">
            Story Suggestions
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
            {suggestions.length} Total
          </p>
          <button
            onClick={loadSuggestions}
            disabled={isLoading}
            className="font-mono text-xs uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900 disabled:opacity-50 dark:hover:text-stone-100"
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
              ? "bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900"
              : "text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
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
                ? "bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900"
                : "text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_COLORS[status].dot)} />
            {STATUS_LABELS[status]} ({statusCounts[status] || 0})
          </button>
        ))}
      </div>

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-white dark:bg-stone-900">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 dark:bg-stone-800">
            <Lightbulb className="h-8 w-8 text-stone-400" />
          </div>
          <p className="mt-4 text-sm font-medium text-stone-500">
            {filterStatus ? `No ${filterStatus} suggestions` : "No suggestions yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={cn(
                "rounded-2xl bg-white p-5 transition-all dark:bg-stone-900",
                expandedId === suggestion.id && "ring-1 ring-stone-200 dark:ring-stone-700"
              )}
            >
              {/* Main Row */}
              <div className="flex items-start gap-4">
                {/* Expand Button */}
                <button
                  onClick={() => toggleExpanded(suggestion.id)}
                  className="mt-1 flex h-6 w-6 items-center justify-center rounded text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800"
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
                      <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">
                        {suggestion.placeName}
                      </h3>
                      {suggestion.comment && (
                        <p className="mt-1 text-sm text-stone-500 line-clamp-1">
                          {suggestion.comment}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-stone-400">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {suggestion.userEmail || "Unknown user"}
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
                <div className="mt-5 border-t border-stone-100 pt-5 dark:border-stone-800">
                  {/* Full Comment */}
                  {suggestion.comment && (
                    <div className="mb-4">
                      <label className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-widest text-stone-400">
                        <MessageSquare className="h-3 w-3" />
                        Comment
                      </label>
                      <p className="text-sm text-stone-600 dark:text-stone-300">
                        {suggestion.comment}
                      </p>
                    </div>
                  )}

                  {/* Admin Notes */}
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium uppercase tracking-widest text-stone-400">
                      Admin Notes
                    </label>
                    <textarea
                      value={adminNotes[suggestion.id] || ""}
                      onChange={(e) =>
                        setAdminNotes((prev) => ({ ...prev, [suggestion.id]: e.target.value }))
                      }
                      placeholder="Add internal notes..."
                      rows={3}
                      className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                    />
                    <button
                      onClick={() => handleSaveNotes(suggestion.id)}
                      disabled={updatingId === suggestion.id}
                      className="mt-2 font-mono text-xs uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900 disabled:opacity-50 dark:hover:text-stone-100"
                    >
                      {updatingId === suggestion.id ? "Saving..." : "Save Notes"}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {suggestion.status !== "reviewed" && (
                      <button
                        onClick={() => handleStatusChange(suggestion.id, "reviewed")}
                        disabled={updatingId === suggestion.id}
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
                        onClick={() => handleStatusChange(suggestion.id, "rejected")}
                        disabled={updatingId === suggestion.id}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                          "bg-stone-100 text-stone-600 hover:bg-stone-200",
                          "dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700",
                          "disabled:opacity-50"
                        )}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    )}

                    {suggestion.status !== "converted" && (
                      <button
                        onClick={() => handleStatusChange(suggestion.id, "converted")}
                        disabled={updatingId === suggestion.id}
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
                      onClick={() => handleDelete(suggestion.id)}
                      disabled={updatingId === suggestion.id}
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
              )}
            </div>
          ))}
        </div>
      )}

      <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
        Suggestions from logged-in visitors
      </p>
    </div>
  );
}
