"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Play, Pause, Bookmark } from "lucide-react";
import { BookmarkButton } from "./bookmark-button";
import { CategoryFilterBadge } from "./category-filter-badge";
import { AuthButton } from "@/components/auth/auth-button";
import { useFavorites } from "@/hooks/use-favorites";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useAnalytics } from "@/hooks/use-analytics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getRelatedStories } from "@/lib/related-stories";
import { RelatedStories } from "./related-stories";
import { QuestionPrompts } from "./question-prompts";
import { SurpriseMeButton } from "./surprise-me-button";
import { FreshnessBadge } from "./freshness-badge";
import { ShareButton } from "./share-button";
import { AmbientIndicator } from "./ambient-indicator";
import { LanguageSwitcher } from "./language-switcher";
import { getLabel } from "@/lib/asturianu";
import { useTranslation } from "@/lib/i18n";

// Simple dark placeholder for images (prevents flash of white)
const darkPlaceholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%231a1a1a' width='1' height='1'/%3E%3C/svg%3E";

interface StoryViewerProps {
  stories: Story[];
  allStories: Story[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onAskAbout: (initialMessage?: string) => void;
  chatOpen?: boolean;
  // Filter props
  selectedCategory: StoryCategory | null;
  selectedLocation: StoryLocation | null;
  selectedDuration: StoryDuration | null;
  onCategoryChange: (category: StoryCategory | null) => void;
  onLocationChange: (location: StoryLocation | null) => void;
  onDurationChange: (duration: StoryDuration | null) => void;
  onClearFilters: () => void;
  // Surprise Me props
  viewedIndices?: Set<number>;
}

export function StoryViewer({
  stories,
  allStories,
  currentIndex,
  onIndexChange,
  onAskAbout,
  chatOpen = false,
  selectedCategory,
  selectedLocation,
  selectedDuration,
  onCategoryChange,
  onLocationChange,
  onDurationChange,
  onClearFilters,
  viewedIndices,
}: StoryViewerProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [ambientMode, setAmbientMode] = useState(false);

  const { isEnabled } = useFeatureFlags();
  const { trackEvent } = useAnalytics();
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  const {
    isFavorite,
    toggleFavorite,
  } = useFavorites();

  const story = stories[currentIndex];
  const prefetchedUrls = useRef<Set<string>>(new Set());
  const ambientStartRef = useRef<number | null>(null);
  const asturianTrackedRef = useRef<string | null>(null);

  // Track Asturianu visibility
  useEffect(() => {
    if (isEnabled("asturianu_touches") && story && asturianTrackedRef.current !== story.id) {
      asturianTrackedRef.current = story.id;
      trackEvent("asturianu_visible", "asturianu_touches", { storyId: story.id });
    }
  }, [isEnabled, story, trackEvent]);

  // Prefetch adjacent images for smoother navigation
  useEffect(() => {
    const prefetchImage = (url: string) => {
      if (!url || prefetchedUrls.current.has(url)) return;

      const img = new window.Image();
      img.src = url;
      prefetchedUrls.current.add(url);
    };

    if (stories.length === 0) return;
    // Prefetch next image (wraps to first)
    const nextIdx = (currentIndex + 1) % stories.length;
    prefetchImage(stories[nextIdx].image);
    // Prefetch previous image (wraps to last)
    const prevIdx = (currentIndex - 1 + stories.length) % stories.length;
    prefetchImage(stories[prevIdx].image);
    // Prefetch 2 ahead (for faster auto-play)
    const next2Idx = (currentIndex + 2) % stories.length;
    prefetchImage(stories[next2Idx].image);
  }, [currentIndex, stories]);

  const goToNext = useCallback(() => {
    const nextIndex = currentIndex < stories.length - 1 ? currentIndex + 1 : 0;
    if (prefersReducedMotion) {
      onIndexChange(nextIndex);
      return;
    }
    setIsTransitioning(true);
    setTimeout(() => {
      onIndexChange(nextIndex);
      setIsTransitioning(false);
    }, 300);
  }, [currentIndex, stories.length, onIndexChange, prefersReducedMotion]);

  const goToPrev = useCallback(() => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : stories.length - 1;
    if (prefersReducedMotion) {
      onIndexChange(prevIndex);
      return;
    }
    setIsTransitioning(true);
    setTimeout(() => {
      onIndexChange(prevIndex);
      setIsTransitioning(false);
    }, 300);
  }, [currentIndex, stories.length, onIndexChange, prefersReducedMotion]);

