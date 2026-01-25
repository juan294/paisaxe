import { describe, it, expect } from "vitest";
import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
  DURATION_LABELS,
  rowToStory,
  type Story,
  type StoryCategory,
  type StoryLocation,
  type StoryDuration,
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
        category: "nature",
        source_pdf: "test.pdf",
        location: "eastern",
        duration: "day-trip",
        display_order: 5,
        is_active: true,
        related_stories: ["story-1", "story-2"],
        metadata: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
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
        category: "nature",
        source_pdf: null,
        location: null,
        duration: null,
        display_order: 0,
        is_active: true,
        related_stories: null,
        metadata: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
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
  });
});
