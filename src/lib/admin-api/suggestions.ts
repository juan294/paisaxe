import type { AdminApiResponse } from "@/types/admin";
import type { AdminStorySuggestion, SuggestionStatus, StorySuggestion } from "@/types/suggestions";

const API_BASE = "/api/admin";

/**
 * Fetch all story suggestions with optional status filter
 */
export async function fetchSuggestions(
  status?: SuggestionStatus
): Promise<AdminApiResponse<AdminStorySuggestion[]>> {
  try {
    const url = new URL(`${API_BASE}/suggestions`, window.location.origin);
    if (status) {
      url.searchParams.set("status", status);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch suggestions" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return { error: "Network error" };
  }
}

/**
 * Update a story suggestion's status and/or admin notes
 */
export async function updateSuggestion(
  suggestionId: string,
  updates: { status?: SuggestionStatus; adminNotes?: string }
): Promise<AdminApiResponse<StorySuggestion>> {
  try {
    const response = await fetch(`${API_BASE}/suggestions/${suggestionId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update suggestion" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating suggestion:", error);
    return { error: "Network error" };
  }
}

/**
 * Delete a story suggestion
 */
export async function deleteSuggestion(
  suggestionId: string
): Promise<AdminApiResponse<{ id: string; deleted: boolean }>> {
  try {
    const response = await fetch(`${API_BASE}/suggestions/${suggestionId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to delete suggestion" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting suggestion:", error);
    return { error: "Network error" };
  }
}
