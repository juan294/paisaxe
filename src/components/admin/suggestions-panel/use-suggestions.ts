"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchSuggestions, updateSuggestion, deleteSuggestion } from "@/lib/admin-api";
import type { AdminStorySuggestion, SuggestionStatus } from "@/types/suggestions";
import type { CreateStoryResponse } from "@/types/admin";

export function useSuggestions() {
  const [suggestions, setSuggestions] = useState<AdminStorySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<SuggestionStatus | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [convertingSuggestion, setConvertingSuggestion] = useState<AdminStorySuggestion | null>(null);

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

  const handleConvertToStory = (suggestion: AdminStorySuggestion) => {
    setConvertingSuggestion(suggestion);
  };

  const handleStoryCreated = (story: CreateStoryResponse) => {
    // Update the suggestion status in local state
    if (convertingSuggestion) {
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === convertingSuggestion.id
            ? { ...s, status: "converted" as SuggestionStatus, convertedStoryId: story.id }
            : s
        )
      );
    }
    setConvertingSuggestion(null);
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

  return {
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
  };
}
