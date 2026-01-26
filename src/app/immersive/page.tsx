"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { StoryViewer } from "@/components/immersive/story-viewer";
import { useStories } from "@/hooks/use-stories";
import { useStoryFilters } from "@/hooks/use-story-filters";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useAnalytics } from "@/hooks/use-analytics";
import { useViewedStories } from "@/hooks/use-viewed-stories";
import { fisherYatesShuffle } from "@/lib/shuffle";
import { applySeasonalWeighting } from "@/lib/seasonal-weighting";
import { filterByMood, type Mood } from "@/lib/mood-mapping";
import { MoodOverlay } from "@/components/immersive/mood-overlay";
import { useSearchParams } from "next/navigation";

// Dynamically import VoiceChat - only loads when chat is opened
// This saves ~15KB+ from initial bundle
const VoiceChat = dynamic(
  () => import("@/components/immersive/voice-chat").then((mod) => mod.VoiceChat),
  {
    ssr: false,
    loading: () => null, // No loading UI needed, chat panel handles its own state
  }
);

// Generate a session-stable seed for shuffling
function getSessionSeed(): number {
  if (typeof window === "undefined") return 0;
  let seed = sessionStorage.getItem("paisaxe-shuffle-seed");
  if (!seed) {
    seed = String(Math.floor(Math.random() * 2147483647));
    sessionStorage.setItem("paisaxe-shuffle-seed", seed);
  }
  return parseInt(seed, 10);
}

export default function ImmersivePage() {
  const { stories: allStories, isLoading } = useStories();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>();
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [moodDismissed, setMoodDismissed] = useState(false);

  const { isEnabled } = useFeatureFlags();
  const { trackEvent } = useAnalytics();
  const { viewedIndices, markViewed } = useViewedStories();
  const searchParams = useSearchParams();

  // Check for ?story= query param from share links
  useEffect(() => {
    const storySlug = searchParams.get("story");
    if (storySlug && allStories.length > 0) {
      const index = allStories.findIndex((s) => s.slug === storySlug || s.id === storySlug);
      if (index >= 0) {
        setCurrentIndex(index);
      }
    }
  }, [searchParams, allStories]);

  // Check if mood was already dismissed this session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = sessionStorage.getItem("paisaxe-mood-dismissed");
      if (dismissed) setMoodDismissed(true);
    }
  }, []);

  // Story ordering pipeline: allStories -> mood filter -> seasonal -> shuffle -> filters
  const processedStories = useMemo(() => {
    let stories = [...allStories];

    // 1. Mood filter (if selected)
    if (selectedMood) {
      stories = filterByMood(stories, selectedMood);
    }

    // 2. Seasonal weighting (if enabled)
    if (isEnabled("seasonal_surfacing")) {
      const { stories: weighted, boostedCount } = applySeasonalWeighting(stories);
      stories = weighted;
      if (boostedCount > 0) {
        trackEvent("seasonal_weight_applied", "seasonal_surfacing", {
          month: new Date().getMonth() + 1,
          boostedCount,
        });
      }
    }

    // 3. Shuffle (if enabled)
    if (isEnabled("randomized_order")) {
      const seed = getSessionSeed();
      stories = fisherYatesShuffle(stories, seed);
      trackEvent("session_story_order", "randomized_order", { orderSeed: seed });
    }

    return stories;
    // Only re-run when source data or flags change, not on every trackEvent reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStories, selectedMood, isEnabled("seasonal_surfacing"), isEnabled("randomized_order")]);

  const {
    filteredStories,
    selectedCategory,
    selectedLocation,
    selectedDuration,
    setSelectedCategory,
    setSelectedLocation,
    setSelectedDuration,
    clearAll,
  } = useStoryFilters(processedStories);

  // Reset index when filters change and current index is out of bounds
  useEffect(() => {
    if (currentIndex >= filteredStories.length && filteredStories.length > 0) {
      setCurrentIndex(0);
    }
  }, [filteredStories.length, currentIndex]);

  // Mark story as viewed when index changes
  useEffect(() => {
    markViewed(currentIndex);
  }, [currentIndex, markViewed]);

  const currentStory = filteredStories[currentIndex];

  const handleAskAbout = (prefilledMessage?: string) => {
    setInitialMessage(prefilledMessage);
    setChatOpen(true);
  };

  const handleCloseChat = () => {
    setChatOpen(false);
    setInitialMessage(undefined);
  };

  const handleMoodSelect = (mood: Mood) => {
    setSelectedMood(mood);
    setMoodDismissed(true);
    sessionStorage.setItem("paisaxe-mood-dismissed", "true");
    setCurrentIndex(0);
  };

  const handleMoodDismiss = () => {
    setMoodDismissed(true);
    sessionStorage.setItem("paisaxe-mood-dismissed", "true");
  };

  // Show mood overlay if enabled, not dismissed, and stories are loaded
  const showMoodOverlay = isEnabled("mood_discovery") && !moodDismissed && !isLoading && allStories.length > 0;

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
          onClick={() => {
            clearAll();
            setSelectedMood(null);
          }}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all"
        >
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Mood overlay */}
      {showMoodOverlay && (
        <MoodOverlay onSelectMood={handleMoodSelect} onDismiss={handleMoodDismiss} />
      )}

      <StoryViewer
        stories={filteredStories}
        allStories={allStories}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
        onAskAbout={handleAskAbout}
        chatOpen={chatOpen}
        selectedCategory={selectedCategory}
        selectedLocation={selectedLocation}
        selectedDuration={selectedDuration}
        onCategoryChange={setSelectedCategory}
        onLocationChange={setSelectedLocation}
        onDurationChange={setSelectedDuration}
        onClearFilters={clearAll}
        viewedIndices={viewedIndices}
      />
      {/* Only render VoiceChat when opened - lazy loaded */}
      {chatOpen && (
        <Suspense fallback={null}>
          <VoiceChat
            story={currentStory}
            open={chatOpen}
            onClose={handleCloseChat}
            initialMessage={initialMessage}
          />
        </Suspense>
      )}
    </>
  );
}