  // Keyboard navigation (disabled while chat is open)
  useEffect(() => {
    if (chatOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "i") {
        setShowInfo((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chatOpen, goToNext, goToPrev]);

  // Auto-play (paused while chat is open, disabled when reduced motion is preferred)
  const autoPlayInterval = ambientMode && isEnabled("ambient_discovery") ? 12000 : 6000;
  useEffect(() => {
    if (!autoPlay || chatOpen || prefersReducedMotion) return;
    const timer = setInterval(goToNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [autoPlay, chatOpen, goToNext, autoPlayInterval, prefersReducedMotion]);

  // Toggle ambient mode
  const toggleAmbient = useCallback(() => {
    setAmbientMode((prev) => {
      const newValue = !prev;
      if (newValue) {
        ambientStartRef.current = Date.now();
        setAutoPlay(true);
      } else {
        const duration = ambientStartRef.current ? Date.now() - ambientStartRef.current : 0;
        trackEvent("ambient_mode_toggle", "ambient_discovery", { enabled: false, duration });
        ambientStartRef.current = null;
      }
      trackEvent("ambient_mode_toggle", "ambient_discovery", { enabled: newValue, duration: 0 });
      return newValue;
    });
  }, [trackEvent]);

  // Determine animation class (disabled when reduced motion is preferred)
  const isAmbient = ambientMode && isEnabled("ambient_discovery");
  const zoomClass = prefersReducedMotion
    ? undefined
    : isAmbient ? "animate-ambient-zoom" : autoPlay ? "animate-slow-zoom" : undefined;

  // Related stories
  const relatedStories = story ? getRelatedStories(story, allStories) : [];

  // Asturianu labels
  const ast = isEnabled("asturianu_touches");

  if (!story) return null;

  // Question prompts from metadata
  const questionPrompts = story.metadata?.question_prompts || [];

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-black cursor-pointer"
      onClick={() => setShowInfo((prev) => !prev)}
    >
      {/* Screen reader announcement for story changes */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {t("accessibility.story_counter")
          .replace("{current}", String(currentIndex + 1))
          .replace("{total}", String(stories.length))}: {story.title} — {story.subtitle}
      </div>

      {/* Background Image with Ken Burns effect */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none",
          isTransitioning ? "opacity-0" : "opacity-100"
        )}
      >
        <Image
          src={story.image}
          alt={story.title}
          fill
          sizes="100vw"
          className={cn("object-cover", zoomClass)}
          priority
          placeholder="blur"
          blurDataURL={darkPlaceholder}
          key={`${story.id}-${isAmbient ? "ambient" : autoPlay ? "auto" : "static"}`}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
      </div>

      {/* Progress bar - fixed segments that fill and reset, creating an infinite flow */}
      {(() => {
        const PAGE_SIZE = 20;
        const segmentCount = Math.min(PAGE_SIZE, stories.length);
        const fillPosition = currentIndex % segmentCount;

        return (
          <div
            role="progressbar"
            aria-label={t("accessibility.story_progress")}
            aria-valuenow={currentIndex + 1}
            aria-valuemin={1}
            aria-valuemax={stories.length}
            className="absolute top-0 left-0 right-0 z-20 flex items-center gap-1 p-4"
          >
            {Array.from({ length: segmentCount }, (_, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden cursor-pointer transition-all duration-300 motion-reduce:transition-none"
                onClick={(e) => {
                  e.stopPropagation();
                  // Jump to the story this segment represents in the current cycle
                  const base = currentIndex - fillPosition;
                  const targetIndex = base + i;
                  if (targetIndex >= 0 && targetIndex < stories.length) {
                    onIndexChange(targetIndex);
                  }
                }}
              >
                <div
                  className={cn(
                    "h-full bg-white transition-all duration-300 motion-reduce:transition-none",
                    i <= fillPosition ? "w-full" : "w-0"
                  )}
                />
              </div>
            ))}
          </div>
        );
      })()}

      {/* Category badge / Filter */}
      <CategoryFilterBadge
        currentCategory={story.category}
        selectedCategory={selectedCategory}
        selectedLocation={selectedLocation}
        selectedDuration={selectedDuration}
        onCategoryChange={onCategoryChange}
        onLocationChange={onLocationChange}
        onDurationChange={onDurationChange}
        onClearAll={onClearFilters}
        visible={showInfo}
      />

      {/* Related Stories - shown when info is visible and feature enabled */}
      {isEnabled("related_stories") && showInfo && relatedStories.length > 0 && (
        <RelatedStories
          stories={relatedStories}
          onSelectStory={(related) => {
            trackEvent("related_story_click", "related_stories", {
              fromStoryId: story.id,
              toStoryId: related.id,
            });
            const targetIndex = stories.findIndex((s) => s.id === related.id);
            if (targetIndex >= 0) {
              onIndexChange(targetIndex);
            }
          }}
        />
      )}

      {/* Main content */}
      <article
        className={cn(
          "absolute bottom-0 left-0 right-0 p-8 md:p-12 z-10 transition-all duration-500 motion-reduce:transition-none",
          showInfo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 motion-reduce:translate-y-0"
        )}
      >
        {/* Freshness badge */}
        {isEnabled("story_freshness") && (
          <div className="mb-2">
            <FreshnessBadge createdAt={story.createdAt} storyId={story.id} />
          </div>
        )}

        <p className="text-white/70 text-sm md:text-base font-medium mb-2 tracking-wider uppercase">
          {ast && story.metadata?.asturianu_subtitle
            ? story.metadata.asturianu_subtitle
            : story.subtitle}
        </p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
          {ast && story.metadata?.asturianu_title
            ? story.metadata.asturianu_title
            : story.title}
        </h1>
        <p className="text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed mb-2">
          {story.description}
        </p>

        {/* Image source attribution */}
        {story.imageSource && (
          <p className="text-xs text-white/50 mb-6">
            {story.imageSource}
          </p>
        )}

        {!story.imageSource && <div className="mb-6" />}

        {/* Contextual question prompts */}
        {isEnabled("contextual_prompts") && questionPrompts.length > 0 && (
          <QuestionPrompts
            prompts={questionPrompts}
            storyId={story.id}
            onSelectPrompt={(prompt) => onAskAbout(prompt)}
          />
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAskAbout();
            }}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all motion-reduce:transition-none hover:scale-105 motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {ast ? getLabel("ask_about", true) : t("stories.ask_about")}
          </button>
          <a
            href="/favorites"
            onClick={(e) => e.stopPropagation()}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all motion-reduce:transition-none hover:scale-105 motion-reduce:hover:scale-100 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Bookmark className="h-5 w-5" />
            <span>{ast ? getLabel("saved", true) : t("favorites.saved")}</span>
          </a>
        </div>
      </article>

      {/* Navigation arrows */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          goToPrev();
        }}
        aria-label={t("accessibility.previous_story")}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <ChevronLeft className="h-8 w-8 text-white" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          goToNext();
        }}
        aria-label={t("accessibility.next_story")}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <ChevronRight className="h-8 w-8 text-white" />
      </button>

      {/* Top-right controls: Language + Auth + Auto-play + Share + Surprise + Favorites */}
      <nav aria-label="Story controls" className="absolute top-16 right-6 z-20 flex items-center gap-3">
        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Ambient mode indicator */}
        {isAmbient && <AmbientIndicator />}

        {/* Ambient / Auto-play toggle */}
        {isEnabled("ambient_discovery") ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAmbient();
            }}
            className={cn(
              "p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              ambientMode && "ring-1 ring-white/30"
            )}
            aria-label={autoPlay ? t("accessibility.pause_stories") : t("accessibility.play_stories")}
            title={ambientMode ? t("stories.ambient_off") : t("stories.ambient_on")}
          >
            {autoPlay ? (
              <Pause className="h-5 w-5 text-white" />
            ) : (
              <Play className="h-5 w-5 text-white" />
            )}
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAutoPlay((prev) => !prev);
            }}
            aria-label={autoPlay ? t("accessibility.pause_stories") : t("accessibility.play_stories")}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {autoPlay ? (
              <Pause className="h-5 w-5 text-white" />
            ) : (
              <Play className="h-5 w-5 text-white" />
            )}
          </button>
        )}

        {/* Surprise Me button */}
        {isEnabled("surprise_me") && viewedIndices && (
          <SurpriseMeButton
            totalStories={stories.length}
            currentIndex={currentIndex}
            viewedIndices={viewedIndices}
            onJumpTo={onIndexChange}
          />
        )}

        {/* Share button */}
        {isEnabled("story_sharing") && <ShareButton story={story} />}

        <BookmarkButton
          isFavorite={isFavorite(story.id)}
          onToggle={() => toggleFavorite(story.id)}
        />
        <AuthButton />
      </nav>

      {/* Keyboard hints */}
      <div
        className={cn(
          "absolute bottom-4 right-4 z-20 text-white/40 text-xs transition-opacity duration-500 motion-reduce:transition-none",
          showInfo ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      >
        ← → {t("nav.navigate")} · i {t("nav.show_hide")} · {t("nav.space")} {t("nav.next")}
      </div>
    </main>
  );
}
