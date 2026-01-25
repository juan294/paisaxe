"use client";

import { StoryCard } from "./story-card";
import type { AdminStory } from "@/types/admin";

interface StoryGridProps {
  stories: AdminStory[];
  onEdit: (story: AdminStory) => void;
}

export function StoryGrid({ stories, onEdit }: StoryGridProps) {
  if (stories.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
        No stories found
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} onEdit={onEdit} />
      ))}
    </div>
  );
}
