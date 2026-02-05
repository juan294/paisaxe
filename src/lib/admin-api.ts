import type {
  AdminStory,
  CurationStatus,
  AdminApiResponse,
  ContentImagesResponse,
  CreateStoryRequest,
  CreateStoryResponse,
  UpdateStoryRequest,
  UpdateStoryResponse,
  StoryTranslationsResponse,
  GenerateTranslationsResponse,
} from "@/types/admin";
import type { StoryLocale, StoryTranslation } from "@/types/immersive";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";
import type { AnalyticsDashboardData } from "@/types/analytics";
import type { ElevenLabsAnalyticsDashboardData } from "@/types/elevenlabs-analytics";
import type { StripeAnalyticsDashboardData } from "@/types/stripe-analytics";
import type { AdminStorySuggestion, SuggestionStatus, StorySuggestion } from "@/types/suggestions";
import type {
  CostsAnalyticsDashboardData,
  CreateManualCostRequest,
  ManualCostEntry,
  UpdateManualCostRequest,
} from "@/types/costs-analytics";

const API_BASE = "/api/admin";

/**
 * Client-side API helpers for admin panel.
 * Auth is handled via session cookies automatically.
 */

/**
 * Create a new story
 */
export async function createStory(
  data: CreateStoryRequest
): Promise<AdminApiResponse<CreateStoryResponse>> {
  try {
    const response = await fetch(`${API_BASE}/stories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to create story" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating story:", error);
    return { error: "Network error" };
  }
}

/**
 * Update an existing story's fields
 */
export async function updateStory(
  storyId: string,
  data: UpdateStoryRequest
): Promise<AdminApiResponse<UpdateStoryResponse>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update story" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating story:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch all stories with optional filter
 */
export async function fetchStories(
  filter?: CurationStatus
): Promise<AdminApiResponse<AdminStory[]>> {
  try {
    const url = new URL(`${API_BASE}/stories`, window.location.origin);
    if (filter) {
      url.searchParams.set("filter", filter);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch stories" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching stories:", error);
    return { error: "Network error" };
  }
}

/**
 * Update story image via URL
 */
export async function updateStoryImageUrl(
  storyId: string,
  imageUrl: string,
  imageSource?: string
): Promise<AdminApiResponse<{ id: string; image: string; imageSource?: string }>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/image`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl, imageSource }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update image" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating image:", error);
    return { error: "Network error" };
  }
}

/**
 * Upload image file for a story
 */
export async function uploadStoryImage(
  storyId: string,
  file: File,
  imageSource?: string
): Promise<AdminApiResponse<{ id: string; image: string; imageSource?: string }>> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    if (imageSource) {
      formData.append("imageSource", imageSource);
    }

    const response = await fetch(`${API_BASE}/stories/${storyId}/image`, {
      method: "PUT",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to upload image" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error uploading image:", error);
    return { error: "Network error" };
  }
}

/**
 * Update story image source/attribution only (without changing the image URL)
 */
export async function updateStoryImageSource(
  storyId: string,
  imageSource: string
): Promise<AdminApiResponse<{ id: string; imageSource: string }>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/image-source`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageSource }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update image source" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating image source:", error);
    return { error: "Network error" };
  }
}

/**
 * Update story curation status
 */
export async function updateStoryStatus(
  storyId: string,
  status: CurationStatus
): Promise<AdminApiResponse<{ id: string; curationStatus: CurationStatus }>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update status" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating status:", error);
    return { error: "Network error" };
  }
}

/**
 * Bulk update story curation status
 */
export async function bulkUpdateStoryStatus(
  storyIds: string[],
  status: CurationStatus
): Promise<AdminApiResponse<{ updatedIds: string[]; status: CurationStatus }>> {
  try {
    const response = await fetch(`${API_BASE}/stories/bulk-status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storyIds, status }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update stories" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error bulk updating status:", error);
    return { error: "Network error" };
  }
}

/**
 * Bulk delete stories
 */
export async function bulkDeleteStories(
  storyIds: string[]
): Promise<AdminApiResponse<{ deletedIds: string[] }>> {
  try {
    const response = await fetch(`${API_BASE}/stories/bulk-delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ storyIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to delete stories" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error bulk deleting stories:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch all feature flags
 */
export async function fetchFeatureFlags(): Promise<AdminApiResponse<FeatureFlag[]>> {
  try {
    const response = await fetch("/api/feature-flags");

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch feature flags" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    return { error: "Network error" };
  }
}

/**
 * Toggle a feature flag on or off
 */
export async function updateFeatureFlag(
  flagKey: FeatureFlagKey,
  enabled: boolean
): Promise<AdminApiResponse<FeatureFlag>> {
  try {
    const response = await fetch(`${API_BASE}/feature-flags/${flagKey}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update feature flag" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating feature flag:", error);
    return { error: "Network error" };
  }
}

