/**
 * Types for immersive story viewing experience.
 *
 * LOCATION-SPECIFIC: This file contains location-specific type definitions.
 * When replicating, update:
 * - StoryLocation type (region IDs)
 * - LOCATION_LABELS (region display names)
 * - CATEGORY_LABELS (if categories differ)
 */

export type StorySourceType = "curated" | "user_submitted";

export interface Story {
  id: string;
  slug?: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  imageSource?: string;
  /** Base64 blur placeholder for progressive loading */
  blurDataUrl?: string;
  category: StoryCategory;
  sourcePdf: string;
  location?: StoryLocation;
  duration?: StoryDuration;
  displayOrder?: number;
  relatedStories?: string[];
  createdAt?: string;
  bestMonths?: number[];
  metadata?: StoryMetadata;
  /** Source type: curated (default) or user_submitted (from suggestions) */
  sourceType?: StorySourceType;
  /** ID of the suggestion this story was created from */
  suggestionId?: string;
}

/** Localized text for a story in a specific language */
export interface StoryTranslation {
  title: string;
  subtitle: string;
  description: string;
}

/** Supported locales for story translations (matches Locale type from i18n) */
export type StoryLocale = 'en' | 'fr' | 'de' | 'pt';

export interface StoryMetadata {
  question_prompts?: string[];
  mood_tags?: string[];
  asturianu_title?: string;
  asturianu_subtitle?: string;
  /** Translations for non-Spanish locales. Spanish is the default in title/subtitle/description fields */
  translations?: Partial<Record<StoryLocale, StoryTranslation>>;
  [key: string]: unknown;
}

export type StoryCategory =
  | "nature"
  | "cities"
  | "food"
  | "culture"
  | "activities";

// =============================================================================
// LOCATION-SPECIFIC: Region definitions
// =============================================================================

/**
 * Story location/region type.
 *
 * LOCATION-SPECIFIC: These region IDs must match the keys in LOCATION_CONFIG.regions
 * When replicating, update to match your location's regions.
 */
export type StoryLocation =
  | "eastern"   // Eastern Asturias (Llanes, Cangas de Onís, Picos de Europa)
  | "central"   // Central Asturias (Oviedo, Gijón, Avilés)
  | "western";  // Western Asturias (Cudillero, Luarca, Tapia de Casariego)

export type StoryDuration =
  | "day-trip"  // Single day visit
  | "weekend"   // 2-3 days
  | "week";     // Week-long exploration

// =============================================================================
// LOCATION-SPECIFIC: Display labels (Spanish defaults)
// =============================================================================

/**
 * Category labels for display in UI.
 * Not strictly location-specific, but may vary by location.
 */
export const CATEGORY_LABELS: Record<StoryCategory, string> = {
  nature: "Naturaleza",
  cities: "Ciudades",
  food: "Gastronomía",
  culture: "Cultura",
  activities: "Actividades",
};

/**
 * Location/region labels for display in UI.
 *
 * LOCATION-SPECIFIC: Update these labels for your location's regions.
 * These are the Spanish labels; translations are in src/lib/i18n/*.ts
 */
export const LOCATION_LABELS: Record<StoryLocation, string> = {
  eastern: "Asturias Oriental",
  central: "Asturias Central",
  western: "Asturias Occidental",
};

export const DURATION_LABELS: Record<StoryDuration, string> = {
  "day-trip": "Excursión de un día",
  weekend: "Fin de semana",
  week: "Una semana",
};

// =============================================================================
// Database types (not location-specific)
// =============================================================================

// Database row type (snake_case from Supabase)
export interface StoryRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_path: string | null;
  image_source: string | null;
  blur_data_url: string | null;
  category: string;
  source_pdf: string | null;
  location: string | null;
  duration: string | null;
  display_order: number;
  is_active: boolean;
  related_stories: string[] | null;
  metadata: Record<string, unknown>;
  best_months: number[] | null;
  created_at: string;
  updated_at: string;
  source_type: string | null;
  suggestion_id: string | null;
}

// Convert database row to Story interface
export function rowToStory(row: StoryRow): Story {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || "",
    description: row.description || "",
    image: row.image_path || "",
    imageSource: row.image_source || undefined,
    blurDataUrl: row.blur_data_url || undefined,
    category: row.category as StoryCategory,
    sourcePdf: row.source_pdf || "",
    location: row.location ? (row.location as StoryLocation) : undefined,
    duration: row.duration ? (row.duration as StoryDuration) : undefined,
    displayOrder: row.display_order,
    relatedStories: row.related_stories || undefined,
    createdAt: row.created_at,
    bestMonths: row.best_months || undefined,
    metadata: (row.metadata as StoryMetadata) || undefined,
    sourceType: row.source_type ? (row.source_type as StorySourceType) : undefined,
    suggestionId: row.suggestion_id || undefined,
  };
}
