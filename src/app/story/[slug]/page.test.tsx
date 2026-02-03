import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import StoryPage, { generateMetadata } from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock stories-data
vi.mock("@/lib/stories-data", () => ({
  getStoryBySlugFromDB: vi.fn(),
}));

import { getStoryBySlugFromDB } from "@/lib/stories-data";

const mockGetStoryBySlugFromDB = vi.mocked(getStoryBySlugFromDB);
const mockRedirect = vi.mocked(redirect);

describe("StoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateMetadata", () => {
    it("should return default metadata when story not found", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue(null);

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "non-existent" }),
      });

      expect(metadata.title).toBe("Paisaxe | Descubre Asturias");
    });

    it("should return story metadata when story exists", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue({
        id: "story-1",
        slug: "test-story",
        title: "Test Story",
        subtitle: "Test Location",
        description: "A test description",
        image: "/images/test.jpg",
        category: "nature",
        sourcePdf: "test.pdf",
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "test-story" }),
      });

      expect(metadata.title).toBe("Test Story | Paisaxe");
      expect(metadata.description).toBe("A test description");
      expect(metadata.openGraph).toBeDefined();
      expect(metadata.openGraph?.title).toBe("Test Story");
      expect(metadata.openGraph?.description).toBe("A test description");
      // Type narrowing for OpenGraph metadata
      const og = metadata.openGraph as { type?: string; siteName?: string };
      expect(og?.type).toBe("article");
      expect(og?.siteName).toBe("Paisaxe");
      // Type narrowing for Twitter metadata
      const twitter = metadata.twitter as { card?: string; title?: string };
      expect(twitter?.card).toBe("summary_large_image");
      expect(twitter?.title).toBe("Test Story");
    });
  });

  describe("StoryPage component", () => {
    it("should redirect to immersive page with story slug", async () => {
      await StoryPage({ params: Promise.resolve({ slug: "test-story" }) });

      expect(mockRedirect).toHaveBeenCalledWith("/immersive?story=test-story");
    });

    it("should redirect with correct slug parameter", async () => {
      await StoryPage({ params: Promise.resolve({ slug: "another-story" }) });

      expect(mockRedirect).toHaveBeenCalledWith("/immersive?story=another-story");
    });
  });
});
