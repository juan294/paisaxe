import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  generateSlug,
  normalizeName,
  isDuplicate,
  inferCategory,
  buildStoryDraft,
  searchPlaces,
  generateDescription,
  runDiscovery,
  MAX_DISCOVERIES_PER_RUN,
  DISCOVERY_QUERIES,
  type DiscoverySupabaseClient,
} from "./content-discovery";

// ---------------------------------------------------------------------------
// generateSlug
// ---------------------------------------------------------------------------
describe("generateSlug", () => {
  it("converts title to lowercase kebab-case", () => {
    expect(generateSlug("Playa de Gulpiyuri")).toBe("playa-de-gulpiyuri");
  });

  it("handles Spanish diacritics (accents and ñ)", () => {
    expect(generateSlug("Señorío de Cañón")).toBe("senorio-de-canon");
  });

  it("removes non-alphanumeric characters", () => {
    expect(generateSlug("¡Hola, Asturias!")).toBe("hola-asturias");
  });

  it("collapses multiple spaces/hyphens", () => {
    expect(generateSlug("Ruta  del   Cares")).toBe("ruta-del-cares");
    expect(generateSlug("Ruta--del---Cares")).toBe("ruta-del-cares");
  });

  it("trims leading/trailing hyphens", () => {
    expect(generateSlug("--test--")).toBe("test");
  });

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// normalizeName
// ---------------------------------------------------------------------------
describe("normalizeName", () => {
  it("lowercases and trims whitespace", () => {
    expect(normalizeName("  Playa de Gulpiyuri  ")).toBe("playa de gulpiyuri");
  });

  it("strips diacritics", () => {
    expect(normalizeName("Señorío de Cañón")).toBe("senorio de canon");
  });

  it("collapses whitespace", () => {
    expect(normalizeName("Ruta  del   Cares")).toBe("ruta del cares");
  });
});

// ---------------------------------------------------------------------------
// isDuplicate
// ---------------------------------------------------------------------------
describe("isDuplicate", () => {
  const existing = [
    { title: "Playa de Gulpiyuri", slug: "playa-de-gulpiyuri" },
    { title: "Covadonga Lakes", slug: "covadonga-lakes" },
    { title: "Senda del Oso", slug: "senda-del-oso" },
  ];

  it("detects exact title match", () => {
    expect(isDuplicate("Playa de Gulpiyuri", existing)).toBe(true);
  });

  it("detects case-insensitive match", () => {
    expect(isDuplicate("playa de gulpiyuri", existing)).toBe(true);
  });

  it("detects slug match", () => {
    expect(isDuplicate("Playa de Gulpiyuri!", existing)).toBe(true);
  });

  it("detects partial name containment (existing contains candidate)", () => {
    expect(isDuplicate("Gulpiyuri", existing)).toBe(true);
  });

  it("detects partial name containment (candidate contains existing)", () => {
    expect(isDuplicate("Los Lagos de Covadonga Lakes en Asturias", existing)).toBe(true);
  });

  it("returns false for genuinely new places", () => {
    expect(isDuplicate("Museo de Bellas Artes de Asturias", existing)).toBe(false);
  });

  it("returns false for empty existing list", () => {
    expect(isDuplicate("Anything", [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inferCategory
// ---------------------------------------------------------------------------
describe("inferCategory", () => {
  it("infers 'nature' from nature types", () => {
    expect(inferCategory(["park", "natural_feature"])).toBe("nature");
  });

  it("infers 'food' from restaurant types", () => {
    expect(inferCategory(["restaurant", "food"])).toBe("food");
  });

  it("infers 'culture' from museum types", () => {
    expect(inferCategory(["museum", "art_gallery"])).toBe("culture");
  });

  it("infers 'cities' from locality types", () => {
    expect(inferCategory(["locality", "political"])).toBe("cities");
  });

  it("infers 'activities' from sport-related types", () => {
    expect(inferCategory(["tourist_attraction", "amusement_park"])).toBe("activities");
  });

  it("defaults to 'activities' for unknown types", () => {
    expect(inferCategory(["unknown_type"])).toBe("activities");
  });

  it("defaults to 'activities' for empty array", () => {
    expect(inferCategory([])).toBe("activities");
  });
});

// ---------------------------------------------------------------------------
// buildStoryDraft
// ---------------------------------------------------------------------------
describe("buildStoryDraft", () => {
  it("builds a complete story draft", () => {
    const draft = buildStoryDraft({
      name: "Playa de Gulpiyuri",
      description: "A hidden inland beach",
      category: "nature",
    });

    expect(draft.title).toBe("Playa de Gulpiyuri");
    expect(draft.slug).toBe("playa-de-gulpiyuri");
    expect(draft.subtitle).toBe("");
    expect(draft.description).toBe("A hidden inland beach");
    expect(draft.category).toBe("nature");
    expect(draft.source_type).toBe("agent_discovered");
    expect(draft.curation_status).toBe("needs_curation");
    expect(draft.is_active).toBe(false);
    expect(draft.image_path).toContain("unsplash.com");
    expect(draft.image_source).toContain("unsplash-placeholder:");
    expect(draft.source_pdf).toBe("");
    expect(draft.metadata).toBeDefined();
    expect(draft.metadata.discovery_source).toBe("google_places");
    expect(typeof draft.display_order).toBe("number");
  });

  it("uses display_order starting at 9000", () => {
    const draft = buildStoryDraft({
      name: "Test Place",
      description: "Test",
      category: "activities",
    });
    expect(draft.display_order).toBeGreaterThanOrEqual(9000);
  });
});

// ---------------------------------------------------------------------------
// searchPlaces (mocked fetch)
// ---------------------------------------------------------------------------
describe("searchPlaces", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("returns place results from Google Places API", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        places: [
          {
            id: "place_1",
            displayName: { text: "Playa de Gulpiyuri", languageCode: "es" },
            formattedAddress: "Llanes, Asturias",
            types: ["natural_feature", "beach"],
            rating: 4.5,
            location: { latitude: 43.4, longitude: -4.8 },
          },
          {
            id: "place_2",
            displayName: { text: "Bufones de Pría", languageCode: "es" },
            formattedAddress: "Llanes, Asturias",
            types: ["natural_feature"],
            rating: 4.7,
            location: { latitude: 43.4, longitude: -4.9 },
          },
        ],
      }),
    });

    const results = await searchPlaces("playas asturias", "test-api-key");
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("Playa de Gulpiyuri");
    expect(results[0].types).toContain("natural_feature");
    expect(results[1].name).toBe("Bufones de Pría");
  });

  it("returns empty array when API returns no places", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const results = await searchPlaces("nonexistent query", "test-api-key");
    expect(results).toEqual([]);
  });

  it("throws on API error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    await expect(searchPlaces("test", "bad-key")).rejects.toThrow("Places API error");
  });
});

// ---------------------------------------------------------------------------
// generateDescription (mocked fetch)
// ---------------------------------------------------------------------------
describe("generateDescription", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Claude-generated description", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "Una playa escondida en el interior de Asturias." }],
      }),
    });

    const result = await generateDescription("Playa de Gulpiyuri", "test-key");
    expect(result).toBe("Una playa escondida en el interior de Asturias.");
  });

  it("returns fallback on API error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Server error",
    });

    const result = await generateDescription("Playa de Gulpiyuri", "test-key");
    expect(result).toContain("Playa de Gulpiyuri");
    expect(result).toContain("Asturias");
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe("DISCOVERY_QUERIES", () => {
  it("has at least 5 diverse queries", () => {
    expect(DISCOVERY_QUERIES.length).toBeGreaterThanOrEqual(5);
  });

  it("all queries mention Asturias or related terms", () => {
    for (const query of DISCOVERY_QUERIES) {
      const lower = query.toLowerCase();
      const hasRelevantTerm =
        lower.includes("asturias") ||
        lower.includes("picos de europa") ||
        lower.includes("senda") ||
        lower.includes("sidra") ||
        lower.includes("camino");
      expect(hasRelevantTerm).toBe(true);
    }
  });
});

