import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import StoryPage, { generateMetadata, generateStaticParams } from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

// Mock stories-data
vi.mock("@/lib/stories-data", () => ({
  getStoryMetadataBySlug: vi.fn(),
  getStoriesFromDB: vi.fn(),
}));

import { getStoryMetadataBySlug, getStoriesFromDB } from "@/lib/stories-data";

const mockGetStoryMetadataBySlug = vi.mocked(getStoryMetadataBySlug);
const mockGetStoriesFromDB = vi.mocked(getStoriesFromDB);
const mockRedirect = vi.mocked(redirect);

describe("StoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateStaticParams", () => {
    it("should return slugs for all active stories", async () => {
      mockGetStoriesFromDB.mockResolvedValue([
        {
          id: "story-1",
          slug: "lagos-covadonga",
          title: "Lagos de Covadonga",
          subtitle: "Picos de Europa",
          description: "Iconic glacial lakes",
          category: "nature",
          image: "/images/test.jpg",
          sourcePdf: "test.pdf",
        },
        {
          id: "story-2",
          slug: "ruta-cares",
          title: "Ruta del Cares",
          subtitle: "Desfiladero",
          description: "Dramatic gorge hike",
          category: "activities",
          image: "/images/test2.jpg",
          sourcePdf: "test2.pdf",
        },
      ]);

      const params = await generateStaticParams();

      expect(params).toEqual([
        { slug: "lagos-covadonga" },
        { slug: "ruta-cares" },
      ]);
      expect(mockGetStoriesFromDB).toHaveBeenCalledOnce();
    });

    it("should return empty array when no stories exist", async () => {
      mockGetStoriesFromDB.mockResolvedValue([]);

      const params = await generateStaticParams();

      expect(params).toEqual([]);
    });

    it("should fall back to story id when slug is missing", async () => {
      mockGetStoriesFromDB.mockResolvedValue([
        {
          id: "story-no-slug",
          slug: "",
          title: "Story Without Slug",
          subtitle: "Unknown",
          description: "A story without a slug",
          category: "culture",
          image: "/images/test.jpg",
          sourcePdf: "test.pdf",
        },
      ]);

      const params = await generateStaticParams();

      expect(params).toEqual([{ slug: "story-no-slug" }]);
    });
  });

  describe("generateMetadata", () => {
    it("should return default metadata when story not found", async () => {
      mockGetStoryMetadataBySlug.mockResolvedValue(null);

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "non-existent" }),
      });

      expect(metadata.title).toBe("Paisaxe | Descubre Asturias");
    });

    it("uses the slim metadata query (not the full story row)", async () => {
      mockGetStoryMetadataBySlug.mockResolvedValue({
        slug: "test-story",
        title: "Test Story",
        description: "A test description",
      });

      await generateMetadata({ params: Promise.resolve({ slug: "test-story" }) });

      expect(mockGetStoryMetadataBySlug).toHaveBeenCalledWith("test-story");
    });

    it("should return story metadata when story exists", async () => {
      mockGetStoryMetadataBySlug.mockResolvedValue({
        slug: "test-story",
        title: "Test Story",
        description: "A test description",
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

    it("falls back to undefined description when story.description is null (line 31)", async () => {
      // const description = story.description ?? undefined; -- exercise the ??
      // fallback for a story whose description column is null.
      mockGetStoryMetadataBySlug.mockResolvedValue({
        slug: "no-description-story",
        title: "No Description Story",
        description: null,
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "no-description-story" }),
      });

      expect(metadata.description).toBeUndefined();
      expect(metadata.openGraph?.description).toBeUndefined();
      const twitter = metadata.twitter as { description?: string };
      expect(twitter?.description).toBeUndefined();
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
