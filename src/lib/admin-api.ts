import type { AdminStory, CurationStatus, AdminApiResponse, ContentImagesResponse } from "@/types/admin";
import type { FeatureFlag, FeatureFlagKey } from "@/types/feature-flags";
import type { AnalyticsDashboardData } from "@/types/analytics";
import type { ElevenLabsAnalyticsDashboardData } from "@/types/elevenlabs-analytics";

const API_BASE = "/api/admin";

/**
 * Client-side API helpers for admin panel.
 * Auth is handled via session cookies automatically.
 */

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
  to?: string
): Promise<AdminApiResponse<AnalyticsDashboardData>> {
  try {
    const url = new URL(`${API_BASE}/analytics`, window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);

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
