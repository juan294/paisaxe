import type { Story, StoryCategory } from "@/types/immersive";

export type Mood = "relajante" | "aventurero" | "cultural" | "delicioso";

/**
 * Maps moods to story categories that match them.
 * A story matches if its category is in the mood's category list,
 * OR if it has a mood_tag in its metadata.
 */
export const MOOD_CATEGORY_MAP: Record<Mood, StoryCategory[]> = {
  relajante: ["nature"],
  aventurero: ["activities", "nature"],
  cultural: ["culture", "cities"],
  delicioso: ["food"],
};

export function filterByMood(stories: Story[], mood: Mood): Story[] {
  const categories = MOOD_CATEGORY_MAP[mood];

  return stories.filter((story) => {
    // Check metadata mood_tags first
    const metadata = story as Story & { metadata?: Record<string, unknown> };
    const moodTags = metadata.metadata?.mood_tags as string[] | undefined;
    if (moodTags && moodTags.includes(mood)) {
      return true;
    }

    // Fall back to category matching
    return categories.includes(story.category);
  });
}
