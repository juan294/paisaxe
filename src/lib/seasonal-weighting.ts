import type { Story } from "@/types/immersive";

/**
 * Apply seasonal weighting to stories based on the current month.
 * Stories tagged with the current month via bestMonths get boosted to the top
 * while maintaining relative order within boosted and non-boosted groups.
 */
export function applySeasonalWeighting(
  stories: Story[],
  currentMonth?: number
): { stories: Story[]; boostedCount: number } {
  const month = currentMonth ?? new Date().getMonth() + 1; // 1-12

  const boosted: Story[] = [];
  const rest: Story[] = [];

  for (const story of stories) {
    if (story.bestMonths && story.bestMonths.includes(month)) {
      boosted.push(story);
    } else {
      rest.push(story);
    }
  }

  return {
    stories: [...boosted, ...rest],
    boostedCount: boosted.length,
  };
}