/**
 * Update a feature flag's configuration
 */
export async function updateFeatureFlagConfig(
  flagKey: FeatureFlagKey,
  config: Record<string, unknown>
): Promise<AdminApiResponse<FeatureFlag>> {
  try {
    const response = await fetch(`${API_BASE}/feature-flags/${flagKey}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ config }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update feature flag config" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating feature flag config:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch analytics dashboard data
 */
export async function fetchAnalytics(
  from?: string,
  to?: string,
  includeLocalhost?: boolean
): Promise<AdminApiResponse<AnalyticsDashboardData>> {
  try {
    const url = new URL(`${API_BASE}/analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);
    if (includeLocalhost) url.searchParams.set("includeLocalhost", "true");

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch analytics" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return { error: "Network error" };
  }
}

/**
 * Search for content images from PDF manifest for a story
 */
export async function searchContentImages(
  storyId: string
): Promise<AdminApiResponse<ContentImagesResponse>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/content-images`);

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to search content images" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error searching content images:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch ElevenLabs voice agent analytics
 */
export async function fetchElevenLabsAnalytics(
  from?: string,
  to?: string
): Promise<AdminApiResponse<ElevenLabsAnalyticsDashboardData>> {
  try {
    const url = new URL(`${API_BASE}/elevenlabs-analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch ElevenLabs analytics" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching ElevenLabs analytics:", error);
    return { error: "Network error" };
  }
}

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

/**
 * Fetch Stripe revenue analytics
 */
export async function fetchStripeAnalytics(
  from?: string,
  to?: string
): Promise<AdminApiResponse<StripeAnalyticsDashboardData> & { warning?: string }> {
  try {
    const url = new URL(`${API_BASE}/stripe-analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch Stripe analytics" };
    }

    const result = await response.json();
    return {
      data: result.data,
      warning: result.warning,
    };
  } catch (error) {
    console.error("Error fetching Stripe analytics:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch translations for a story
 */
export async function fetchStoryTranslations(
  storyId: string
): Promise<AdminApiResponse<StoryTranslationsResponse>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/translations`);

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch translations" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching translations:", error);
    return { error: "Network error" };
  }
}

/**
 * Update a single locale translation for a story
 */
export async function updateStoryTranslation(
  storyId: string,
  locale: StoryLocale,
  translation: StoryTranslation
): Promise<AdminApiResponse<{ success: boolean; locale: StoryLocale; storyId: string }>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/translations`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locale, translation }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update translation" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating translation:", error);
    return { error: "Network error" };
  }
}

/**
 * Generate translations for a story using Claude API
 */
export async function generateStoryTranslations(
  storyId: string,
  options?: {
    locales?: StoryLocale[];
    forceRetranslate?: boolean;
  }
): Promise<AdminApiResponse<GenerateTranslationsResponse>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/translations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options || {}),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to generate translations" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error generating translations:", error);
    return { error: "Network error" };
  }
}

/**
 * Fetch platform costs analytics
 */
export async function fetchCostsAnalytics(
  from?: string,
  to?: string
): Promise<AdminApiResponse<CostsAnalyticsDashboardData>> {
  try {
    const url = new URL(`${API_BASE}/costs-analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to fetch costs analytics" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching costs analytics:", error);
    return { error: "Network error" };
  }
}

/**
 * Create a manual cost entry
 */
export async function createManualCostEntry(
  data: CreateManualCostRequest
): Promise<AdminApiResponse<ManualCostEntry>> {
  try {
    const response = await fetch(`${API_BASE}/costs-analytics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to create cost entry" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating cost entry:", error);
    return { error: "Network error" };
  }
}

/**
 * Update a manual cost entry
 */
export async function updateManualCostEntry(
  id: string,
  data: UpdateManualCostRequest
): Promise<AdminApiResponse<ManualCostEntry>> {
  try {
    const response = await fetch(`${API_BASE}/costs-analytics/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to update cost entry" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating cost entry:", error);
    return { error: "Network error" };
  }
}

/**
 * Delete a manual cost entry
 */
export async function deleteManualCostEntry(
  id: string
): Promise<AdminApiResponse<{ id: string; deleted: boolean }>> {
  try {
    const response = await fetch(`${API_BASE}/costs-analytics/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to delete cost entry" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting cost entry:", error);
    return { error: "Network error" };
  }
}
