import type { StoryRow, StoryCategory, StoryLocation, StoryDuration } from "./immersive";

// Curation status for admin workflow
export type CurationStatus = "needs_curation" | "approved";

// Extended StoryRow with curation status
export interface AdminStoryRow extends StoryRow {
  curation_status: CurationStatus;
}

// Admin story view combining story data with curation info
export interface AdminStory {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  imageSource?: string;
  category: StoryCategory;
  sourcePdf?: string;
  location?: StoryLocation;
  duration?: StoryDuration;
  displayOrder: number;
  curationStatus: CurationStatus;
  createdAt: string;
  updatedAt: string;
}

// Convert database row to AdminStory
export function rowToAdminStory(row: AdminStoryRow): AdminStory {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || "",
    description: row.description || "",
    image: row.image_path || "",
    imageSource: row.image_source || undefined,
    category: row.category as StoryCategory,
    sourcePdf: row.source_pdf || undefined,
    location: row.location ? (row.location as StoryLocation) : undefined,
    duration: row.duration ? (row.duration as StoryDuration) : undefined,
    displayOrder: row.display_order,
    curationStatus: row.curation_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// API request/response types
export interface GetStoriesParams {
  filter?: CurationStatus;
}

export interface UpdateImageRequest {
  imageUrl?: string;
  // File upload handled separately via FormData
}

export interface UpdateStatusRequest {
  status: CurationStatus;
}

export interface AdminApiResponse<T> {
  data?: T;
  error?: string;
}

// Content image from PDF manifest
export interface ContentImage {
  filename: string;
  sourcePdf: string;
  pageNumber: number;
  width: number;
  height: number;
  aspectRatio: number;
  type: string;
  url: string;
  score: number;
}

export interface ContentImagesResponse {
  images: ContentImage[];
  total: number;
}
