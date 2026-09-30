/**
 * Content Discovery Agent
 *
 * Discovers new Asturias places via Google Places API, generates
 * descriptions with Claude, and creates pending story drafts for
 * admin review.
 *
 * Refs #41
 */

import type { StoryCategory } from "@/types/immersive";
import { getPlaceholderForStory } from "@/lib/unsplash-placeholders";
import { logger } from "@/lib/logger";
import { CHAT_MODEL } from "@/lib/models";
import { recordAnthropicUsageInBackground } from "@/lib/costs/anthropic-usage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal Supabase client interface for dependency injection in tests */
export interface DiscoverySupabaseClient {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{
      data: Array<{ title: string; slug: string }> | null;
      error: unknown;
    }>;
    insert: (rows: StoryDraft[]) => {
      select: (columns: string) => PromiseLike<{
        data: Array<{ id: string; title: string; slug: string; category: string }> | null;
        error: unknown;
      }>;
    };
  };
}

/** A Google Places result relevant to our needs */
interface PlaceResult {
  name: string;
  address: string;
  types: string[];
  rating: number | null;
  placeId: string;
}

/** Row shape for inserting into the stories table */
export interface StoryDraft {
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  category: StoryCategory;
  image_path: string;
  image_source: string;
  source_pdf: string;
  source_type: "agent_discovered";
  curation_status: "needs_curation";
  is_active: false;
  display_order: number;
  metadata: Record<string, unknown>;
}

interface DiscoveryResult {
  discovered: number;
  created: number;
  skippedDuplicates: number;
  errors: string[];
  stories: Array<{ id: string; title: string; slug: string; category: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_DISCOVERIES_PER_RUN = 5;

/**
 * Diverse search queries to rotate through, covering all categories.
 * Each run picks one at random for variety.
 */
export const DISCOVERY_QUERIES = [
  "playas secretas Asturias",
  "rutas de senderismo Asturias",
  "monumentos históricos Asturias",
  "miradores panorámicos Asturias",
  "pueblos con encanto Asturias",
  "museos Asturias",
  "restaurantes típicos sidrería Asturias",
  "cascadas y ríos Asturias",
  "cuevas prehistóricas Asturias",
  "Picos de Europa rutas",
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Generate a URL-safe slug from a title.
 * Handles Spanish diacritics and special characters.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Normalize a place name for comparison: lowercase, strip diacritics,
 * collapse whitespace.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/\s+/g, " ");
}

/**
 * Check whether a candidate place name duplicates an existing story.
 * Uses normalized name comparison, slug match, and substring containment.
 */
export function isDuplicate(
  candidateName: string,
  existingStories: Array<{ title: string; slug: string }>
): boolean {
  const normalized = normalizeName(candidateName);
  const candidateSlug = generateSlug(candidateName);

  for (const story of existingStories) {
    const existingNormalized = normalizeName(story.title);

    // Exact normalized match
    if (normalized === existingNormalized) return true;

    // Slug match
    if (candidateSlug === story.slug) return true;

    // Substring containment (either direction, min 4 chars to avoid false positives)
    if (normalized.length >= 4 && existingNormalized.includes(normalized)) return true;
    if (existingNormalized.length >= 4 && normalized.includes(existingNormalized)) return true;
  }

  return false;
}

/**
 * Infer a StoryCategory from Google Places API type strings.
 */
export function inferCategory(types: string[]): StoryCategory {
  const typeSet = new Set(types);

  // Nature indicators
  const natureTypes = ["park", "natural_feature", "campground", "beach"];
  if (natureTypes.some((t) => typeSet.has(t))) return "nature";

  // Food indicators
  const foodTypes = ["restaurant", "cafe", "bar", "bakery", "food", "meal_delivery", "meal_takeaway"];
  if (foodTypes.some((t) => typeSet.has(t))) return "food";

  // Culture indicators
  const cultureTypes = ["museum", "art_gallery", "church", "place_of_worship", "library"];
  if (cultureTypes.some((t) => typeSet.has(t))) return "culture";

  // Cities indicators
  const cityTypes = ["locality", "administrative_area_level_1", "administrative_area_level_2"];
  if (cityTypes.some((t) => typeSet.has(t))) return "cities";

  // Activities (catch-all, includes tourist_attraction, amusement_park, etc.)
  return "activities";
}

// ---------------------------------------------------------------------------
// External API calls
// ---------------------------------------------------------------------------

/**
 * Search Google Places API (New) for interesting places in Asturias.
 */
export async function searchPlaces(
  query: string,
  apiKey: string
): Promise<PlaceResult[]> {
  const ASTURIAS_CENTER = { lat: 43.3619, lng: -5.8494 };
  const RADIUS = 50000; // 50km

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.types,places.rating,places.location",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "es",
        maxResultCount: 10,
        locationBias: {
          circle: {
            center: {
              latitude: ASTURIAS_CENTER.lat,
              longitude: ASTURIAS_CENTER.lng,
            },
            radius: RADIUS,
          },
        },
      }),
      signal: AbortSignal.timeout(8_000),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Places API error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  if (!data.places?.length) return [];

  return data.places.map(
    (p: {
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      types?: string[];
      rating?: number;
    }): PlaceResult => ({
      name: p.displayName?.text || "Unknown",
      address: p.formattedAddress || "",
      types: p.types || [],
      rating: p.rating ?? null,
      placeId: p.id,
    })
  );
}

