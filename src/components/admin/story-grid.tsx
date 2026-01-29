"use client";

import { StoryCard } from "./story-card";
import type { AdminStory } from "@/types/admin";

interface StoryGridProps {
  stories: AdminStory[];
  onEdit: (story: AdminStory) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (storyId: string) => void;
  selectionMode?: boolean;
}

export function StoryGrid({
  stories,
  onEdit,
  selectedIds,
  onToggleSelect,
  selectionMode = false,
}: StoryGridProps) {
  if (stories.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-neutral-500">
        No stories found
      </div>
    );
  }

  // Create visual rhythm: every 5th item spans 2 columns (if it has an image)
  const getSpan = (index: number, story: AdminStory): 1 | 2 => {
    if (!story.image) return 1;
    // Pattern: items at positions 0, 5, 10, 15... get span 2
    return index % 5 === 0 ? 2 : 1;
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stories.map((story, index) => (
        <StoryCard
          key={story.id}
          story={story}
          onEdit={onEdit}
          span={getSpan(index, story)}
          isSelected={selectedIds?.has(story.id)}
          onToggleSelect={onToggleSelect}
          selectionMode={selectionMode}
        />
      ))}
    </div>
  );
}
