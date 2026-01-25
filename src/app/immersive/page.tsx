"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { StoryViewer } from "@/components/immersive/story-viewer";
import { useStories } from "@/hooks/use-stories";
import { useStoryFilters } from "@/hooks/use-story-filters";

// Dynamically import VoiceChat - only loads when chat is opened
// This saves ~15KB+ from initial bundle
const VoiceChat = dynamic(
  () => import("@/components/immersive/voice-chat").then((mod) => mod.VoiceChat),
  {
    ssr: false,
    loading: () => null, // No loading UI needed, chat panel handles its own state
  }
);

export default function ImmersivePage() {
  const { stories: allStories, isLoading } = useStories();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

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
      {/* Only render VoiceChat when opened - lazy loaded */}
      {chatOpen && (
        <Suspense fallback={null}>
          <VoiceChat
            story={currentStory}
            open={chatOpen}
            onClose={() => setChatOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}
