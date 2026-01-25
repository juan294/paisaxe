import type { AdminStory, CurationStatus, AdminApiResponse } from "@/types/admin";

const API_BASE = "/api/admin";

/**
 * Client-side API helpers for admin panel.
 * All methods require the admin key to be passed.
 */

function getAuthHeaders(adminKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${adminKey}`,
  };
}

/**
 * Fetch all stories with optional filter
 */
export async function fetchStories(
  adminKey: string,
  filter?: CurationStatus
): Promise<AdminApiResponse<AdminStory[]>> {
  try {
    const url = new URL(`${API_BASE}/stories`, window.location.origin);
    if (filter) {
      url.searchParams.set("filter", filter);
    }

    const response = await fetch(url.toString(), {
      headers: getAuthHeaders(adminKey),
    });

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
  adminKey: string,
  storyId: string,
  imageUrl: string,
  imageSource?: string
): Promise<AdminApiResponse<{ id: string; image: string; imageSource?: string }>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/image`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(adminKey),
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
  adminKey: string,
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
      headers: getAuthHeaders(adminKey),
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
  adminKey: string,
  storyId: string,
  status: CurationStatus
): Promise<AdminApiResponse<{ id: string; curationStatus: CurationStatus }>> {
  try {
    const response = await fetch(`${API_BASE}/stories/${storyId}/status`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(adminKey),
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
 * Validate admin key by making a test request
 */
export async function validateAdminKey(adminKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/stories`, {
      headers: getAuthHeaders(adminKey),
    });
    return response.ok;
  } catch {
    return false;
  }
}
