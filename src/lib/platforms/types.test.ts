import { describe, it, expect } from "vitest";
import {
  PLATFORM_CONTENT_LIMITS,
  validateContent,
  type PostOptions,
} from "./types";

describe("PLATFORM_CONTENT_LIMITS", () => {
  it("defines limits for x platform", () => {
    expect(PLATFORM_CONTENT_LIMITS.x).toEqual({
      maxLength: 280,
      maxMedia: 4,
      maxHashtags: 5,
      supportsThreads: true,
      supportsLinks: true,
    });
  });

  it("defines limits for instagram platform", () => {
    expect(PLATFORM_CONTENT_LIMITS.instagram).toEqual({
      maxLength: 2200,
      maxMedia: 10,
      maxHashtags: 30,
      supportsThreads: false,
      supportsLinks: false,
    });
  });

  it("defines limits for pinterest platform", () => {
    expect(PLATFORM_CONTENT_LIMITS.pinterest).toEqual({
      maxLength: 500,
      maxMedia: 1,
      maxHashtags: 20,
      supportsThreads: false,
      supportsLinks: true,
    });
  });
});

describe("validateContent", () => {
  describe("content length validation", () => {
    it("passes when content is within limit for x", () => {
      const result = validateContent("x", "Hello world!");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails when content exceeds limit for x", () => {
      const content = "a".repeat(281);
      const result = validateContent("x", content);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Content exceeds 280 characters (281)");
    });

    it("passes when content is exactly at limit for x", () => {
      const content = "a".repeat(280);
      const result = validateContent("x", content);
      expect(result.valid).toBe(true);
    });

    it("validates content length for instagram", () => {
      const content = "a".repeat(2201);
      const result = validateContent("instagram", content);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Content exceeds 2200 characters (2201)");
    });

    it("validates content length for pinterest", () => {
      const content = "a".repeat(501);
      const result = validateContent("pinterest", content);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Content exceeds 500 characters (501)");
    });
  });

  describe("media validation", () => {
    it("passes when media count is within limit for x", () => {
      const options: PostOptions = {
        mediaUrls: ["url1", "url2", "url3", "url4"],
      };
      const result = validateContent("x", "Hello", options);
      expect(result.valid).toBe(true);
    });

    it("fails when media count exceeds limit for x", () => {
      const options: PostOptions = {
        mediaUrls: ["url1", "url2", "url3", "url4", "url5"],
      };
      const result = validateContent("x", "Hello", options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Too many media items (5/4)");
    });

    it("fails when media count exceeds limit for pinterest", () => {
      const options: PostOptions = {
        mediaUrls: ["url1", "url2"],
      };
      const result = validateContent("pinterest", "Hello", options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Too many media items (2/1)");
    });
  });

  describe("hashtag validation", () => {
    it("passes when hashtag count is within limit for x", () => {
      const options: PostOptions = {
        hashtags: ["#one", "#two", "#three", "#four", "#five"],
      };
      const result = validateContent("x", "Hello", options);
      expect(result.valid).toBe(true);
    });

    it("fails when hashtag count exceeds limit for x", () => {
      const options: PostOptions = {
        hashtags: ["#1", "#2", "#3", "#4", "#5", "#6"],
      };
      const result = validateContent("x", "Hello", options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Too many hashtags (6/5)");
    });

    it("fails when hashtag count exceeds limit for instagram", () => {
      const hashtags = Array.from({ length: 31 }, (_, i) => `#tag${i}`);
      const options: PostOptions = { hashtags };
      const result = validateContent("instagram", "Hello", options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Too many hashtags (31/30)");
    });
  });

  describe("link validation", () => {
    it("passes when link is provided for platform that supports links", () => {
      const options: PostOptions = { linkUrl: "https://example.com" };
      const result = validateContent("x", "Hello", options);
      expect(result.valid).toBe(true);
    });

    it("fails when link is provided for instagram (no link support)", () => {
      const options: PostOptions = { linkUrl: "https://example.com" };
      const result = validateContent("instagram", "Hello", options);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("instagram does not support links in posts");
    });

    it("passes when link is provided for pinterest", () => {
      const options: PostOptions = { linkUrl: "https://example.com" };
      const result = validateContent("pinterest", "Hello", options);
      expect(result.valid).toBe(true);
    });
  });

  describe("multiple errors", () => {
    it("returns all validation errors", () => {
      const content = "a".repeat(281);
      const options: PostOptions = {
        mediaUrls: ["1", "2", "3", "4", "5"],
        hashtags: ["#1", "#2", "#3", "#4", "#5", "#6"],
      };
      const result = validateContent("x", content, options);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });
});