describe("MAX_DISCOVERIES_PER_RUN", () => {
  it("is between 3 and 5", () => {
    expect(MAX_DISCOVERIES_PER_RUN).toBeGreaterThanOrEqual(3);
    expect(MAX_DISCOVERIES_PER_RUN).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// runDiscovery (integration-level with mocked dependencies)
// ---------------------------------------------------------------------------
function createMockSupabase(existingStories: Array<{ title: string; slug: string }> = []): DiscoverySupabaseClient {
  return {
    from: (table: string) => ({
      select: (_columns: string) => {
        if (table === "stories") {
          return Promise.resolve({ data: existingStories, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
      insert: (rows: unknown[]) => ({
        select: (_columns: string) =>
          Promise.resolve({
            data: (rows as Array<Record<string, unknown>>).map((r, i) => ({
              id: `uuid-${i}`,
              title: r.title,
              slug: r.slug,
              category: r.category,
            })),
            error: null,
          }),
      }),
    }),
  } as unknown as DiscoverySupabaseClient;
}

describe("runDiscovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("discovers new places and creates story drafts", async () => {
    let fetchCallCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("places.googleapis.com")) {
        return {
          ok: true,
          json: async () => ({
            places: [
              {
                id: "place_1",
                displayName: { text: "Playa de Torimbia", languageCode: "es" },
                formattedAddress: "Llanes, Asturias",
                types: ["natural_feature"],
                rating: 4.6,
                location: { latitude: 43.4, longitude: -4.8 },
              },
              {
                id: "place_2",
                displayName: { text: "Museo Jurásico", languageCode: "es" },
                formattedAddress: "Colunga, Asturias",
                types: ["museum"],
                rating: 4.3,
                location: { latitude: 43.4, longitude: -5.2 },
              },
            ],
          }),
        };
      }
      fetchCallCount++;
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: `Descripción de lugar ${fetchCallCount}` }],
        }),
      };
    });

    const mockSupabase = createMockSupabase([]);
    const result = await runDiscovery({
      supabase: mockSupabase,
      googleApiKey: "test-google-key",
      anthropicApiKey: "test-anthropic-key",
    });

    expect(result.discovered).toBeGreaterThan(0);
    expect(result.created).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(result.stories.length).toBe(result.created);
  });

  it("skips duplicates", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("places.googleapis.com")) {
        return {
          ok: true,
          json: async () => ({
            places: [
              {
                id: "place_1",
                displayName: { text: "Playa de Gulpiyuri", languageCode: "es" },
                formattedAddress: "Llanes, Asturias",
                types: ["natural_feature"],
                rating: 4.5,
                location: { latitude: 43.4, longitude: -4.8 },
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "Description" }],
        }),
      };
    });

    const mockSupabase = createMockSupabase([
      { title: "Playa de Gulpiyuri", slug: "playa-de-gulpiyuri" },
    ]);

    const result = await runDiscovery({
      supabase: mockSupabase,
      googleApiKey: "test-google-key",
      anthropicApiKey: "test-anthropic-key",
    });

    expect(result.skippedDuplicates).toBe(1);
    expect(result.created).toBe(0);
  });

  it("handles Google API failure gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Server Error",
    });

    const mockSupabase = createMockSupabase([]);
    const result = await runDiscovery({
      supabase: mockSupabase,
      googleApiKey: "test-google-key",
      anthropicApiKey: "test-anthropic-key",
    });

    expect(result.discovered).toBe(0);
    expect(result.created).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("respects MAX_DISCOVERIES_PER_RUN limit", async () => {
    const places = Array.from({ length: 10 }, (_, i) => ({
      id: `place_${i}`,
      displayName: { text: `Place ${i}`, languageCode: "es" },
      formattedAddress: "Asturias",
      types: ["tourist_attraction"],
      rating: 4.0,
      location: { latitude: 43.3 + i * 0.01, longitude: -5.8 },
    }));

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.includes("places.googleapis.com")) {
        return {
          ok: true,
          json: async () => ({ places }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          content: [{ type: "text", text: "A place in Asturias." }],
        }),
      };
    });

    const mockSupabase = createMockSupabase([]);
    const result = await runDiscovery({
      supabase: mockSupabase,
      googleApiKey: "test-google-key",
      anthropicApiKey: "test-anthropic-key",
    });

    expect(result.created).toBeLessThanOrEqual(MAX_DISCOVERIES_PER_RUN);
  });

  it("handles empty Google Places response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const mockSupabase = createMockSupabase([]);
    const result = await runDiscovery({
      supabase: mockSupabase,
      googleApiKey: "test-google-key",
      anthropicApiKey: "test-anthropic-key",
    });

    expect(result.discovered).toBe(0);
    expect(result.created).toBe(0);
    expect(result.stories).toHaveLength(0);
  });
});
