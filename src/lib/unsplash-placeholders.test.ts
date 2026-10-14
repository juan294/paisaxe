import { describe, it, expect } from "vitest";
import {
  isPlaceholderImage,
  isOldUnsplashPlaceholder,
  getPlaceholderForStory,
  PLACEHOLDER_PREFIX,
  UNSPLASH_POOLS,
} from "./unsplash-placeholders";
import type { StoryCategory } from "@/types/immersive";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "./image-provenance";

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
    it("should return true when image is from Unsplash AND imageSource has placeholder prefix", () => {
      expect(
        isPlaceholderImage({
          image: "https://images.unsplash.com/photo-123?w=1920",
          imageSource: "unsplash-placeholder:Photo by John on Unsplash",
        })
      ).toBe(true);
    });

    it("should return false when imageSource has prefix but image is not from Unsplash", () => {
      expect(
        isPlaceholderImage({
          image: "https://example.com/real-photo.jpg",
          imageSource: "unsplash-placeholder:Photo by John on Unsplash",
        })
      ).toBe(false);
    });

    it("should return false when image is from Unsplash but imageSource does not have prefix", () => {
      expect(
        isPlaceholderImage({
          image: "https://images.unsplash.com/photo-123?w=1920",
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

    it("should return false when image is from Supabase storage", () => {
      expect(
        isPlaceholderImage({
          image: "https://supabase.co/storage/story-images/real-photo.avif",
          imageSource: "Turismo de Asturias",
        })
      ).toBe(false);
    });
  });

  describe("isOldUnsplashPlaceholder", () => {
    it("should return true for old-style Unsplash URL without prefix in imageSource", () => {
      expect(
        isOldUnsplashPlaceholder({
          image: "https://images.unsplash.com/photo-123?w=1920",
        })
      ).toBe(true);
    });

    it("should return true when imageSource is undefined", () => {
      expect(
        isOldUnsplashPlaceholder({
          image: "https://images.unsplash.com/photo-456?w=1920",
          imageSource: undefined,
        })
      ).toBe(true);
    });

    it("should return true when imageSource is empty", () => {
      expect(
        isOldUnsplashPlaceholder({
          image: "https://images.unsplash.com/photo-789?w=1920",
          imageSource: "",
        })
      ).toBe(true);
    });

    it("should return true when imageSource is a non-placeholder attribution", () => {
      expect(
        isOldUnsplashPlaceholder({
          image: "https://images.unsplash.com/photo-789?w=1920",
          imageSource: "Some random source",
        })
      ).toBe(true);
    });

    it("should return false when imageSource has the new placeholder prefix", () => {
      expect(
        isOldUnsplashPlaceholder({
          image: "https://images.unsplash.com/photo-123?w=1920",
          imageSource: `${PLACEHOLDER_PREFIX}Photo by Author on Unsplash`,
        })
      ).toBe(false);
    });

    it("should return false for local image paths", () => {
      expect(
        isOldUnsplashPlaceholder({
          image: "/images/stories/lagos-covadonga.webp",
        })
      ).toBe(false);
    });

    it("should return false for empty image", () => {
      expect(isOldUnsplashPlaceholder({ image: "" })).toBe(false);
    });

    it("should return false for undefined image", () => {
      expect(isOldUnsplashPlaceholder({})).toBe(false);
    });

    it("should return false for non-Unsplash external URLs", () => {
      expect(
        isOldUnsplashPlaceholder({
          image: "https://example.com/photo.jpg",
        })
      ).toBe(false);
    });
  });

  describe("needsPlaceholderImage", () => {
    // Import dynamically to get the new function
    it("should return true for empty image", async () => {
      const { needsPlaceholderImage } = await import("./unsplash-placeholders");
      expect(needsPlaceholderImage({ image: "" })).toBe(true);
    });

    it("should return true for undefined image", async () => {
      const { needsPlaceholderImage } = await import("./unsplash-placeholders");
      expect(needsPlaceholderImage({})).toBe(true);
    });

    it("should return true for placeholder.svg path", async () => {
      const { needsPlaceholderImage } = await import("./unsplash-placeholders");
      expect(
        needsPlaceholderImage({ image: "/images/stories/placeholder.svg" })
      ).toBe(true);
    });

    it("should return true for old Unsplash URL without prefix", async () => {
      const { needsPlaceholderImage } = await import("./unsplash-placeholders");
      expect(
        needsPlaceholderImage({
          image: "https://images.unsplash.com/photo-123?w=1920",
        })
      ).toBe(true);
    });

    it("should return false for new Unsplash placeholder with prefix", async () => {
      const { needsPlaceholderImage } = await import("./unsplash-placeholders");
      expect(
        needsPlaceholderImage({
          image: "https://images.unsplash.com/photo-123?w=1920",
          imageSource: `${PLACEHOLDER_PREFIX}Photo by Author on Unsplash`,
        })
      ).toBe(false);
    });

    it("should return false for real local images", async () => {
      const { needsPlaceholderImage } = await import("./unsplash-placeholders");
      expect(
        needsPlaceholderImage({ image: "/images/stories/lagos-covadonga.webp" })
      ).toBe(false);
    });

    it("should return false for real external URLs", async () => {
      const { needsPlaceholderImage } = await import("./unsplash-placeholders");
      expect(
        needsPlaceholderImage({ image: "https://example.com/photo.jpg" })
      ).toBe(false);
    });
  });

  describe("getPlaceholderForStory", () => {
    it("should return an object with image and imageSource", () => {
      const result = getPlaceholderForStory("test-slug", "nature");
      expect(result).toHaveProperty("image");
      expect(result).toHaveProperty("imageSource");
    });

    it("returns the local authored neutral illustration without selecting a remote photograph", () => {
      const result = getPlaceholderForStory("test-slug", "nature");
      expect(result.image).toBe(NEUTRAL_IMAGE);
      expect(result.image).toMatch(/^\/images\//);
    });

    it("returns the explicit neutral illustration disclosure", () => {
      const result = getPlaceholderForStory("test-slug", "nature");
      expect(result.imageSource).toBe(NEUTRAL_CREDIT);
    });

    it("does not imply an Unsplash photo or a named-place likeness", () => {
      const result = getPlaceholderForStory("test-slug", "nature");
      expect(result.imageSource).toContain("Ilustración temática");
      expect(result.imageSource).toContain("no representa un lugar concreto");
      expect(result.imageSource).not.toContain("Unsplash");
    });

    it("should be deterministic - same slug always gets same image", () => {
      const result1 = getPlaceholderForStory("lagos-covadonga", "nature");
      const result2 = getPlaceholderForStory("lagos-covadonga", "nature");
      expect(result1).toEqual(result2);
    });

    it("never infers permission or chooses a pool photo from a different story slug", () => {
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
      expect([...results]).toEqual([NEUTRAL_IMAGE]);
    });

    it("retains the legacy pools for inventory while serving none of their unreviewed photos", () => {
      const natureResult = getPlaceholderForStory("test", "nature");
      const natureUrls = UNSPLASH_POOLS.nature.map((p) => p.url);
      expect(natureUrls).not.toContain(natureResult.image);
      expect(natureResult.image).toBe(NEUTRAL_IMAGE);

      const foodResult = getPlaceholderForStory("test", "food");
      const foodUrls = UNSPLASH_POOLS.food.map((p) => p.url);
      expect(foodUrls).not.toContain(foodResult.image);
      expect(foodResult.image).toBe(NEUTRAL_IMAGE);
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
