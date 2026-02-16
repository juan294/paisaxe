import { describe, it, expect } from "vitest";
import { generateSlug, CATEGORIES, LOCATIONS, DURATIONS } from "./types";

describe("story-editor-dialog/types", () => {
  describe("generateSlug", () => {
    it("converts to lowercase", () => {
      expect(generateSlug("Hello World")).toBe("hello-world");
    });

    it("replaces spaces with hyphens", () => {
      expect(generateSlug("a beautiful day")).toBe("a-beautiful-day");
    });

    it("removes accents", () => {
      expect(generateSlug("Café con Leche")).toBe("cafe-con-leche");
    });

    it("handles ñ correctly", () => {
      expect(generateSlug("España Asturias")).toBe("espana-asturias");
    });

    it("removes special characters", () => {
      expect(generateSlug("Hello! @World#")).toBe("hello-world");
    });

    it("collapses multiple hyphens", () => {
      expect(generateSlug("hello---world")).toBe("hello-world");
    });

    it("removes leading and trailing hyphens", () => {
      expect(generateSlug("-hello world-")).toBe("hello-world");
    });

    it("handles underscores as separators", () => {
      expect(generateSlug("hello_world")).toBe("hello-world");
    });

    it("handles empty string", () => {
      expect(generateSlug("")).toBe("");
    });

    it("handles complex Asturian titles", () => {
      expect(generateSlug("Picos de Europa: Hiking & Más")).toBe(
        "picos-de-europa-hiking-mas"
      );
    });

    it("handles all-special-character input", () => {
      expect(generateSlug("!!!")).toBe("");
    });

    it("preserves numbers", () => {
      expect(generateSlug("Top 10 Beaches")).toBe("top-10-beaches");
    });
  });

  describe("CATEGORIES", () => {
    it("has the expected categories", () => {
      const values = CATEGORIES.map((c) => c.value);
      expect(values).toEqual([
        "nature",
        "cities",
        "food",
        "culture",
        "activities",
      ]);
    });

    it("each category has a label", () => {
      for (const cat of CATEGORIES) {
        expect(cat.label).toBeTruthy();
      }
    });
  });

  describe("LOCATIONS", () => {
    it("has the three Asturias regions", () => {
      const values = LOCATIONS.map((l) => l.value);
      expect(values).toEqual(["eastern", "central", "western"]);
    });
  });

  describe("DURATIONS", () => {
    it("has the three duration options", () => {
      const values = DURATIONS.map((d) => d.value);
      expect(values).toEqual(["day-trip", "weekend", "week"]);
    });
  });
});
