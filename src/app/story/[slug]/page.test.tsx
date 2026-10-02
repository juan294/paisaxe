import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { notFound } from "next/navigation";
import StoryPage, { generateMetadata, generateStaticParams } from "./page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Mock next/image and next/link as simple passthroughs so we can render
// the server component's output with React Testing Library.
vi.mock("next/image", () => ({
  default: ({ fill: _fill, ...rest }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" {...rest} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock the client-side hand-off component — it is covered by its own test.
vi.mock("./story-redirect-client", () => ({
  StoryRedirectClient: ({ href }: { href: string }) => (
    <div data-testid="story-redirect-client" data-href={href} />
  ),
}));

// Mock stories-data
vi.mock("@/lib/stories-data", () => ({
  getStoriesFromDB: vi.fn(),
  getStoryBySlugFromDB: vi.fn(),
}));

import { getStoriesFromDB, getStoryBySlugFromDB } from "@/lib/stories-data";

const mockGetStoriesFromDB = vi.mocked(getStoriesFromDB);
const mockGetStoryBySlugFromDB = vi.mocked(getStoryBySlugFromDB);
const mockNotFound = vi.mocked(notFound);

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
    const baseStory = {
      id: "story-1",
      slug: "test-story",
      title: "Test Story",
      subtitle: "Subtitle",
      description: "A test description",
      category: "nature" as const,
      image: "/images/test.jpg",
      sourcePdf: "test.pdf",
    };

    it("should return default metadata when story not found", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue(null);

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "non-existent" }),
      });

      expect(metadata.title).toBe("Paisaxe | Descubre Asturias");
    });

    it("reuses getStoryBySlugFromDB — deduplicated via React cache() with the page body — instead of a separate query (FE-H2 follow-up)", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue(baseStory);

      await generateMetadata({ params: Promise.resolve({ slug: "test-story" }) });

      expect(mockGetStoryBySlugFromDB).toHaveBeenCalledWith("test-story");
    });

    it("should return story metadata when story exists", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue(baseStory);

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

    it("falls back to undefined description when story.description is empty", async () => {
      // const description = story.description || undefined; -- exercise the ||
      // fallback. Story.description is always a string (rowToPublicStory
      // coerces a null DB value to ""), so "no description" surfaces as "",
      // not null/undefined — the metadata tag must still be omitted.
      mockGetStoryBySlugFromDB.mockResolvedValue({
        ...baseStory,
        slug: "no-description-story",
        title: "No Description Story",
        description: "",
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

  describe("StoryPage component (FE-H2 / #760 — renders instead of redirecting)", () => {
    const fullStory = {
      id: "story-1",
      slug: "test-story",
      title: "Test Story",
      subtitle: "A subtitle",
      description: "A test description",
      category: "nature" as const,
      image: "/images/test.jpg",
      sourcePdf: "test.pdf",
    };

    afterEach(() => {
      cleanup();
    });

    it("renders the story's title, subtitle, and description instead of redirecting", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue(fullStory);

      const element = await StoryPage({
        params: Promise.resolve({ slug: "test-story" }),
      });
      render(element);

      expect(screen.getByRole("heading", { name: "Test Story" })).toBeInTheDocument();
      expect(screen.getByText("A subtitle")).toBeInTheDocument();
      expect(screen.getByText("A test description")).toBeInTheDocument();
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("colors the category label and CTA by category, reusing getCategoryColor (matches opengraph-image.tsx)", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue(fullStory);

      const element = await StoryPage({
        params: Promise.resolve({ slug: "test-story" }),
      });
      render(element);

      // "nature" -> #22c55e per CATEGORY_COLORS (src/lib/og-image-helpers.ts)
      const label = screen.getByText("Naturaleza");
      expect(label).toHaveStyle({ color: "#22c55e" });
      const cta = screen.getByRole("link", { name: "Ver experiencia interactiva" });
      expect(cta).toHaveStyle({ backgroundColor: "#22c55e" });
    });

    it("hands off to the immersive viewer via the client redirect component, not a server redirect", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue(fullStory);

      const element = await StoryPage({
        params: Promise.resolve({ slug: "test-story" }),
      });
      render(element);

      const handoff = screen.getByTestId("story-redirect-client");
      expect(handoff.dataset.href).toBe("/immersive?story=test-story");
    });

    it("passes the correct slug through to getStoryBySlugFromDB and the hand-off URL", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue({ ...fullStory, slug: "another-story" });

      const element = await StoryPage({
        params: Promise.resolve({ slug: "another-story" }),
      });
      render(element);

      expect(mockGetStoryBySlugFromDB).toHaveBeenCalledWith("another-story");
      expect(screen.getByTestId("story-redirect-client").dataset.href).toBe(
        "/immersive?story=another-story"
      );
    });

    it("calls notFound() when the story does not exist", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue(null);

      await StoryPage({ params: Promise.resolve({ slug: "missing-story" }) });

      expect(mockNotFound).toHaveBeenCalledOnce();
    });

    it("does not render image when story.image is missing (line 87-98 false branch)", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue({
        ...fullStory,
        image: "", // falsy image
      });

      const element = await StoryPage({
        params: Promise.resolve({ slug: "test-story" }),
      });
      render(element);

      // Image element should not be present
      const images = screen.queryAllByRole("img");
      expect(images.length).toBe(0);

      // But title, subtitle, and description should still render
      expect(screen.getByRole("heading", { name: "Test Story" })).toBeInTheDocument();
      expect(screen.getByText("A subtitle")).toBeInTheDocument();
      expect(screen.getByText("A test description")).toBeInTheDocument();
    });

    it("does not render subtitle when story.subtitle is missing (line 106-108 false branch)", async () => {
      mockGetStoryBySlugFromDB.mockResolvedValue({
        ...fullStory,
        subtitle: "", // falsy subtitle
      });

      const element = await StoryPage({
        params: Promise.resolve({ slug: "test-story" }),
      });
      render(element);

      // The subtitle paragraph should not be in the document
      // (it's only rendered when subtitle is truthy)
      expect(screen.queryByText("A subtitle")).not.toBeInTheDocument();

      // But title and description should still render
      expect(screen.getByRole("heading", { name: "Test Story" })).toBeInTheDocument();
      expect(screen.getByText("A test description")).toBeInTheDocument();
    });
  });
});
