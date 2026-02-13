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
import { csrfHeaders } from "@/lib/csrf-client";

const API_BASE = "/api/admin";

/**
 * Create a new story
 */
export async function createStory(
  data: CreateStoryRequest
): Promise<AdminApiResponse<CreateStoryResponse>> {
  try {
    const response = await fetch(`${API_BASE}/stories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
      headers: csrfHeaders(),
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
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
 * Approve all pending (needs_curation) stories at once
 */
export async function approveAllPendingStories(): Promise<
  AdminApiResponse<{ approvedCount: number; approvedIds: string[] }>
> {
  try {
    const response = await fetch(`${API_BASE}/stories/approve-all`, {
      method: "POST",
      headers: csrfHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      return { error: error.error || "Failed to approve all stories" };
    }

    return await response.json();
  } catch (error) {
    console.error("Error approving all stories:", error);
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
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
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
