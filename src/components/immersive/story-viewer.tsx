"use client";

import { useState, useEffect, useCallback, useRef, useMemo, RefObject } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { Play, Pause, Share2, Shuffle } from "lucide-react";
import { BookmarkButton } from "./bookmark-button";
import { CategoryFilterBadge } from "./category-filter-badge";
import { SiteInfoMenu } from "./site-info-menu";
import { useFavorites } from "@/hooks/use-favorites";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getRelatedStories } from "@/lib/related-stories";
import { RelatedStories } from "./related-stories";
import { SurpriseMeButton } from "./surprise-me-button";
import { ShareButton } from "./share-button";
import { LanguageSwitcher } from "./language-switcher";
import { SuggestPlaceButton } from "./suggest-place-button";
import { SuggestPlaceDialog } from "./suggest-place-dialog";
import { ToolbarOverflowMenu, ToolbarOverflowItem } from "./toolbar-overflow-menu";
import { FullscreenButton } from "./fullscreen-button";
import { useTranslation } from "@/lib/i18n";
import { getLocalizedStory } from "@/lib/localize-story";
import { NavigationHint } from "./navigation-hint";
import { AuthorTypewriter } from "./author-typewriter";
import { StoryProgressBar } from "./story-progress-bar";
import { StoryToolbar } from "./story-toolbar";
import { StoryInfoPanel } from "./story-info-panel";
import { useStoryKeyboardNav } from "@/hooks/use-story-keyboard-nav";

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
  /** Ref forwarded to the "ask about" trigger button for focus restoration when VoiceChat closes */
  chatTriggerRef?: RefObject<HTMLButtonElement | null>;
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
  chatTriggerRef,
}: StoryViewerProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);
  const [ambientMode, setAmbientMode] = useState(false);
  // #328: lifted suggest-dialog state — avoids DOM coupling in overflow menu
  const [isSuggestDialogOpen, setIsSuggestDialogOpen] = useState(false);
  const { isEnabled } = useFeatureFlags();
  const { t, locale } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  const { requiresAuth, isFavorite, toggleFavorite } = useFavorites();

  const { signInWithGoogle } = useAuth();
  const router = useRouter();

  const story = stories[currentIndex];
  const ambientStartRef = useRef<number | null>(null);
  // FE-M1: Single ref to track the pending transition timer so rapid navigation
  // cancels any in-flight timer before setting a new one, preventing stacking.
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goToNext = useCallback(() => {
    const nextIndex = currentIndex < stories.length - 1 ? currentIndex + 1 : 0;
    if (prefersReducedMotion) {
      onIndexChange(nextIndex);
      return;
    }
    // FE-M1: Cancel any in-flight transition timer before starting a new one.
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
    }
    setIsTransitioning(true);
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
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
    // FE-M1: Cancel any in-flight transition timer before starting a new one.
    if (transitionTimerRef.current !== null) {
      clearTimeout(transitionTimerRef.current);
    }
    setIsTransitioning(true);
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
      onIndexChange(prevIndex);
      setIsTransitioning(false);
    }, 300);
  }, [currentIndex, stories.length, onIndexChange, prefersReducedMotion]);

  // Keyboard navigation — extracted to useStoryKeyboardNav (FE-H2)
  const toggleInfo = useCallback(() => setShowInfo((prev) => !prev), []);
  useStoryKeyboardNav({
    onNext: goToNext,
    onPrev: goToPrev,
    onToggleInfo: toggleInfo,
    chatOpen,
  });

  // FE-M1: Clear any pending transition timer on unmount to prevent memory leaks.
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

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
        setAutoPlay(false);
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

  // Story titles for progress bar screen reader announcements
  const storyTitles = useMemo(
    () => stories.map((s) => s.title),
    [stories]
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
      className="relative h-dvh w-screen overflow-hidden bg-black"
      aria-hidden={chatOpen ? "true" : undefined}
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

      {/* Transparent overlay button for toggling info — desktop (pointer:fine) only.
          Placed on a dedicated <button> so keyboard users can activate it (UX-H7).
          z-[5]: above the background image (z-0) but below all interactive UI (z-10+). */}
      <button
        className="desktop-pointer-only absolute inset-0 z-[5] w-full h-full cursor-pointer bg-transparent"
        aria-label={showInfo ? t("accessibility.hide_info") : t("accessibility.show_info")}
        aria-expanded={showInfo}
        onClick={() => {
          // Only toggle info on desktop (pointer: fine) — on mobile, tap zones handle navigation
          if (window.matchMedia("(pointer: fine)").matches) {
            setShowInfo((prev) => !prev);
          }
        }}
      />

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
          priority={currentIndex === 0}
          placeholder="blur"
          blurDataURL={story.blurDataUrl || darkPlaceholder}
          key={story.id}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
      </div>

      {/* Progress bar - extracted & memoized component with event delegation */}
      <StoryProgressBar
        storiesLength={stories.length}
        currentIndex={currentIndex}
        onIndexChange={onIndexChange}
        t={t}
        storyTitles={storyTitles}
      />

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

      {/* Main content — extracted to StoryInfoPanel (FE-H2) */}
      <StoryInfoPanel
        story={story}
        localizedStory={localizedStory}
        showInfo={showInfo}
        t={t}
        onAskAbout={onAskAbout}
        onToggleInfo={toggleInfo}
        ast={ast}
        isEnabled={isEnabled}
        questionPrompts={questionPrompts}
        requiresAuth={requiresAuth}
        onAuthRequired={signInWithGoogle}
        onFavoritesNav={() => router.push("/favorites")}
        isFavorite={isFavorite(story.id)}
        onToggleFavorite={() => toggleFavorite(story.id)}
        chatTriggerRef={chatTriggerRef}
      />

      {/* Navigation arrows — extracted to StoryToolbar (FE-H2) */}
      <StoryToolbar onPrev={goToPrev} onNext={goToNext} t={t} />

      {/* Top-right controls: Language + Auth + Auto-play + Share + Surprise + Favorites */}
      <nav
        aria-label={t("accessibility.story_controls")}
        className={cn(
          "absolute top-16 right-4 md:right-6 z-20 flex items-center gap-2 md:gap-3 max-w-[calc(100%-8rem)] transition-all duration-500 motion-reduce:transition-none",
          showInfo ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 motion-reduce:translate-y-0 pointer-events-none"
        )}
      >
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
        {isEnabled("user_story_suggestions") && (
          <div className="hidden md:block">
            <SuggestPlaceButton onOpen={() => setIsSuggestDialogOpen(true)} />
          </div>
        )}

        {/* Mobile overflow menu */}
        <ToolbarOverflowMenu>
          {isEnabled("autoplay_button") && (
            <ToolbarOverflowItem
              icon={autoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              label={autoPlay ? t("accessibility.pause_short") : t("accessibility.play_short")}
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
                // UX-B1: route is `/story/[slug]` (singular, by slug) — using the
                // plural `/stories/<id>` path would 404. Mirrors share-button.tsx.
                const shareUrl = `${window.location.origin}/story/${story.slug || story.id}`;
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
          {isEnabled("user_story_suggestions") && (
            <SuggestPlaceButton
              variant="menu"
              onOpen={() => setIsSuggestDialogOpen(true)}
            />
          )}
        </ToolbarOverflowMenu>

        {/* Fullscreen - shows on iOS/iPadOS and desktop when enabled */}
        {isEnabled("fullscreen_button") && <FullscreenButton />}
        {/* Bookmark - always visible, toggles favorite for current story */}
        <BookmarkButton
          requiresAuth={requiresAuth}
          onAuthRequired={signInWithGoogle}
          isFavorite={story ? isFavorite(story.id) : false}
          onToggle={() => story && toggleFavorite(story.id)}
        />
        {/* Profile & info menu - always visible */}
        <SiteInfoMenu />
      </nav>

      {/* Keyboard hints - hidden on mobile and touch-only devices */}
      <div
        className={cn(
          "hidden md:block desktop-pointer-only absolute bottom-4 right-4 z-20 text-white/60 text-xs transition-opacity duration-500 motion-reduce:transition-none",
          showInfo ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      >
        ← → {t("nav.navigate")} · i {t("nav.show_hide")} · {t("nav.space")} {t("nav.next")}
      </div>

      {/* "Made by" pill with vertical popover — desktop only */}
      <AuthorTypewriter prefersReducedMotion={prefersReducedMotion} t={t} visible={showInfo} />

      {/* First-visit navigation hint for mobile users */}
      <NavigationHint />

      {/* Suggest Place dialog — state lifted here (#328: no DOM coupling) */}
      <SuggestPlaceDialog
        isOpen={isSuggestDialogOpen}
        onClose={() => setIsSuggestDialogOpen(false)}
      />
    </main>
  );
}
