import type { Story, StoryCategory, StoryLocation, StoryDuration, StoryRow } from "@/types/immersive";
import { rowToStory } from "@/types/immersive";
import { supabase } from "./supabase";

// Hardcoded fallback stories (used when database is unavailable)
export const FALLBACK_STORIES: Story[] = [
  {
    id: "lagos-covadonga",
    slug: "lagos-covadonga",
    title: "Lagos de Covadonga",
    subtitle: "Picos de Europa",
    description: "Dos lagos de origen glaciar rodeados de las imponentes cumbres de los Picos de Europa. Un paisaje que quita el aliento en cualquier época del año.",
    image: "/images/stories/lagos-covadonga.png",
    category: "nature",
    sourcePdf: "0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "oviedo-catedral",
    slug: "oviedo-catedral",
    title: "Catedral de Oviedo",
    subtitle: "Capital del Principado",
    description: "La joya del gótico asturiano, con su Cámara Santa declarada Patrimonio de la Humanidad. Siglos de historia en cada piedra.",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920",
    category: "cities",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "fabada",
    slug: "fabada",
    title: "Fabada Asturiana",
    subtitle: "Tradición en cada cucharada",
    description: "El plato más emblemático de nuestra gastronomía. Fabes, chorizo, morcilla y lacón cocinados a fuego lento con todo el sabor de Asturias.",
    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1920",
    category: "food",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "prerromanico",
    slug: "prerromanico",
    title: "Arte Prerrománico",
    subtitle: "Patrimonio de la Humanidad",
    description: "Santa María del Naranco, San Miguel de Lillo... Joyas arquitectónicas únicas en el mundo que cuentan la historia del Reino de Asturias.",
    image: "/images/stories/prerromanico.png",
    category: "culture",
    sourcePdf: "02e93c24-6cac-6d7d-1ca8-59fd8d3fa337.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "ruta-cares",
    slug: "ruta-cares",
    title: "Ruta del Cares",
    subtitle: "La Garganta Divina",
    description: "12 kilómetros excavados en la roca entre Caín y Poncebos. Una de las rutas de senderismo más espectaculares de Europa.",
    image: "/images/stories/ruta-cares.png",
    category: "activities",
    sourcePdf: "0062f6f0-a7d2-5b11-6b58-b47e5912be74.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "playa-silencio",
    slug: "playa-silencio",
    title: "Playa del Silencio",
    subtitle: "Cudillero",
    description: "Un anfiteatro natural de acantilados que abrazan aguas cristalinas. Silencio, paz y la belleza salvaje del Cantábrico.",
    image: "/images/stories/playa-silencio.png",
    category: "nature",
    sourcePdf: "12c86611-ccbe-dbe9-ac86-67ef948a5371.pdf",
    location: "western",
    duration: "day-trip",
  },
  {
    id: "sidra",
    slug: "sidra",
    title: "Sidra Asturiana",
    subtitle: "Cultura líquida",
    description: "El arte del escanciado, los llagares centenarios, el ritual del culín. Más que una bebida, una forma de entender la vida.",
    image: "https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=1920",
    category: "food",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "gijon",
    slug: "gijon",
    title: "Gijón",
    subtitle: "Ciudad y mar",
    description: "Cimadevilla, San Lorenzo, el Elogio del Horizonte... Una ciudad que mira al mar con la personalidad única de lo auténtico.",
    image: "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=1920",
    category: "cities",
    sourcePdf: "Asturias-en-familia-ES.pdf",
    location: "central",
    duration: "weekend",
  },
];

// For backward compatibility
export const STORIES = FALLBACK_STORIES;

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
