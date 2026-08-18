/**
 * Types for immersive story viewing experience.
 *
 * LOCATION-SPECIFIC: This file contains location-specific type definitions.
 * When replicating, update:
 * - StoryLocation type (region IDs)
 * - LOCATION_LABELS (region display names)
 * - CATEGORY_LABELS (if categories differ)
 */

export const STORY_SOURCE_TYPES = [
  "curated",
  "user_submitted",
  "agent_discovered",
] as const;

export type StorySourceType = (typeof STORY_SOURCE_TYPES)[number];

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

export type PublicStoryMetadata = Pick<
  StoryMetadata,
  | "question_prompts"
  | "mood_tags"
  | "asturianu_title"
  | "asturianu_subtitle"
  | "translations"
>;

export type PublicStory = Omit<
  Story,
  "sourcePdf" | "suggestionId" | "metadata"
> & {
  metadata?: PublicStoryMetadata;
};

/** Localized text for a story in a specific language */
export interface StoryTranslation {
  title: string;
  subtitle: string;
  description: string;
  /**
   * UX-H6 (#892): translated suggested-question chips for this locale.
   * Optional — older/untranslated translation entries won't have it, and
   * consumers must fall back to the story's Spanish question_prompts.
   */
  question_prompts?: string[];
}

/** Supported locales for story translations (matches Locale type from i18n) */
export type StoryLocale = 'en' | 'fr' | 'de' | 'pt' | 'ast';

/** Status of a translation for a specific locale */
export interface TranslationStatus {
  status: 'pending' | 'translating' | 'complete' | 'failed';
  error?: string;
  updatedAt?: string;
}

export interface StoryMetadata {
  question_prompts?: string[];
  mood_tags?: string[];
  asturianu_title?: string;
  asturianu_subtitle?: string;
  /** Translations for non-Spanish locales. Spanish is the default in title/subtitle/description fields */
  translations?: Partial<Record<StoryLocale, StoryTranslation>>;
  /** Per-language translation status tracking */
  translation_status?: Partial<Record<StoryLocale, TranslationStatus>>;
  /** ISO timestamp of last translation generation */
  last_translated_at?: string;
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
 * All valid story categories as an array.
 * Used for runtime validation in API routes.
 */
export const VALID_CATEGORIES: StoryCategory[] = [
  "nature",
  "cities",
  "food",
  "culture",
  "activities",
];

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

export const PUBLIC_STORY_SELECT = [
  "id",
  "slug",
  "title",
  "subtitle",
  "description",
  "image_path",
  "image_source",
  "blur_data_url",
  "category",
  "location",
  "duration",
  "display_order",
  "related_stories",
  "metadata",
  "best_months",
  "created_at",
  "source_type",
].join(",");

export type PublicStoryRow = Pick<
  StoryRow,
  | "id"
  | "slug"
  | "title"
  | "subtitle"
  | "description"
  | "image_path"
  | "image_source"
  | "blur_data_url"
  | "category"
  | "location"
  | "duration"
  | "display_order"
  | "related_stories"
  | "metadata"
  | "best_months"
  | "created_at"
  | "source_type"
>;

function sanitizePublicMetadata(
  metadata: Record<string, unknown> | StoryMetadata | null | undefined
): PublicStoryMetadata | undefined {
  if (!metadata) return undefined;

  const publicMetadata: PublicStoryMetadata = {};
  const source = metadata as StoryMetadata;

  if (Array.isArray(source.question_prompts)) {
    publicMetadata.question_prompts = source.question_prompts;
  }
  if (Array.isArray(source.mood_tags)) {
    publicMetadata.mood_tags = source.mood_tags;
  }
  if (typeof source.asturianu_title === "string") {
    publicMetadata.asturianu_title = source.asturianu_title;
  }
  if (typeof source.asturianu_subtitle === "string") {
    publicMetadata.asturianu_subtitle = source.asturianu_subtitle;
  }
  if (source.translations) {
    publicMetadata.translations = source.translations;
  }

  return Object.keys(publicMetadata).length > 0 ? publicMetadata : undefined;
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

export function rowToPublicStory(row: PublicStoryRow): Story {
  return publicStoryToStory({
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || "",
    description: row.description || "",
    image: row.image_path || "",
    imageSource: row.image_source || undefined,
    blurDataUrl: row.blur_data_url || undefined,
    category: row.category as StoryCategory,
    location: row.location ? (row.location as StoryLocation) : undefined,
    duration: row.duration ? (row.duration as StoryDuration) : undefined,
    displayOrder: row.display_order,
    relatedStories: row.related_stories || undefined,
    createdAt: row.created_at,
    bestMonths: row.best_months || undefined,
    metadata: sanitizePublicMetadata(row.metadata),
    sourceType: row.source_type ? (row.source_type as StorySourceType) : undefined,
  });
}

export function toPublicStory(story: Story): PublicStory {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    subtitle: story.subtitle,
    description: story.description,
    image: story.image,
    imageSource: story.imageSource,
    blurDataUrl: story.blurDataUrl,
    category: story.category,
    location: story.location,
    duration: story.duration,
    displayOrder: story.displayOrder,
    relatedStories: story.relatedStories,
    createdAt: story.createdAt,
    bestMonths: story.bestMonths,
    metadata: sanitizePublicMetadata(story.metadata),
    sourceType: story.sourceType,
  };
}

export function publicStoryToStory(story: PublicStory): Story {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    subtitle: story.subtitle,
    description: story.description,
    image: story.image,
    imageSource: story.imageSource,
    blurDataUrl: story.blurDataUrl,
    category: story.category,
    sourcePdf: "",
    location: story.location,
    duration: story.duration,
    displayOrder: story.displayOrder,
    relatedStories: story.relatedStories,
    createdAt: story.createdAt,
    bestMonths: story.bestMonths,
    metadata: sanitizePublicMetadata(story.metadata),
    sourceType: story.sourceType,
  };
}
