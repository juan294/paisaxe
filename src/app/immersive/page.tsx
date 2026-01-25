"use client";

import { useState, useEffect } from "react";
import { StoryViewer } from "@/components/immersive/story-viewer";
import { VoiceChat } from "@/components/immersive/voice-chat";
import { FALLBACK_STORIES, getStoriesFromDB } from "@/lib/stories-data";
import { useStoryFilters } from "@/hooks/use-story-filters";
import type { Story } from "@/types/immersive";

export default function ImmersivePage() {
  const [allStories, setAllStories] = useState<Story[]>(FALLBACK_STORIES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {
    filteredStories,
    selectedCategory,
    selectedLocation,
    selectedDuration,
    setSelectedCategory,
    setSelectedLocation,
    setSelectedDuration,
    clearAll,
  } = useStoryFilters(allStories);

  useEffect(() => {
    async function loadStories() {
      try {
        const dbStories = await getStoriesFromDB();
        setAllStories(dbStories);
      } catch (error) {
        console.warn("Failed to load stories from DB, using fallback:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStories();
  }, []);

  // Reset index when filters change and current index is out of bounds
  useEffect(() => {
    if (currentIndex >= filteredStories.length && filteredStories.length > 0) {
      setCurrentIndex(0);
    }
  }, [filteredStories.length, currentIndex]);

  const currentStory = filteredStories[currentIndex];

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-white text-lg">Loading stories...</div>
      </div>
    );
  }

  // Show message when no stories match filters
  if (filteredStories.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
        <div className="text-white text-lg mb-4">No hay historias con estos filtros</div>
        <button
          onClick={clearAll}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all"
        >
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <>
      <StoryViewer
        stories={filteredStories}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
        onAskAbout={() => setChatOpen(true)}
        selectedCategory={selectedCategory}
        selectedLocation={selectedLocation}
        selectedDuration={selectedDuration}
        onCategoryChange={setSelectedCategory}
        onLocationChange={setSelectedLocation}
        onDurationChange={setSelectedDuration}
        onClearFilters={clearAll}
      />
      <VoiceChat
        story={currentStory}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
}
