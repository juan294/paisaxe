import { describe, it, expect } from "vitest";
import {
  isPlaceholderImage,
  getPlaceholderForStory,
  PLACEHOLDER_PREFIX,
  UNSPLASH_POOLS,
} from "./unsplash-placeholders";
import type { StoryCategory } from "@/types/immersive";

describe("unsplash-placeholders", () => {
  describe("PLACEHOLDER_PREFIX", () => {
    it("should be the expected prefix string", () => {
      expect(PLACEHOLDER_PREFIX).toBe("unsplash-placeholder:");
    });
  });

  describe("UNSPLASH_POOLS", () => {
    const categories: StoryCategory[] = [
      "nature",
      "cities",
      "food",
      "culture",
      "activities",
    ];

    it("should have pools for all story categories", () => {
      for (const cat of categories) {
        expect(UNSPLASH_POOLS[cat]).toBeDefined();
        expect(Array.isArray(UNSPLASH_POOLS[cat])).toBe(true);
      }
    });

    it("should have at least 8 images per category", () => {
      for (const cat of categories) {
        expect(UNSPLASH_POOLS[cat].length).toBeGreaterThanOrEqual(8);
      }
    });

    it("each image entry should have url, author, and authorUrl", () => {
      for (const cat of categories) {
        for (const img of UNSPLASH_POOLS[cat]) {
          expect(img.url).toBeDefined();
          expect(typeof img.url).toBe("string");
          expect(img.url).toMatch(/^https:\/\/images\.unsplash\.com\//);

          expect(img.author).toBeDefined();
          expect(typeof img.author).toBe("string");
          expect(img.author.length).toBeGreaterThan(0);

          expect(img.authorUrl).toBeDefined();
          expect(typeof img.authorUrl).toBe("string");
          expect(img.authorUrl).toMatch(/^https:\/\/unsplash\.com\//);
        }
      }
    });

    it("all image URLs should include w=1920 for high resolution", () => {
      for (const cat of categories) {
        for (const img of UNSPLASH_POOLS[cat]) {
          expect(img.url).toContain("w=1920");
        }
      }
    });
  });

  describe("isPlaceholderImage", () => {
    it("should return true when imageSource starts with placeholder prefix", () => {
      expect(
        isPlaceholderImage({
          imageSource: "unsplash-placeholder:Photo by John on Unsplash",
        })
      ).toBe(true);
    });

    it("should return false when imageSource does not start with prefix", () => {
      expect(
        isPlaceholderImage({
          imageSource: "Photo by John on Unsplash",
        })
      ).toBe(false);
    });

    it("should return false when imageSource is undefined", () => {
      expect(isPlaceholderImage({})).toBe(false);
    });

    it("should return false when imageSource is empty", () => {
      expect(isPlaceholderImage({ imageSource: "" })).toBe(false);
    });

    it("should return false when imageSource is a regular attribution", () => {
      expect(
        isPlaceholderImage({ imageSource: "Turismo de Asturias" })
      ).toBe(false);
    });
  });

  describe("getPlaceholderForStory", () => {
    it("should return an object with image and imageSource", () => {
      const result = getPlaceholderForStory("test-slug", "nature");
      expect(result).toHaveProperty("image");
      expect(result).toHaveProperty("imageSource");
    });

    it("should return a valid Unsplash URL as image", () => {
      const result = getPlaceholderForStory("test-slug", "nature");
      expect(result.image).toMatch(/^https:\/\/images\.unsplash\.com\//);
    });

    it("should return imageSource with placeholder prefix", () => {
      const result = getPlaceholderForStory("test-slug", "nature");
      expect(result.imageSource).toMatch(/^unsplash-placeholder:/);
    });

    it("should include author attribution in imageSource", () => {
      const result = getPlaceholderForStory("test-slug", "nature");
      expect(result.imageSource).toContain("Photo by");
      expect(result.imageSource).toContain("on Unsplash");
    });

    it("should be deterministic - same slug always gets same image", () => {
      const result1 = getPlaceholderForStory("lagos-covadonga", "nature");
      const result2 = getPlaceholderForStory("lagos-covadonga", "nature");
      expect(result1).toEqual(result2);
    });

    it("should produce different images for different slugs", () => {
      // With enough slugs, at least some should get different images
      const results = new Set<string>();
      const slugs = [
        "slug-a",
        "slug-b",
        "slug-c",
        "slug-d",
        "slug-e",
        "slug-f",
        "slug-g",
        "slug-h",
      ];
      for (const slug of slugs) {
        const r = getPlaceholderForStory(slug, "nature");
        results.add(r.image);
      }
      // With 8 slugs and 8+ images, expect at least 2 distinct images
      expect(results.size).toBeGreaterThanOrEqual(2);
    });

    it("should select from the correct category pool", () => {
      const natureResult = getPlaceholderForStory("test", "nature");
      const natureUrls = UNSPLASH_POOLS.nature.map((p) => p.url);
      expect(natureUrls).toContain(natureResult.image);

      const foodResult = getPlaceholderForStory("test", "food");
      const foodUrls = UNSPLASH_POOLS.food.map((p) => p.url);
      expect(foodUrls).toContain(foodResult.image);
    });

    it("should handle all categories", () => {
      const categories: StoryCategory[] = [
        "nature",
        "cities",
        "food",
        "culture",
        "activities",
      ];
      for (const cat of categories) {
        const result = getPlaceholderForStory("any-slug", cat);
        expect(result.image).toBeTruthy();
        expect(result.imageSource).toBeTruthy();
      }
    });
  });
});
