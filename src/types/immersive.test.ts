import { describe, it, expect } from "vitest";
import { CATEGORY_LABELS, type Story, type StoryCategory } from "./immersive";

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
  });
});
