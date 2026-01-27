import { describe, it, expect } from "vitest";
import {
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
  OG_COLORS,
  CATEGORY_COLORS,
  getCategoryColor,
} from "./og-image-helpers";

describe("og-image-helpers", () => {
  describe("OG_IMAGE_SIZE", () => {
    it("has standard OG image dimensions", () => {
      expect(OG_IMAGE_SIZE).toEqual({ width: 1200, height: 630 });
    });
  });

  describe("OG_IMAGE_CONTENT_TYPE", () => {
    it("is image/png", () => {
      expect(OG_IMAGE_CONTENT_TYPE).toBe("image/png");
    });
  });

  describe("OG_COLORS", () => {
    it("defines background colors", () => {
      expect(OG_COLORS.background).toBeDefined();
      expect(OG_COLORS.backgroundGradient).toBeDefined();
    });

    it("defines text colors", () => {
      expect(OG_COLORS.text).toBeDefined();
      expect(OG_COLORS.textMuted).toBeDefined();
    });

    it("defines accent color", () => {
      expect(OG_COLORS.accent).toBeDefined();
    });
  });

  describe("CATEGORY_COLORS", () => {
    it("maps all five story categories", () => {
      expect(CATEGORY_COLORS).toHaveProperty("nature");
      expect(CATEGORY_COLORS).toHaveProperty("cities");
      expect(CATEGORY_COLORS).toHaveProperty("food");
      expect(CATEGORY_COLORS).toHaveProperty("culture");
      expect(CATEGORY_COLORS).toHaveProperty("activities");
    });

    it("returns string color values", () => {
      for (const color of Object.values(CATEGORY_COLORS)) {
        expect(typeof color).toBe("string");
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });

  describe("getCategoryColor", () => {
    it("returns the correct color for known categories", () => {
      expect(getCategoryColor("nature")).toBe(CATEGORY_COLORS.nature);
      expect(getCategoryColor("cities")).toBe(CATEGORY_COLORS.cities);
      expect(getCategoryColor("food")).toBe(CATEGORY_COLORS.food);
      expect(getCategoryColor("culture")).toBe(CATEGORY_COLORS.culture);
      expect(getCategoryColor("activities")).toBe(CATEGORY_COLORS.activities);
    });

    it("returns accent color for unknown categories", () => {
      expect(getCategoryColor("unknown")).toBe(OG_COLORS.accent);
      expect(getCategoryColor("")).toBe(OG_COLORS.accent);
    });
  });
});
