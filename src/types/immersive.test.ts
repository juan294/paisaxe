import { describe, it, expect } from "vitest";
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
  DURATION_LABELS,
  PUBLIC_STORY_SELECT,
  publicStoryToStory,
  VALID_CATEGORIES,
  rowToPublicStory,
  rowToStory,
  toPublicStory,
  type Story,
  type StoryCategory,
  type StoryLocation,
  type StoryDuration,
  type PublicStoryRow,
  type StoryRow,
} from "./immersive";

describe("immersive types", () => {
  describe("CATEGORY_LABELS", () => {
    it("should have all category labels defined", () => {
      expect(CATEGORY_LABELS.nature).toBe("Naturaleza");
      expect(CATEGORY_LABELS.cities).toBe("Ciudades");
      expect(CATEGORY_LABELS.food).toBe("Gastronomía");
      expect(CATEGORY_LABELS.culture).toBe("Cultura");
      expect(CATEGORY_LABELS.activities).toBe("Actividades");
    });

    it("should have exactly 5 categories", () => {
      expect(Object.keys(CATEGORY_LABELS)).toHaveLength(5);
    });

    it("should have correct keys", () => {
      const categories: StoryCategory[] = [
        "nature",
        "cities",
        "food",
        "culture",
        "activities",
      ];
      categories.forEach((cat) => {
        expect(CATEGORY_LABELS[cat]).toBeDefined();
      });
    });
  });

  describe("LOCATION_LABELS", () => {
    it("should have all location labels defined", () => {
      expect(LOCATION_LABELS.eastern).toBe("Asturias Oriental");
      expect(LOCATION_LABELS.central).toBe("Asturias Central");
      expect(LOCATION_LABELS.western).toBe("Asturias Occidental");
    });

    it("should have exactly 3 locations", () => {
      expect(Object.keys(LOCATION_LABELS)).toHaveLength(3);
    });

    it("should have correct keys", () => {
      const locations: StoryLocation[] = ["eastern", "central", "western"];
      locations.forEach((loc) => {
        expect(LOCATION_LABELS[loc]).toBeDefined();
      });
    });
  });

  describe("DURATION_LABELS", () => {
    it("should have all duration labels defined", () => {
      expect(DURATION_LABELS["day-trip"]).toBe("Excursión de un día");
      expect(DURATION_LABELS.weekend).toBe("Fin de semana");
      expect(DURATION_LABELS.week).toBe("Una semana");
    });

    it("should have exactly 3 durations", () => {
      expect(Object.keys(DURATION_LABELS)).toHaveLength(3);
    });

    it("should have correct keys", () => {
      const durations: StoryDuration[] = ["day-trip", "weekend", "week"];
      durations.forEach((dur) => {
        expect(DURATION_LABELS[dur]).toBeDefined();
      });
    });
  });

  describe("VALID_CATEGORIES", () => {
    it("should contain all 5 story categories", () => {
      expect(VALID_CATEGORIES).toHaveLength(5);
    });

    it("should contain exactly the same categories as CATEGORY_LABELS keys", () => {
      const labelKeys = Object.keys(CATEGORY_LABELS) as StoryCategory[];
      expect(VALID_CATEGORIES).toEqual(expect.arrayContaining(labelKeys));
      expect(labelKeys).toEqual(expect.arrayContaining([...VALID_CATEGORIES]));
    });

    it("should include all expected category values", () => {
      expect(VALID_CATEGORIES).toContain("nature");
      expect(VALID_CATEGORIES).toContain("cities");
      expect(VALID_CATEGORIES).toContain("food");
      expect(VALID_CATEGORIES).toContain("culture");
      expect(VALID_CATEGORIES).toContain("activities");
    });
  });

  describe("Story type", () => {
    it("should allow valid Story objects", () => {
      const story: Story = {
        id: "test-1",
        title: "Test Story",
        subtitle: "A test subtitle",
        description: "This is a test description",
        image: "/images/test.jpg",
        category: "nature",
        sourcePdf: "test.pdf",
      };

      expect(story.id).toBe("test-1");
      expect(story.title).toBe("Test Story");
      expect(story.subtitle).toBe("A test subtitle");
      expect(story.description).toBe("This is a test description");
      expect(story.image).toBe("/images/test.jpg");
      expect(story.category).toBe("nature");
      expect(story.sourcePdf).toBe("test.pdf");
    });

    it("should allow Story with optional location and duration", () => {
      const story: Story = {
        id: "test-2",
        slug: "test-2-slug",
        title: "Test Story 2",
        subtitle: "Subtitle",
        description: "Description",
        image: "/images/test.jpg",
        category: "cities",
        sourcePdf: "test.pdf",
        location: "eastern",
        duration: "weekend",
        displayOrder: 1,
        relatedStories: ["story-1", "story-2"],
      };

      expect(story.location).toBe("eastern");
      expect(story.duration).toBe("weekend");
      expect(story.displayOrder).toBe(1);
      expect(story.relatedStories).toEqual(["story-1", "story-2"]);
    });
  });

  describe("rowToStory", () => {
    it("should convert a database row to Story interface", () => {
      const row: StoryRow = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        slug: "test-story",
        title: "Test Story",
        subtitle: "Test Subtitle",
        description: "Test Description",
        image_path: "https://example.com/image.jpg",
        image_source: "Photo by Test on Unsplash",
        blur_data_url: null,
        category: "nature",
        source_pdf: "test.pdf",
        location: "eastern",
        duration: "day-trip",
        display_order: 5,
        is_active: true,
        related_stories: ["story-1", "story-2"],
        metadata: {},
        best_months: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        source_type: null,
        suggestion_id: null,
      };

      const story = rowToStory(row);

      expect(story.id).toBe(row.id);
      expect(story.slug).toBe("test-story");
      expect(story.title).toBe("Test Story");
      expect(story.subtitle).toBe("Test Subtitle");
      expect(story.description).toBe("Test Description");
      expect(story.image).toBe("https://example.com/image.jpg");
      expect(story.category).toBe("nature");
      expect(story.sourcePdf).toBe("test.pdf");
      expect(story.location).toBe("eastern");
      expect(story.duration).toBe("day-trip");
      expect(story.displayOrder).toBe(5);
      expect(story.relatedStories).toEqual(["story-1", "story-2"]);
    });

    it("should handle null values in database row", () => {
      const row: StoryRow = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        slug: "test-story",
        title: "Test Story",
        subtitle: null,
        description: null,
        image_path: null,
        image_source: null,
        blur_data_url: null,
        category: "nature",
        source_pdf: null,
        location: null,
        duration: null,
        display_order: 0,
        is_active: true,
        related_stories: null,
        metadata: {},
        best_months: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        source_type: null,
        suggestion_id: null,
      };

      const story = rowToStory(row);

      expect(story.subtitle).toBe("");
      expect(story.description).toBe("");
      expect(story.image).toBe("");
      expect(story.sourcePdf).toBe("");
      expect(story.location).toBeUndefined();
      expect(story.duration).toBeUndefined();
      expect(story.relatedStories).toBeUndefined();
    });

    it("should convert populated optional fields correctly", () => {
      const row: StoryRow = {
        id: "abc-123",
        slug: "full-story",
        title: "Full Story",
        subtitle: "Has subtitle",
        description: "Has description",
        image_path: "/img.jpg",
        image_source: "Unsplash",
        blur_data_url: "data:image/png;base64,abc",
        category: "culture",
        source_pdf: "story.pdf",
        location: "western",
        duration: "weekend",
        display_order: 3,
        is_active: true,
        related_stories: ["s1"],
        metadata: { key: "value" },
        best_months: [6, 7, 8],
        created_at: "2024-06-01T00:00:00Z",
        updated_at: "2024-06-15T00:00:00Z",
        source_type: "user_submitted",
        suggestion_id: "sug-1",
      };

      const story = rowToStory(row);

      expect(story.metadata).toEqual({ key: "value" });
      expect(story.bestMonths).toEqual([6, 7, 8]);
      expect(story.sourceType).toBe("user_submitted");
      expect(story.suggestionId).toBe("sug-1");
      expect(story.blurDataUrl).toBe("data:image/png;base64,abc");
      expect(story.imageSource).toBe("Unsplash");
    });

    it("should return undefined for falsy metadata and null bestMonths", () => {
      const row: StoryRow = {
        id: "abc-456",
        slug: "no-meta",
        title: "No Meta",
        subtitle: null,
        description: null,
        image_path: null,
        image_source: null,
        blur_data_url: null,
        category: "nature",
        source_pdf: null,
        location: null,
        duration: null,
        display_order: 0,
        is_active: true,
        related_stories: null,
        metadata: null as unknown as Record<string, unknown>,
        best_months: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        source_type: null,
        suggestion_id: null,
      };

      const story = rowToStory(row);

      expect(story.metadata).toBeUndefined();
      expect(story.bestMonths).toBeUndefined();
      expect(story.sourceType).toBeUndefined();
      expect(story.suggestionId).toBeUndefined();
    });
  });

  describe("public story projection", () => {
    it("defines a slim select list for public immersive story cards", () => {
      const selectedFields = PUBLIC_STORY_SELECT.split(",");

      expect(PUBLIC_STORY_SELECT).not.toBe("*");
      expect(selectedFields).toEqual([
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
      ]);
      expect(selectedFields).not.toEqual(
        expect.arrayContaining([
          "source_pdf",
          "suggestion_id",
          "updated_at",
          "curation_status",
          "is_active",
        ])
      );
    });

    it("maps a public row to a compatible Story without private story fields", () => {
      const row: PublicStoryRow = {
        id: "public-1",
        slug: "public-story",
        title: "Public Story",
        subtitle: null,
        description: null,
        image_path: "/public.jpg",
        image_source: null,
        blur_data_url: null,
        category: "culture",
        location: "central",
        duration: "weekend",
        display_order: 2,
        related_stories: null,
        metadata: {
          question_prompts: ["What should I ask?"],
          mood_tags: ["cultural"],
          asturianu_title: "Historia publica",
          translations: {
            en: {
              title: "Public Story",
              subtitle: "Subtitle",
              description: "Description",
            },
          },
          translation_status: { en: { status: "failed", error: "private" } },
          last_translated_at: "2026-01-01T00:00:00Z",
          discovery_source: "admin-only",
        },
        best_months: [5, 6],
        created_at: "2025-01-01T00:00:00Z",
        source_type: "user_submitted",
      };

      const story = rowToPublicStory(row);

      expect(story).toMatchObject({
        id: "public-1",
        slug: "public-story",
        title: "Public Story",
        subtitle: "",
        description: "",
        image: "/public.jpg",
        category: "culture",
        sourcePdf: "",
        location: "central",
        duration: "weekend",
        displayOrder: 2,
        bestMonths: [5, 6],
        createdAt: "2025-01-01T00:00:00Z",
        sourceType: "user_submitted",
      });
      expect(story).not.toHaveProperty("suggestionId");
      expect(story.metadata).toEqual({
        question_prompts: ["What should I ask?"],
        mood_tags: ["cultural"],
        asturianu_title: "Historia publica",
        translations: {
          en: {
            title: "Public Story",
            subtitle: "Subtitle",
            description: "Description",
          },
        },
      });
    });

    it("sanitizes full stories to a persisted public payload", () => {
      const story: Story = {
        id: "story-1",
        slug: "story-1",
        title: "Story",
        subtitle: "Sub",
        description: "Desc",
        image: "/story.jpg",
        imageSource: "Photo credit",
        blurDataUrl: "data:image/webp;base64,abc",
        category: "nature",
        sourcePdf: "private-guide.pdf",
        location: "eastern",
        duration: "day-trip",
        displayOrder: 1,
        relatedStories: ["story-2"],
        createdAt: "2025-01-01T00:00:00Z",
        bestMonths: [7],
        metadata: {
          question_prompts: ["Prompt"],
          mood_tags: ["relajante"],
          translation_status: { en: { status: "failed", error: "private" } },
        },
        sourceType: "curated",
        suggestionId: "suggestion-1",
      };

      const publicStory = toPublicStory(story);

      expect(publicStory).not.toHaveProperty("sourcePdf");
      expect(publicStory).not.toHaveProperty("suggestionId");
      expect(publicStory.metadata).toEqual({
        question_prompts: ["Prompt"],
        mood_tags: ["relajante"],
      });
    });

    it("maps persisted public stories back to Story without stale private cache fields", () => {
      const persistedStory = {
        id: "story-1",
        slug: "story-1",
        title: "Story",
        subtitle: "Sub",
        description: "Desc",
        image: "/story.jpg",
        category: "nature" as const,
        metadata: {
          question_prompts: ["Prompt"],
          translation_status: { en: { status: "failed" } },
        },
        sourcePdf: "old-private-cache.pdf",
        suggestionId: "old-suggestion",
      };

      const story = publicStoryToStory(persistedStory);

      expect(story.sourcePdf).toBe("");
      expect(story).not.toHaveProperty("suggestionId");
      expect(story.metadata).toEqual({
        question_prompts: ["Prompt"],
      });
    });
  });
});