/**
 * Generate a tourism description in Spanish using Claude.
 */
export async function generateDescription(
  placeName: string,
  apiKey: string
): Promise<string> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Escribe una descripción turística breve (2-3 frases) en español sobre "${placeName}" en Asturias, España. Debe ser atractiva para visitantes. Solo el texto, sin comillas ni encabezados.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    recordAnthropicUsageInBackground({ model: CHAT_MODEL, usage: data.usage, source: "content_discovery" });
    const text = data.content?.[0]?.text;
    if (text) return text.trim();
  } catch (error) {
    logger.error("[TABLE_FALLBACK]", { table: "content_discovery_description", error: error instanceof Error ? error.message : String(error) });
  }

  // Fallback description
  return `Descubre ${placeName}, un lugar especial en Asturias que merece ser explorado.`;
}

// ---------------------------------------------------------------------------
// Story draft builder
// ---------------------------------------------------------------------------

export function buildStoryDraft(params: {
  name: string;
  description: string;
  category: StoryCategory;
  placeId?: string;
  address?: string;
  rating?: number | null;
}): StoryDraft {
  const slug = generateSlug(params.name);
  const placeholder = getPlaceholderForStory(slug, params.category);

  return {
    title: params.name,
    slug,
    subtitle: "",
    description: params.description,
    category: params.category,
    image_path: placeholder.image,
    image_source: placeholder.imageSource,
    source_pdf: "",
    source_type: "agent_discovered",
    curation_status: "needs_curation",
    is_active: false,
    display_order: 9000 + Math.floor(Math.random() * 1000),
    metadata: {
      discovery_source: "google_places",
      place_id: params.placeId || null,
      address: params.address || null,
      rating: params.rating ?? null,
      discovered_at: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Main discovery pipeline
// ---------------------------------------------------------------------------

export async function runDiscovery(deps: {
  supabase: DiscoverySupabaseClient;
  googleApiKey: string;
  anthropicApiKey: string;
}): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    discovered: 0,
    created: 0,
    skippedDuplicates: 0,
    errors: [],
    stories: [],
  };

  // 1. Fetch existing stories to check for duplicates
  const { data: existingStories, error: fetchError } = await deps.supabase
    .from("stories")
    .select("title, slug");

  if (fetchError) {
    result.errors.push(`Failed to fetch existing stories: ${String(fetchError)}`);
    return result;
  }

  const existing = existingStories || [];

  // 2. Pick a random query for variety
  const query = DISCOVERY_QUERIES[Math.floor(Math.random() * DISCOVERY_QUERIES.length)];

  // 3. Search Google Places
  let places: PlaceResult[];
  try {
    places = await searchPlaces(query, deps.googleApiKey);
  } catch (error) {
    result.errors.push(`Google Places search failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }

  result.discovered = places.length;

  if (places.length === 0) {
    return result;
  }

  // 4. Filter out duplicates
  const newPlaces: PlaceResult[] = [];
  for (const place of places) {
    if (isDuplicate(place.name, existing)) {
      result.skippedDuplicates++;
    } else {
      newPlaces.push(place);
    }
  }

  // 5. Limit to MAX_DISCOVERIES_PER_RUN
  const toProcess = newPlaces.slice(0, MAX_DISCOVERIES_PER_RUN);

  if (toProcess.length === 0) {
    return result;
  }

  // 6. Generate descriptions and build drafts
  const drafts: StoryDraft[] = [];
  for (const place of toProcess) {
    try {
      const description = await generateDescription(place.name, deps.anthropicApiKey);
      const category = inferCategory(place.types);
      const draft = buildStoryDraft({
        name: place.name,
        description,
        category,
        placeId: place.placeId,
        address: place.address,
        rating: place.rating,
      });
      drafts.push(draft);
    } catch (error) {
      result.errors.push(
        `Failed to process "${place.name}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  if (drafts.length === 0) {
    return result;
  }

  // 7. Insert into database
  const { data: insertedStories, error: insertError } = await deps.supabase
    .from("stories")
    .insert(drafts)
    .select("id, title, slug, category");

  if (insertError) {
    result.errors.push(`Failed to insert stories: ${String(insertError)}`);
    return result;
  }

  result.created = insertedStories?.length || 0;
  result.stories = insertedStories || [];

  return result;
}
