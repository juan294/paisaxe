import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import type { Story } from "@/types/immersive";
import { StoriesProvider, useStories } from "./use-stories";

const mockGetStoriesFromDB = vi.fn();

vi.mock("@/lib/stories-data", () => ({
  FALLBACK_STORIES: [],
  getStoriesFromDB: (...args: unknown[]) => mockGetStoriesFromDB(...args),
}));

const initialStories: Story[] = [
  {
    id: "story-1",
    slug: "story-1",
    title: "Seeded story",
    subtitle: "Subtitle",
    description: "Description",
    image: "/story.jpg",
    category: "nature",
    sourcePdf: "story.pdf",
  },
];

function StoriesState() {
  const { stories, isLoading } = useStories();
  return <div>{isLoading ? "loading" : stories[0]?.title ?? "none"}</div>;
}

describe("StoriesProvider", () => {
  beforeEach(() => {
    mockGetStoriesFromDB.mockReset();
  });

  it("shares server-seeded stories without re-fetching on mount", () => {
    render(
      <StoriesProvider initialStories={initialStories}>
        <StoriesState />
        <StoriesState />
      </StoriesProvider>
    );

    expect(screen.getAllByText("Seeded story")).toHaveLength(2);
    expect(mockGetStoriesFromDB).not.toHaveBeenCalled();
  });

  it("throws when useStories is called outside a StoriesProvider", () => {
    expect(() => renderHook(() => useStories())).toThrow(
      "useStories must be used within a StoriesProvider"
    );
  });
});
