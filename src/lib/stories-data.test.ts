import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  STORIES,
  FALLBACK_STORIES,
  getStoriesByCategory,
  getStoriesByLocation,
  getStoriesByDuration,
  getAllCategories,
  getAllLocations,
  getAllDurations,
  storyToRow,
  getStoriesFromDB,
  getStoriesByCategoryFromDB,
  getStoriesByLocationFromDB,
  getStoriesByDurationFromDB,
  getStoryBySlugFromDB,
} from "./stories-data";
import { supabase } from "./supabase";

// Mock supabase
vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const mockSupabaseFrom = supabase.from as ReturnType<typeof vi.fn>;

// Sample database row data
const mockStoryRow = {
  id: "test-uuid",
  slug: "test-story",
  title: "Test Story",
  subtitle: "Test Subtitle",
  description: "Test description",
  image_path: "/images/test.png",
  category: "nature",
  source_pdf: "test.pdf",
  location: "central",
  duration: "day-trip",
  display_order: 1,
  is_active: true,
  related_stories: null,
  metadata: {},
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

describe("stories-data", () => {
  describe("STORIES and FALLBACK_STORIES", () => {
    it("should have at least one story", () => {
      expect(STORIES.length).toBeGreaterThan(0);
      expect(FALLBACK_STORIES.length).toBeGreaterThan(0);
    });

    it("should have STORIES equal to FALLBACK_STORIES", () => {
      expect(STORIES).toEqual(FALLBACK_STORIES);
    });

    it("should have valid story structure", () => {
      STORIES.forEach((story) => {
        expect(story.id).toBeDefined();
        expect(story.title).toBeDefined();
        expect(story.subtitle).toBeDefined();
        expect(story.description).toBeDefined();
        expect(story.image).toBeDefined();
        expect(story.category).toBeDefined();
        expect(story.sourcePdf).toBeDefined();
      });
    });

    it("should have unique story IDs", () => {
      const ids = STORIES.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should have location for all stories", () => {
      FALLBACK_STORIES.forEach((story) => {
        expect(story.location).toBeDefined();
        expect(["eastern", "central", "western"]).toContain(story.location);
      });
    });

    it("should have duration for all stories", () => {
      FALLBACK_STORIES.forEach((story) => {
        expect(story.duration).toBeDefined();
        expect(["day-trip", "weekend", "week"]).toContain(story.duration);
      });
    });
  });

  describe("getStoriesByCategory", () => {
    it("should return all stories when category is null", () => {
      const result = getStoriesByCategory(null);
      expect(result).toEqual(FALLBACK_STORIES);
    });

    it("should filter stories by nature category", () => {
      const result = getStoriesByCategory("nature");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.category).toBe("nature");
      });
    });

    it("should filter stories by cities category", () => {
      const result = getStoriesByCategory("cities");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.category).toBe("cities");
      });
    });

    it("should filter stories by food category", () => {
      const result = getStoriesByCategory("food");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.category).toBe("food");
      });
    });

    it("should filter stories by culture category", () => {
      const result = getStoriesByCategory("culture");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.category).toBe("culture");
      });
    });

    it("should filter stories by activities category", () => {
      const result = getStoriesByCategory("activities");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.category).toBe("activities");
      });
    });
  });

  describe("getStoriesByLocation", () => {
    it("should return all stories when location is null", () => {
      const result = getStoriesByLocation(null);
      expect(result).toEqual(FALLBACK_STORIES);
    });

    it("should filter stories by eastern location", () => {
      const result = getStoriesByLocation("eastern");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.location).toBe("eastern");
      });
    });

    it("should filter stories by central location", () => {
      const result = getStoriesByLocation("central");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.location).toBe("central");
      });
    });

    it("should filter stories by western location", () => {
      const result = getStoriesByLocation("western");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.location).toBe("western");
      });
    });
  });

  describe("getStoriesByDuration", () => {
    it("should return all stories when duration is null", () => {
      const result = getStoriesByDuration(null);
      expect(result).toEqual(FALLBACK_STORIES);
    });

    it("should filter stories by day-trip duration", () => {
      const result = getStoriesByDuration("day-trip");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.duration).toBe("day-trip");
      });
    });

    it("should filter stories by weekend duration", () => {
      const result = getStoriesByDuration("weekend");
      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => {
        expect(story.duration).toBe("weekend");
      });
    });
  });

  describe("getAllCategories", () => {
    it("should return all valid categories", () => {
      const categories = getAllCategories();
      expect(categories).toContain("nature");
      expect(categories).toContain("cities");
      expect(categories).toContain("food");
      expect(categories).toContain("culture");
      expect(categories).toContain("activities");
    });

    it("should return exactly 5 categories", () => {
      const categories = getAllCategories();
      expect(categories.length).toBe(5);
    });
  });

  describe("getAllLocations", () => {
    it("should return all valid locations", () => {
      const locations = getAllLocations();
      expect(locations).toContain("eastern");
      expect(locations).toContain("central");
      expect(locations).toContain("western");
    });

    it("should return exactly 3 locations", () => {
      const locations = getAllLocations();
      expect(locations.length).toBe(3);
    });
  });

  describe("getAllDurations", () => {
    it("should return all valid durations", () => {
      const durations = getAllDurations();
      expect(durations).toContain("day-trip");
      expect(durations).toContain("weekend");
      expect(durations).toContain("week");
    });

    it("should return exactly 3 durations", () => {
      const durations = getAllDurations();
      expect(durations.length).toBe(3);
    });
  });

  describe("storyToRow", () => {
    it("should convert a Story to database row format", () => {
      const story = FALLBACK_STORIES[0];
      const row = storyToRow(story, 5);

      expect(row.slug).toBe(story.slug || story.id);
      expect(row.title).toBe(story.title);
      expect(row.subtitle).toBe(story.subtitle);
      expect(row.description).toBe(story.description);
      expect(row.image_path).toBe(story.image);
      expect(row.category).toBe(story.category);
      expect(row.source_pdf).toBe(story.sourcePdf);
      expect(row.location).toBe(story.location);
      expect(row.duration).toBe(story.duration);
      expect(row.display_order).toBe(5);
      expect(row.is_active).toBe(true);
    });

    it("should use story displayOrder if provided", () => {
      const story = { ...FALLBACK_STORIES[0], displayOrder: 10 };
      const row = storyToRow(story, 5);
      expect(row.display_order).toBe(10);
    });

    it("should handle missing optional fields", () => {
      const story = {
        id: "test",
        title: "Test",
        subtitle: "",
        description: "",
        image: "",
        category: "nature" as const,
        sourcePdf: "",
      };
      const row = storyToRow(story);

      expect(row.slug).toBe("test");
      expect(row.subtitle).toBeNull();
      expect(row.description).toBeNull();
      expect(row.image_path).toBeNull();
      expect(row.source_pdf).toBeNull();
      expect(row.location).toBeNull();
      expect(row.duration).toBeNull();
      expect(row.display_order).toBe(0);
    });
  });

  describe("getStoriesFromDB", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return stories from database when successful", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [mockStoryRow], error: null }),
        }),
      });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesFromDB();

      expect(result.length).toBe(1);
      expect(result[0].title).toBe("Test Story");
      expect(result[0].slug).toBe("test-story");
    });

    it("should return fallback stories on database error", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB Error" } }),
        }),
      });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesFromDB();

      expect(result).toEqual(FALLBACK_STORIES);
    });

    it("should return fallback stories when data is empty", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesFromDB();

      expect(result).toEqual(FALLBACK_STORIES);
    });

    it("should return fallback stories on exception", async () => {
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      const result = await getStoriesFromDB();

      expect(result).toEqual(FALLBACK_STORIES);
    });
  });

  describe("getStoriesByCategoryFromDB", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call getStoriesFromDB when category is null", async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [mockStoryRow], error: null }),
        }),
      });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByCategoryFromDB(null);

      expect(result.length).toBe(1);
    });

    it("should return stories filtered by category from database", async () => {
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [mockStoryRow], error: null }),
        }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByCategoryFromDB("nature");

      expect(result.length).toBe(1);
      expect(result[0].category).toBe("nature");
    });

    it("should return filtered fallback stories on error", async () => {
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "Error" } }),
        }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByCategoryFromDB("nature");

      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => expect(story.category).toBe("nature"));
    });

    it("should return filtered fallback stories when data is empty", async () => {
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByCategoryFromDB("nature");

      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => expect(story.category).toBe("nature"));
    });

    it("should return filtered fallback stories on exception", async () => {
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      const result = await getStoriesByCategoryFromDB("nature");

      result.forEach((story) => expect(story.category).toBe("nature"));
    });
  });

  describe("getStoriesByLocationFromDB", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return stories filtered by location from database", async () => {
      const locationRow = { ...mockStoryRow, location: "eastern" };
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [locationRow], error: null }),
        }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByLocationFromDB("eastern");

      expect(result.length).toBe(1);
      expect(result[0].location).toBe("eastern");
    });

    it("should return filtered fallback stories on error", async () => {
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "Error" } }),
        }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByLocationFromDB("eastern");

      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => expect(story.location).toBe("eastern"));
    });

    it("should return filtered fallback stories when data is empty", async () => {
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByLocationFromDB("western");

      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => expect(story.location).toBe("western"));
    });

    it("should return filtered fallback stories on exception", async () => {
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      const result = await getStoriesByLocationFromDB("central");

      result.forEach((story) => expect(story.location).toBe("central"));
    });
  });

  describe("getStoriesByDurationFromDB", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return stories filtered by duration from database", async () => {
      const durationRow = { ...mockStoryRow, duration: "weekend" };
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [durationRow], error: null }),
        }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByDurationFromDB("weekend");

      expect(result.length).toBe(1);
      expect(result[0].duration).toBe("weekend");
    });

    it("should return filtered fallback stories on error", async () => {
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "Error" } }),
        }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByDurationFromDB("day-trip");

      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => expect(story.duration).toBe("day-trip"));
    });

    it("should return filtered fallback stories when data is empty", async () => {
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoriesByDurationFromDB("day-trip");

      expect(result.length).toBeGreaterThan(0);
      result.forEach((story) => expect(story.duration).toBe("day-trip"));
    });

    it("should return filtered fallback stories on exception", async () => {
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      const result = await getStoriesByDurationFromDB("weekend");

      result.forEach((story) => expect(story.duration).toBe("weekend"));
    });
  });

  describe("getStoryBySlugFromDB", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return story from database when found", async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: mockStoryRow, error: null });
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoryBySlugFromDB("test-story");

      expect(result).not.toBeNull();
      expect(result?.slug).toBe("test-story");
    });

    it("should return fallback story on database error", async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } });
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoryBySlugFromDB("lagos-covadonga");

      expect(result).not.toBeNull();
      expect(result?.slug).toBe("lagos-covadonga");
    });

    it("should return null when story not found in fallback", async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } });
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoryBySlugFromDB("non-existent-slug");

      expect(result).toBeNull();
    });

    it("should return null when data is null", async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockSupabaseFrom.mockReturnValue({ select: mockSelect });

      const result = await getStoryBySlugFromDB("test");

      expect(result).toBeNull();
    });

    it("should return fallback story on exception", async () => {
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      const result = await getStoryBySlugFromDB("fabada");

      expect(result).not.toBeNull();
      expect(result?.slug).toBe("fabada");
    });

    it("should find fallback story by id when slug doesnt match", async () => {
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error("Connection failed");
      });

      // Use the id field which matches
      const result = await getStoryBySlugFromDB("oviedo-catedral");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("oviedo-catedral");
    });
  });
});
