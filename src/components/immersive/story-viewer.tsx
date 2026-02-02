"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Play, Pause, Bookmark, Share2, Shuffle, Lightbulb } from "lucide-react";
import { BookmarkButton } from "./bookmark-button";
import { CategoryFilterBadge } from "./category-filter-badge";
import { AuthButton } from "@/components/auth/auth-button";
import { useFavorites } from "@/hooks/use-favorites";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getRelatedStories } from "@/lib/related-stories";
import { RelatedStories } from "./related-stories";
import { QuestionPrompts } from "./question-prompts";
import { SurpriseMeButton } from "./surprise-me-button";
import { FreshnessBadge } from "./freshness-badge";
import { ShareButton } from "./share-button";
import { LanguageSwitcher } from "./language-switcher";
import { SuggestPlaceButton } from "./suggest-place-button";
import { UserSubmittedBadge } from "./user-submitted-badge";
import { ToolbarOverflowMenu, ToolbarOverflowItem } from "./toolbar-overflow-menu";
import { FullscreenButton } from "./fullscreen-button";
import { getLabel } from "@/lib/asturianu";
import { useTranslation } from "@/lib/i18n";
import { getLocalizedStory } from "@/lib/localize-story";

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
  const { t, locale } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  const { requiresAuth } = useFavorites();

  const { signInWithGoogle } = useAuth();
  const router = useRouter();

  const story = stories[currentIndex];
  const prefetchedUrls = useRef<Set<string>>(new Set());
  const ambientStartRef = useRef<number | null>(null);

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
        ambientStartRef.current = null;
      }
      return newValue;
    });
  }, []);

  // Determine animation class (disabled when reduced motion is preferred)
  const isAmbient = ambientMode && isEnabled("ambient_discovery");
  const zoomClass = prefersReducedMotion
    ? undefined
    : isAmbient ? "animate-ambient-zoom" : autoPlay ? "animate-slow-zoom" : undefined;

  // Related stories - memoized to prevent recomputation on every render
  const relatedStories = useMemo(
    () => (story ? getRelatedStories(story, allStories) : []),
    [story, allStories]
  );

  // Asturianu labels
  const ast = isEnabled("asturianu_touches");

  // Get localized story text based on current locale (falls back to Spanish)
  const localizedStory = story ? getLocalizedStory(story, locale) : null;

  if (!story || !localizedStory) return null;

  // Question prompts from metadata
  const questionPrompts = story.metadata?.question_prompts || [];

  return (
    <main
      className="relative h-dvh w-screen overflow-hidden bg-black cursor-pointer"
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
          .replace("{total}", String(stories.length))}: {localizedStory.title} — {localizedStory.subtitle}
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
          blurDataURL={story.blurDataUrl || darkPlaceholder}
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
          "absolute bottom-0 left-0 right-0 p-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:p-12 z-10 transition-all duration-500 motion-reduce:transition-none",
          showInfo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 motion-reduce:translate-y-0"
        )}
      >
        {/* Badges */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {/* Freshness badge */}
          {isEnabled("story_freshness") && (
            <FreshnessBadge createdAt={story.createdAt} storyId={story.id} />
          )}
          {/* User-submitted badge */}
          {story.sourceType === "user_submitted" && (
            <UserSubmittedBadge />
          )}
        </div>

        <p className="text-white/70 text-sm md:text-base font-medium mb-2 tracking-wider uppercase">
          {ast && story.metadata?.asturianu_subtitle
            ? story.metadata.asturianu_subtitle
            : localizedStory.subtitle}
        </p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
          {ast && story.metadata?.asturianu_title
            ? story.metadata.asturianu_title
            : localizedStory.title}
        </h1>
        <p className="text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed mb-2">
          {localizedStory.description}
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
            data-testid="ask-button"
            onClick={(e) => {
              e.stopPropagation();
              onAskAbout();
            }}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all motion-reduce:transition-none hover:scale-105 motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {ast ? getLabel("ask_about", true) : t("stories.ask_about")}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (requiresAuth) {
                signInWithGoogle();
              } else {
                router.push("/favorites");
              }
            }}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all motion-reduce:transition-none hover:scale-105 motion-reduce:hover:scale-100 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Bookmark className="h-5 w-5" />
            <span>{ast ? getLabel("bookmarks", true) : t("favorites.bookmarks")}</span>
          </button>
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
      <nav aria-label="Story controls" className="absolute top-16 right-4 md:right-6 z-20 flex items-center gap-2 md:gap-3 max-w-[calc(100%-8rem)]">
        {/* Language Switcher - always visible */}
        <LanguageSwitcher />

        {/* Desktop: Show all controls inline */}
        {/* Ambient / Auto-play toggle - hidden on mobile */}
        {isEnabled("autoplay_button") && (
          isEnabled("ambient_discovery") ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleAmbient();
              }}
              className={cn(
                "hidden md:flex p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
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
              className="hidden md:flex p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              {autoPlay ? (
                <Pause className="h-5 w-5 text-white" />
              ) : (
                <Play className="h-5 w-5 text-white" />
              )}
            </button>
          )
        )}

        {/* Surprise Me button - hidden on mobile */}
        {isEnabled("surprise_me") && viewedIndices && (
          <div className="hidden md:block">
            <SurpriseMeButton
              totalStories={stories.length}
              currentIndex={currentIndex}
              viewedIndices={viewedIndices}
              onJumpTo={onIndexChange}
            />
          </div>
        )}

        {/* Share button - hidden on mobile */}
        {isEnabled("story_sharing") && (
          <div className="hidden md:block">
            <ShareButton story={story} />
          </div>
        )}

        {/* Suggest Place button - hidden on mobile */}
        <div className="hidden md:block">
          <SuggestPlaceButton />
        </div>

        {/* Mobile overflow menu */}
        <ToolbarOverflowMenu>
          {isEnabled("autoplay_button") && (
            <ToolbarOverflowItem
              icon={autoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              label={autoPlay ? t("accessibility.pause_stories") : t("accessibility.play_stories")}
              onClick={() => {
                if (isEnabled("ambient_discovery")) {
                  toggleAmbient();
                } else {
                  setAutoPlay((prev) => !prev);
                }
              }}
              active={autoPlay}
            />
          )}
          {isEnabled("surprise_me") && viewedIndices && (
            <ToolbarOverflowItem
              icon={<Shuffle className="h-4 w-4" />}
              label={t("stories.surprise")}
              onClick={() => {
                // Find a random unviewed story
                const unviewed = Array.from({ length: stories.length }, (_, i) => i)
                  .filter((i) => !viewedIndices.has(i) && i !== currentIndex);
                if (unviewed.length > 0) {
                  const randomIndex = unviewed[Math.floor(Math.random() * unviewed.length)];
                  onIndexChange(randomIndex);
                } else {
                  // All viewed, pick random
                  const randomIndex = Math.floor(Math.random() * stories.length);
                  if (randomIndex !== currentIndex) {
                    onIndexChange(randomIndex);
                  }
                }
              }}
            />
          )}
          {isEnabled("story_sharing") && (
            <ToolbarOverflowItem
              icon={<Share2 className="h-4 w-4" />}
              label={t("share.share")}
              onClick={() => {
                const shareUrl = `${window.location.origin}/stories/${story.id}`;
                if (navigator.share) {
                  navigator.share({
                    title: localizedStory.title,
                    text: localizedStory.description,
                    url: shareUrl,
                  });
                } else {
                  navigator.clipboard.writeText(shareUrl);
                }
              }}
            />
          )}
          <ToolbarOverflowItem
            icon={<Lightbulb className="h-4 w-4" />}
            label={t("suggestions.suggest_place")}
            onClick={() => {
              // Trigger suggest place dialog - need to use a global event or ref
              document.querySelector<HTMLButtonElement>('[data-suggest-place-trigger]')?.click();
            }}
          />
        </ToolbarOverflowMenu>

        {/* Fullscreen - shows on iOS/iPadOS and desktop */}
        <FullscreenButton />
        {/* Bookmark - always visible, navigates to /favorites */}
        <BookmarkButton
          isNavigationMode
          requiresAuth={requiresAuth}
          onAuthRequired={signInWithGoogle}
        />
        {/* Auth - always visible */}
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
