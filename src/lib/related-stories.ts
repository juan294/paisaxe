import type { Story } from "@/types/immersive";

interface ScoredStory {
  story: Story;
  score: number;
}

/**
 * Get related stories based on similarity to the current story.
 *
 * Scoring:
 * - Same category: +3 points (most important)
 * - Same location: +2 points
 * - Same duration: +1 point
 *
 * @param currentStory The story to find related stories for
 * @param allStories All available stories
 * @param limit Maximum number of related stories to return (default: 3)
 * @returns Array of related stories, sorted by relevance
 */
export function getRelatedStories(
  currentStory: Story,
  allStories: Story[],
  limit: number = 3
): Story[] {
  const scoredStories: ScoredStory[] = allStories
    .filter((story) => story.id !== currentStory.id)
    .map((story) => ({
      story,
      score: calculateRelevanceScore(currentStory, story),
    }))
    .filter((scored) => scored.score > 0);

  // Sort by score descending, then by title for consistent ordering
  scoredStories.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.story.title.localeCompare(b.story.title);
  });

  return scoredStories.slice(0, limit).map((scored) => scored.story);
}

function calculateRelevanceScore(current: Story, candidate: Story): number {
  let score = 0;

  // Category match is most important
  if (candidate.category === current.category) {
    score += 3;
  }

  // Location match
  if (current.location && candidate.location && candidate.location === current.location) {
    score += 2;
  }

  // Duration match
  if (current.duration && candidate.duration && candidate.duration === current.duration) {
    score += 1;
  }

  return score;
}
