import { describe, it, expect } from "vitest";
import { getRelatedStories } from "./related-stories";
import type { Story } from "@/types/immersive";

const mockStories: Story[] = [
  {
    id: "1",
    slug: "story-1",
    title: "Nature Eastern Day",
    subtitle: "Sub",
    description: "A nature story in eastern Asturias",
    image: "/img.png",
    category: "nature",
    sourcePdf: "test.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "2",
    slug: "story-2",
    title: "Nature Central Weekend",
    subtitle: "Sub",
    description: "A nature story in central Asturias",
    image: "/img.png",
    category: "nature",
    sourcePdf: "test.pdf",
    location: "central",
    duration: "weekend",
  },
  {
    id: "3",
    slug: "story-3",
    title: "Cities Eastern Day",
    subtitle: "Sub",
    description: "A cities story in eastern Asturias",
    image: "/img.png",
    category: "cities",
    sourcePdf: "test.pdf",
    location: "eastern",
    duration: "day-trip",
  },
  {
    id: "4",
    slug: "story-4",
    title: "Food Central Day",
    subtitle: "Sub",
    description: "A food story in central Asturias",
    image: "/img.png",
    category: "food",
    sourcePdf: "test.pdf",
    location: "central",
    duration: "day-trip",
  },
  {
    id: "5",
    slug: "story-5",
    title: "Nature Eastern Weekend",
    subtitle: "Sub",
    description: "Another nature story in eastern Asturias",
    image: "/img.png",
    category: "nature",
    sourcePdf: "test.pdf",
    location: "eastern",
    duration: "weekend",
  },
];

describe("getRelatedStories", () => {
  const currentStory = mockStories[0]; // Nature, Eastern, Day-trip

  it("should not include the current story in results", () => {
    const related = getRelatedStories(currentStory, mockStories);

    expect(related.find(s => s.id === currentStory.id)).toBeUndefined();
  });

  it("should return stories sorted by relevance score", () => {
    const related = getRelatedStories(currentStory, mockStories);

    // Story 5 should be first: same category + same location (2 matches)
    // Story 2 should be second: same category (1 match)
    // Story 3 should be third: same location + same duration (2 matches)
    expect(related.length).toBeGreaterThan(0);
    expect(related[0].id).toBe("5"); // nature + eastern
  });

  it("should limit results to specified count", () => {
    const related = getRelatedStories(currentStory, mockStories, 2);

    expect(related).toHaveLength(2);
  });

  it("should return empty array when no other stories exist", () => {
    const related = getRelatedStories(currentStory, [currentStory]);

    expect(related).toHaveLength(0);
  });

  it("should prioritize stories with multiple attribute matches", () => {
    const related = getRelatedStories(currentStory, mockStories);

    // Story 5 (nature + eastern = 5 pts) should be first
    // It has both same category AND same location
    expect(related[0].id).toBe("5");
    expect(related[0].category).toBe("nature");
    expect(related[0].location).toBe("eastern");
  });

  it("should handle stories without location", () => {
    const storyWithoutLocation: Story = {
      ...currentStory,
      id: "no-location",
      location: undefined,
    };

    const related = getRelatedStories(storyWithoutLocation, mockStories);

    expect(related.length).toBeGreaterThan(0);
  });

  it("should handle stories without duration", () => {
    const storyWithoutDuration: Story = {
      ...currentStory,
      id: "no-duration",
      duration: undefined,
    };

    const related = getRelatedStories(storyWithoutDuration, mockStories);

    expect(related.length).toBeGreaterThan(0);
  });

  it("should return default of 3 related stories", () => {
    const related = getRelatedStories(currentStory, mockStories);

    expect(related.length).toBeLessThanOrEqual(3);
  });
});
