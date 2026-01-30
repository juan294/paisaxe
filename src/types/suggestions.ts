import type { StoryLocation } from "./immersive";

export type SuggestionStatus = "pending" | "reviewed" | "converted" | "rejected";

// Database row type
export interface StorySuggestionRow {
  id: string;
  user_id: string;
  place_name: string;
  comment: string | null;
  location: string | null;
  status: SuggestionStatus;
  admin_notes: string | null;
  converted_story_id: string | null;
  attribution: string | null;
  created_at: string;
  updated_at: string;
}

// Application type
export interface StorySuggestion {
  id: string;
  userId: string;
  placeName: string;
  comment: string | null;
  location: StoryLocation | null;
  status: SuggestionStatus;
  adminNotes: string | null;
  convertedStoryId: string | null;
  /** How the user wants to be credited (name, social handle, etc.) */
  attribution: string | null;
  createdAt: string;
  updatedAt: string;
}

// Extended type for admin view (includes user email)
export interface AdminStorySuggestion extends StorySuggestion {
  userEmail: string | null;
}

// Request type for creating a suggestion
export interface CreateSuggestionRequest {
  placeName: string;
  comment?: string;
  location?: "eastern" | "central" | "western";
  /** How the user wants to be credited (name, social handle, etc.) */
  attribution?: string;
}

// Request type for updating a suggestion (admin)
export interface UpdateSuggestionRequest {
  status?: SuggestionStatus;
  adminNotes?: string;
}

// Convert database row to application type
export function rowToStorySuggestion(row: StorySuggestionRow): StorySuggestion {
  return {
    id: row.id,
    userId: row.user_id,
    placeName: row.place_name,
    comment: row.comment,
    location: row.location as StoryLocation | null,
    status: row.status,
    adminNotes: row.admin_notes,
    convertedStoryId: row.converted_story_id,
    attribution: row.attribution,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Convert database row with user email to admin type
export function rowToAdminStorySuggestion(
  row: StorySuggestionRow & { user_email?: string }
): AdminStorySuggestion {
  return {
    ...rowToStorySuggestion(row),
    userEmail: row.user_email ?? null,
  };
}
