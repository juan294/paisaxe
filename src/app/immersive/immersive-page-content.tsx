"use client";

import { useState, useEffect, useMemo, useRef, Suspense, useTransition, useCallback } from "react";
import dynamic from "next/dynamic";
import { StoryViewer } from "@/components/immersive/story-viewer";
import { StoryCardSkeleton } from "@/components/immersive/skeleton-story-card";
import { useStories } from "@/hooks/use-stories";
import type { Story } from "@/types/immersive";
import { useStoryFilters } from "@/hooks/use-story-filters";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useViewedStories } from "@/hooks/use-viewed-stories";
import { fisherYatesShuffle } from "@/lib/shuffle";
import { applySeasonalWeighting } from "@/lib/seasonal-weighting";
import { filterByMood, type Mood } from "@/lib/mood-mapping";
import { MoodOverlay } from "@/components/immersive/mood-overlay";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { ComponentErrorBoundary } from "@/components/ui/component-error-boundary";

// Dynamically import VoiceChat - only loads when chat is opened
// This saves ~15KB+ from initial bundle
const VoiceChat = dynamic(
  () => import("@/components/immersive/voice-chat").then((mod) => mod.VoiceChat),
  {
    ssr: false,
    loading: () => null, // No loading UI needed, chat panel handles its own state
  }
);

interface ImmersivePageContentProps {
  /**
   * Server-generated shuffle seed.
   * If provided (non-null), stories will be shuffled immediately on first render.
   * This prevents the flicker that occurs when shuffle is applied after hydration.
   */
  serverShuffleSeed: number | null;
  /** Server-fetched stories to seed the client cache and skip loading state */
  initialStories?: Story[];
  /**
   * Server-fetched feature flags.
   * When provided, useFeatureFlags uses these as the initial state and sets
   * isReady=true immediately — eliminating flag-gated UI flash on first paint.
   */
  initialFlags?: Partial<Record<import("@/types/feature-flags").FeatureFlagKey, boolean>>;
}

export function ImmersivePageContent({ serverShuffleSeed, initialStories, initialFlags }: ImmersivePageContentProps) {
  const { stories: allStories, isLoading } = useStories(initialStories);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string | undefined>();
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [moodDismissed, setMoodDismissed] = useState(false);
  const [, startTransition] = useTransition();
  const deepLinkHandled = useRef(false);
  const chatTriggerRef = useRef<HTMLButtonElement>(null);

  // Use server-provided seed if available, otherwise generate client-side
  // This ensures shuffling happens on first render without flicker
  const shuffleSeed = useRef(serverShuffleSeed ?? Math.floor(Math.random() * 2147483647));

  // Pass server-fetched initialFlags so the hook is ready immediately on first
  // paint — no client fetch on mount, no flag-gated UI flash.
  const { isEnabled, isReady: flagsReady } = useFeatureFlags(initialFlags);
  const { t } = useTranslation();
  const { viewedIndices, markViewed } = useViewedStories();
  const searchParams = useSearchParams();

  // Wrap index changes in startTransition so the browser can process touch events
  // between render chunks, improving responsiveness on mobile
  const handleIndexChange = useCallback(
    (index: number) => {
      startTransition(() => {
        setCurrentIndex(index);
      });
    },
    [startTransition]
  );

  // Check if mood was already dismissed this session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = sessionStorage.getItem("paisaxe-mood-dismissed");
      if (dismissed) setMoodDismissed(true);
    }
  }, []);

  // Prefetch voice chat chunk during idle time to eliminate cold-start latency
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => {
        import("@/components/immersive/voice-chat");
      });
    }
  }, []);

  // Story ordering pipeline: allStories -> mood filter -> seasonal -> shuffle -> filters
  // Key fix: If serverShuffleSeed is provided, shuffle immediately without waiting for flags
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

    // 3. Shuffle - if server provided a seed, shuffle immediately (flag was already checked server-side)
    //    Otherwise, wait for client-side flags to be ready
    const shouldShuffle = serverShuffleSeed !== null || isEnabled("randomized_order");
    if (shouldShuffle) {
      stories = fisherYatesShuffle(stories, shuffleSeed.current);
    }

    return stories;
  }, [allStories, selectedMood, isEnabled, serverShuffleSeed]);

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

  // Check for ?story= query param from share links or post-payment return.
  // Searches filteredStories (post-shuffle) so the index matches the displayed order.
  // Uses a ref guard to fire only once — prevents re-triggering on filter changes.
  useEffect(() => {
    const storySlug = searchParams.get("story");
    if (storySlug && filteredStories.length > 0 && !deepLinkHandled.current) {
      const index = filteredStories.findIndex((s) => s.slug === storySlug || s.id === storySlug);
      if (index >= 0) {
        deepLinkHandled.current = true;
        setCurrentIndex(index);
        if (searchParams.get("voice") === "ready") {
          setChatOpen(true);
        }
      }
    }
  }, [searchParams, filteredStories]);

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

  // Show mood overlay if enabled, not dismissed, stories are loaded, and flags are ready
  // We wait for flagsReady to prevent the overlay from popping in after page render
  const showMoodOverlay = flagsReady && isEnabled("mood_discovery") && !moodDismissed && !isLoading && allStories.length > 0;

  if (isLoading) {
    return <StoryCardSkeleton />;
  }

  // Show message when no stories match filters
  if (filteredStories.length === 0) {
    return (
      <div role="alert" aria-live="assertive" className="fixed inset-0 flex flex-col items-center justify-center bg-black">
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

      <ComponentErrorBoundary>
        <StoryViewer
          stories={filteredStories}
          allStories={allStories}
          currentIndex={currentIndex}
          onIndexChange={handleIndexChange}
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
          chatTriggerRef={chatTriggerRef}
        />
      </ComponentErrorBoundary>
      {/* Only render VoiceChat when opened - lazy loaded */}
      {chatOpen && (
        <Suspense fallback={null}>
          <ComponentErrorBoundary>
            <VoiceChat
              story={currentStory}
              open={chatOpen}
              onClose={handleCloseChat}
              initialMessage={initialMessage}
              triggerRef={chatTriggerRef}
            />
          </ComponentErrorBoundary>
        </Suspense>
      )}
    </>
  );
}
