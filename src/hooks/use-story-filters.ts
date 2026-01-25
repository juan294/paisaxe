import { useState, useMemo } from "react";
import type { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";

export interface UseStoryFiltersReturn {
  filteredStories: Story[];
  selectedCategory: StoryCategory | null;
  selectedLocation: StoryLocation | null;
  selectedDuration: StoryDuration | null;
  setSelectedCategory: (category: StoryCategory | null) => void;
  setSelectedLocation: (location: StoryLocation | null) => void;
  setSelectedDuration: (duration: StoryDuration | null) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
}

export function useStoryFilters(stories: Story[]): UseStoryFiltersReturn {
  const [selectedCategory, setSelectedCategory] = useState<StoryCategory | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<StoryLocation | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<StoryDuration | null>(null);

  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      if (selectedCategory && story.category !== selectedCategory) {
        return false;
      }
      if (selectedLocation && story.location !== selectedLocation) {
        return false;
      }
      if (selectedDuration && story.duration !== selectedDuration) {
        return false;
      }
      return true;
    });
  }, [stories, selectedCategory, selectedLocation, selectedDuration]);

  const hasActiveFilters = selectedCategory !== null || selectedLocation !== null || selectedDuration !== null;

  const clearAll = () => {
    setSelectedCategory(null);
    setSelectedLocation(null);
    setSelectedDuration(null);
  };

  return {
    filteredStories,
    selectedCategory,
    selectedLocation,
    selectedDuration,
    setSelectedCategory,
    setSelectedLocation,
    setSelectedDuration,
    clearAll,
    hasActiveFilters,
  };
}
