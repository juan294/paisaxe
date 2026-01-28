"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import { StoryViewer } from "@/components/immersive/story-viewer";
import { StoryCardSkeleton } from "@/components/immersive/skeleton-story-card";
import { useStories } from "@/hooks/use-stories";
import { useStoryFilters } from "@/hooks/use-story-filters";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useViewedStories } from "@/hooks/use-viewed-stories";
import { fisherYatesShuffle } from "@/lib/shuffle";
import { applySeasonalWeighting } from "@/lib/seasonal-weighting";
import { filterByMood, type Mood } from "@/lib/mood-mapping";
import { MoodOverlay } from "@/components/immersive/mood-overlay";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

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
  return (
    <Suspense
      fallback={<StoryCardSkeleton />}
    >
      <ImmersivePageContent />
    </Suspense>
  );
}

function ImmersivePageContent() {
  const { stories: allStories, isLoading } = useStories();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>();
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [moodDismissed, setMoodDismissed] = useState(false);

  // Generate a fresh seed on each page load (stored in ref for stability during re-renders)
  const shuffleSeed = useRef(Math.floor(Math.random() * 2147483647));

  const { isEnabled } = useFeatureFlags();
  const { t } = useTranslation();
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
      const { stories: weighted } = applySeasonalWeighting(stories);
      stories = weighted;
    }

    // 3. Shuffle (if enabled) - uses fresh seed per page load
    if (isEnabled("randomized_order")) {
      stories = fisherYatesShuffle(stories, shuffleSeed.current);
    }

    return stories;
  }, [allStories, selectedMood, isEnabled]);

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
    return <StoryCardSkeleton />;
  }

  // Show message when no stories match filters
  if (filteredStories.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
        <div className="text-white text-lg mb-4">{t("stories.no_results")}</div>
        <button
          onClick={() => {
            clearAll();
            setSelectedMood(null);
          }}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-all"
        >
          {t("stories.filters.clear")}
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
