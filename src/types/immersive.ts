export interface Story {
  id: string;
  slug?: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  imageSource?: string;
  category: StoryCategory;
  sourcePdf: string;
  location?: StoryLocation;
  duration?: StoryDuration;
  displayOrder?: number;
  relatedStories?: string[];
  createdAt?: string;
  bestMonths?: number[];
  metadata?: StoryMetadata;
}

export interface StoryMetadata {
  question_prompts?: string[];
  mood_tags?: string[];
  asturianu_title?: string;
  asturianu_subtitle?: string;
  [key: string]: unknown;
}

export type StoryCategory =
  | "nature"
  | "cities"
  | "food"
  | "culture"
  | "activities";

export type StoryLocation =
  | "eastern"   // Eastern Asturias (Llanes, Cangas de Onís, Picos de Europa)
  | "central"   // Central Asturias (Oviedo, Gijón, Avilés)
  | "western";  // Western Asturias (Cudillero, Luarca, Tapia de Casariego)

export type StoryDuration =
  | "day-trip"  // Single day visit
  | "weekend"   // 2-3 days
  | "week";     // Week-long exploration

export const CATEGORY_LABELS: Record<StoryCategory, string> = {
  nature: "Naturaleza",
  cities: "Ciudades",
  food: "Gastronomía",
  culture: "Cultura",
  activities: "Actividades",
};

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

// Database row type (snake_case from Supabase)
export interface StoryRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_path: string | null;
  image_source: string | null;
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
    category: row.category as StoryCategory,
    sourcePdf: row.source_pdf || "",
    location: row.location ? (row.location as StoryLocation) : undefined,
    duration: row.duration ? (row.duration as StoryDuration) : undefined,
    displayOrder: row.display_order,
    relatedStories: row.related_stories || undefined,
    createdAt: row.created_at,
    bestMonths: row.best_months || undefined,
    metadata: (row.metadata as StoryMetadata) || undefined,
  };
}
