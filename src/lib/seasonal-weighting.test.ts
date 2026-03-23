import { describe, it, expect } from "vitest";
import { applySeasonalWeighting } from "./seasonal-weighting";
import type { Story } from "@/types/immersive";

function makeStory(overrides: Partial<Story> & { id: string }): Story {
  return {
    title: "Test Story",
    subtitle: "Subtitle",
    description: "Description",
    image: "/img.jpg",
    category: "nature",
    sourcePdf: "/pdf.pdf",
    ...overrides,
  };
}

describe("applySeasonalWeighting", () => {
  const stories: Story[] = [
    makeStory({ id: "s1", title: "Summer Beach", bestMonths: [6, 7, 8] }),
    makeStory({ id: "s2", title: "Winter Mountain", bestMonths: [12, 1, 2] }),
    makeStory({ id: "s3", title: "Spring Garden", bestMonths: [3, 4, 5] }),
    makeStory({ id: "s4", title: "All Year Museum" }),
    makeStory({ id: "s5", title: "Autumn Forest", bestMonths: [9, 10, 11] }),
  ];

  it("should place stories matching the current month first", () => {
    const result = applySeasonalWeighting(stories, 7); // July
    expect(result.stories[0].id).toBe("s1");
  });

  it("should place non-matching stories after boosted ones", () => {
    const result = applySeasonalWeighting(stories, 7); // July
    const boostedIds = result.stories
      .slice(0, result.boostedCount)
      .map((s) => s.id);
    const restIds = result.stories
      .slice(result.boostedCount)
      .map((s) => s.id);

    expect(boostedIds).toEqual(["s1"]);
    expect(restIds).toEqual(["s2", "s3", "s4", "s5"]);
  });

  it("should return correct boostedCount", () => {
    const result = applySeasonalWeighting(stories, 1); // January
    // s2 has bestMonths [12, 1, 2], so it matches January
    expect(result.boostedCount).toBe(1);

    const resultNone = applySeasonalWeighting(stories, 6); // June
    // s1 has bestMonths [6, 7, 8], so it matches June
    expect(resultNone.boostedCount).toBe(1);
  });

  it("should not boost stories without bestMonths", () => {
    const result = applySeasonalWeighting(stories, 7); // July
    const boosted = result.stories.slice(0, result.boostedCount);
    const hasNoBestMonths = boosted.some((s) => !s.bestMonths);
    expect(hasNoBestMonths).toBe(false);
  });

  it("should preserve relative order within boosted and non-boosted groups", () => {
    const winterStories: Story[] = [
      makeStory({ id: "w1", title: "First Winter", bestMonths: [1, 2] }),
      makeStory({ id: "a1", title: "All Year 1" }),
      makeStory({ id: "w2", title: "Second Winter", bestMonths: [1, 2] }),
      makeStory({ id: "a2", title: "All Year 2" }),
      makeStory({ id: "w3", title: "Third Winter", bestMonths: [1, 2] }),
    ];

    const result = applySeasonalWeighting(winterStories, 1); // January

    const boostedIds = result.stories
      .slice(0, result.boostedCount)
      .map((s) => s.id);
    const restIds = result.stories
      .slice(result.boostedCount)
      .map((s) => s.id);

    expect(boostedIds).toEqual(["w1", "w2", "w3"]);
    expect(restIds).toEqual(["a1", "a2"]);
    expect(result.boostedCount).toBe(3);
  });

  it("should return all stories with boostedCount 0 when nothing matches", () => {
    const noMatchStories: Story[] = [
      makeStory({ id: "x1", title: "Story 1", bestMonths: [6] }),
      makeStory({ id: "x2", title: "Story 2" }),
    ];

    const result = applySeasonalWeighting(noMatchStories, 12); // December
    expect(result.boostedCount).toBe(0);
    expect(result.stories.map((s) => s.id)).toEqual(["x1", "x2"]);
  });

  it("should default to current month when currentMonth is omitted", () => {
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const testStories: Story[] = [
      makeStory({ id: "m1", title: "Current Month", bestMonths: [currentMonth] }),
      makeStory({ id: "m2", title: "Other" }),
    ];

    const result = applySeasonalWeighting(testStories);
    expect(result.boostedCount).toBe(1);
    expect(result.stories[0].id).toBe("m1");
  });
});
