import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import type { Story } from "@/types/immersive";
import { StoriesProvider, useStories } from "./use-stories";
import { stubStoriesApiFetch } from "@/test/mock-stories-api-fetch";

// FE-H1 (#759): use-stories.ts now fetches through /api/stories instead of
// calling getStoriesFromDB directly. See use-stories.test.ts for the full
// rationale — the global fetch mock wraps mockGetStoriesFromDB in the same
// `{ data: [...] }` envelope the real route returns.
const mockGetStoriesFromDB = vi.fn();

vi.mock("@/lib/stories-fallback", () => ({
  FALLBACK_STORIES: [],
}));

stubStoriesApiFetch(mockGetStoriesFromDB);

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
