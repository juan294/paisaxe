import type { Story, StoryCategory, StoryLocation, StoryDuration, StoryRow } from "@/types/immersive";
import { rowToStory } from "@/types/immersive";
import { supabase } from "./supabase";

// LOCATION-SPECIFIC: Import fallback stories from content directory
// When replicating, replace content/fallback-stories.json with location-specific stories
import fallbackStoriesData from "@content/fallback-stories.json";

// LOCATION-SPECIFIC: Hardcoded fallback stories (used when database is unavailable)
// These stories are loaded from content/fallback-stories.json for easy content management
export const FALLBACK_STORIES: Story[] = fallbackStoriesData.stories as Story[];

/**
 * Fetch all active stories from the database
 * Falls back to hardcoded stories if database is unavailable
 */
export async function getStoriesFromDB(): Promise<Story[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .eq("is_active", true)
      .eq("curation_status", "approved")
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("Failed to fetch stories from DB, using fallback:", error.message);
      return FALLBACK_STORIES;
    }

    if (!data || data.length === 0) {
      return FALLBACK_STORIES;
    }

    return (data as StoryRow[]).map(rowToStory);
  } catch (error) {
    console.warn("Error fetching stories:", error);
    return FALLBACK_STORIES;
  }
}

/**
 * Fetch stories by category from the database
 */
export async function getStoriesByCategoryFromDB(category: StoryCategory | null): Promise<Story[]> {
  if (!category) {
    return getStoriesFromDB();
  }

  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .eq("is_active", true)
      .eq("curation_status", "approved")
      .eq("category", category)
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("Failed to fetch stories by category, using fallback:", error.message);
      return FALLBACK_STORIES.filter(s => s.category === category);
    }

    if (!data || data.length === 0) {
      return FALLBACK_STORIES.filter(s => s.category === category);
    }

    return (data as StoryRow[]).map(rowToStory);
  } catch (error) {
    console.warn("Error fetching stories by category:", error);
    return FALLBACK_STORIES.filter(s => s.category === category);
  }
}

/**
 * Fetch stories by location from the database
 */
export async function getStoriesByLocationFromDB(location: StoryLocation): Promise<Story[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .eq("is_active", true)
      .eq("curation_status", "approved")
      .eq("location", location)
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("Failed to fetch stories by location, using fallback:", error.message);
      return FALLBACK_STORIES.filter(s => s.location === location);
    }

    if (!data || data.length === 0) {
      return FALLBACK_STORIES.filter(s => s.location === location);
    }

    return (data as StoryRow[]).map(rowToStory);
  } catch (error) {
    console.warn("Error fetching stories by location:", error);
    return FALLBACK_STORIES.filter(s => s.location === location);
  }
}

/**
 * Fetch stories by duration from the database
 */
export async function getStoriesByDurationFromDB(duration: StoryDuration): Promise<Story[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .eq("is_active", true)
      .eq("curation_status", "approved")
      .eq("duration", duration)
      .order("display_order", { ascending: true });

    if (error) {
      console.warn("Failed to fetch stories by duration, using fallback:", error.message);
      return FALLBACK_STORIES.filter(s => s.duration === duration);
    }

    if (!data || data.length === 0) {
      return FALLBACK_STORIES.filter(s => s.duration === duration);
    }

    return (data as StoryRow[]).map(rowToStory);
  } catch (error) {
    console.warn("Error fetching stories by duration:", error);
    return FALLBACK_STORIES.filter(s => s.duration === duration);
  }
}

/**
 * Get a single story by slug from the database
 */
export async function getStoryBySlugFromDB(slug: string): Promise<Story | null> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .eq("curation_status", "approved")
      .single();

    if (error) {
      console.warn("Failed to fetch story by slug:", error.message);
      return FALLBACK_STORIES.find(s => s.slug === slug || s.id === slug) || null;
    }

    return data ? rowToStory(data as StoryRow) : null;
  } catch (error) {
    console.warn("Error fetching story:", error);
    return FALLBACK_STORIES.find(s => s.slug === slug || s.id === slug) || null;
  }
}

// Synchronous functions for backward compatibility (use hardcoded data)
export function getStoriesByCategory(category: StoryCategory | null): Story[] {
  if (!category) return FALLBACK_STORIES;
  return FALLBACK_STORIES.filter(s => s.category === category);
}

export function getStoriesByLocation(location: StoryLocation | null): Story[] {
  if (!location) return FALLBACK_STORIES;
  return FALLBACK_STORIES.filter(s => s.location === location);
}

export function getStoriesByDuration(duration: StoryDuration | null): Story[] {
  if (!duration) return FALLBACK_STORIES;
  return FALLBACK_STORIES.filter(s => s.duration === duration);
}

export function getAllCategories(): StoryCategory[] {
  return ["nature", "cities", "food", "culture", "activities"];
}

// LOCATION-SPECIFIC: Region IDs - derived from location config
export function getAllLocations(): StoryLocation[] {
  return ["eastern", "central", "western"];
}

export function getAllDurations(): StoryDuration[] {
  return ["day-trip", "weekend", "week"];
}

/**
 * Convert Story to database format for seeding
 */
export function storyToRow(story: Story, order: number = 0): Omit<StoryRow, "id" | "created_at" | "updated_at"> {
  return {
    slug: story.slug || story.id,
    title: story.title,
    subtitle: story.subtitle || null,
    description: story.description || null,
    image_path: story.image || null,
    image_source: story.imageSource || null,
    blur_data_url: story.blurDataUrl || null,
    category: story.category,
    source_pdf: story.sourcePdf || null,
    location: story.location || null,
    duration: story.duration || null,
    display_order: story.displayOrder ?? order,
    is_active: true,
    related_stories: story.relatedStories || null,
    metadata: {},
    best_months: story.bestMonths || null,
    source_type: story.sourceType || null,
    suggestion_id: story.suggestionId || null,
  };
}
