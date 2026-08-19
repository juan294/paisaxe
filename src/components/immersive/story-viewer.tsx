"use client";

import { useState, useEffect, useCallback, useRef, useMemo, RefObject } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { Play, Pause, Shuffle } from "lucide-react";
import { BookmarkButton } from "./bookmark-button";
import { CategoryFilterBadge } from "./category-filter-badge";
import { SiteInfoMenu } from "./site-info-menu";
import { useFavorites } from "@/hooks/use-favorites";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getRelatedStories } from "@/lib/related-stories";
import { LanguageSwitcher } from "./language-switcher";
import { ToolbarOverflowMenu, ToolbarOverflowItem } from "./toolbar-overflow-menu";

// #569: Flag-gated tools are dynamically imported so their code only loads when
// the corresponding feature flag is enabled (keeps them out of the initial bundle).
// ssr: false — these are interactive, client-only controls (matches VoiceChat).
const RelatedStories = dynamic(
  () => import("./related-stories").then((m) => m.RelatedStories),
  { ssr: false, loading: () => null }
);
const SurpriseMeButton = dynamic(
  () => import("./surprise-me-button").then((m) => m.SurpriseMeButton),
  { ssr: false, loading: () => null }
);
const ShareButton = dynamic(
  () => import("./share-button").then((m) => m.ShareButton),
  { ssr: false, loading: () => null }
);
const SuggestPlaceButton = dynamic(
  () => import("./suggest-place-button").then((m) => m.SuggestPlaceButton),
  { ssr: false, loading: () => null }
);
const FullscreenButton = dynamic(
  () => import("./fullscreen-button").then((m) => m.FullscreenButton),
  { ssr: false, loading: () => null }
);
// FE-M7 (#769): was a static import mounted unconditionally regardless of the
// user_story_suggestions flag — now dynamic like its sibling tools, and
// rendered only once the flag is on (see the isEnabled(...) guard below).
const SuggestPlaceDialog = dynamic(
  () => import("./suggest-place-dialog").then((m) => m.SuggestPlaceDialog),
  { ssr: false, loading: () => null }
);
import { useTranslation } from "@/lib/i18n";
import { getLocalizedStory } from "@/lib/localize-story";
import { NavigationHint } from "./navigation-hint";
import { AuthorTypewriter } from "./author-typewriter";
import { StoryProgressBar } from "./story-progress-bar";
import { StoryToolbar } from "./story-toolbar";
import { StoryInfoPanel } from "./story-info-panel";
import { getLocalizedQuestionPrompts } from "./question-prompts";
import { useStoryKeyboardNav } from "@/hooks/use-story-keyboard-nav";
import { Button } from "@/components/ui/button";

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

  // Story titles for progress bar screen reader announcements.
  // UX-H6 (#892): route through getLocalizedStory so a non-Spanish visitor
  // hears the translated title, not the raw Spanish one, for every segment.
  const storyTitles = useMemo(
    () => stories.map((s) => getLocalizedStory(s, locale).title),
    [stories, locale]
  );

  // PE-M4 (#615): prefetch the adjacent (next & prev) story images so navigation
  // shows the next photo instantly instead of waiting on a cold fetch. Wraps
  // around at both ends and never re-preloads the current image.
  const adjacentImages = useMemo(() => {
    const len = stories.length;
    if (len <= 1) return [];
    const nextIndex = currentIndex < len - 1 ? currentIndex + 1 : 0;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : len - 1;
    const urls = new Set<string>();
    for (const idx of [nextIndex, prevIndex]) {
      const img = stories[idx]?.image;
      if (img && idx !== currentIndex) urls.add(img);
    }
    return Array.from(urls);
  }, [stories, currentIndex]);

  // Asturianu labels
  const ast = isEnabled("asturianu_touches");

  // Get localized story text based on current locale (falls back to Spanish).
  // FE-M2 (#764): useMemo so this object keeps its identity across renders that
  // don't change story/locale — otherwise it's a fresh object every render,
  // which defeats StoryInfoPanel's memo (getLocalizedStory itself stays pure).
  const localizedStory = useMemo(
    () => (story ? getLocalizedStory(story, locale) : null),
    [story, locale]
  );

  // FE-L1: Stable callback for StoryInfoPanel props — prevents re-renders when
  // only the index changes (story/id change is reflected via the story prop itself).
  // Must be declared BEFORE the early return so hooks are always called in
  // the same order (React rules-of-hooks).
  const handleFavoritesNav = useCallback(() => router.push("/favorites"), [router]);

  if (!story || !localizedStory) return null;

  // Question prompts from metadata.
  // UX-H6 (#892): resolve the translated prompts for the active locale,
  // falling back to Spanish when no translation exists (see getLocalizedQuestionPrompts).
  // FE-M2 (#764): getLocalizedQuestionPrompts returns a module-level constant
  // empty array (not a fresh `[]`) when there are no prompts, so this stays
  // referentially stable across renders without needing its own useMemo.
  const questionPrompts = getLocalizedQuestionPrompts(story, locale);

  return (
    <main
      className="relative h-dvh w-screen overflow-hidden bg-black"
      aria-hidden={chatOpen ? "true" : undefined}
      // UX-H2 (#888): aria-hidden alone doesn't stop keyboard focus — nav,
      // toggles, and arrows inside stayed Tab-reachable while announced as
      // non-existent to assistive tech. `inert` additionally removes the
      // subtree from the tab order and blocks pointer interaction. The chat
      // modal (VoiceChat) is rendered as a sibling of this <main>, not inside
      // it, so its own backdrop/close controls are unaffected.
      inert={chatOpen}
    >
      {/* PE-H1/FE-M3 (#804, #765): adjacent story images, rendered as hidden,
          `priority` next/image elements so Next.js itself generates the
          preload — a hand-built <link rel="preload" href={rawUrl}> pointed at
          the raw origin URL while the real <Image> below requests the
          optimizer URL, so nothing was ever actually warmed (~350KB wasted
          per navigation). `sizes` must match the visible <Image> ("100vw")
          so the computed optimizer URL/srcset is identical to what gets
          requested once this image becomes current. */}
      {adjacentImages.map((src) => (
        <div key={src} aria-hidden="true" className="sr-only pointer-events-none">
          <Image src={src} alt="" fill sizes="100vw" priority />
        </div>
      ))}

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
          alt={localizedStory.title}
          fill
          sizes="100vw"
          // FE-M6 (#768): motion-reduce:animate-none is a CSS-layer backstop —
          // it suppresses the zoom animation immediately regardless of JS
          // timing, so reduced-motion visitors never see the one-frame flash
          // that can occur between the hydration-safe `false` initial state
          // and the effect that corrects prefersReducedMotion.
          className={cn("object-cover", zoomClass, "motion-reduce:animate-none")}
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
        locale={locale}
        isEnabled={isEnabled}
        questionPrompts={questionPrompts}
        requiresAuth={requiresAuth}
        onAuthRequired={signInWithGoogle}
        onFavoritesNav={handleFavoritesNav}
        isFavorite={isFavorite(story.id)}
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

        {/* UX-M1: Ambient/Auto-play toggle — always visible on all viewports.
            This is the signature "lean back" control; promoting it to a top-level
            button makes it reachable without opening the overflow menu on mobile. */}
        {isEnabled("autoplay_button") && (
          <Button
            variant="glassIcon"
            data-testid="ambient-toggle"
            onClick={(e) => {
              e.stopPropagation();
              if (isEnabled("ambient_discovery")) {
                toggleAmbient();
              } else {
                setAutoPlay((prev) => !prev);
              }
            }}
            className={cn(
              "flex p-2",
              ambientMode && "ring-1 ring-white/30"
            )}
            aria-label={autoPlay ? t("accessibility.pause_stories") : t("accessibility.play_stories")}
            title={
              isEnabled("ambient_discovery")
                ? ambientMode ? t("stories.ambient_off") : t("stories.ambient_on")
                : undefined
            }
            aria-pressed={autoPlay}
          >
            {autoPlay ? (
              <Pause className="h-5 w-5 text-white" />
            ) : (
              <Play className="h-5 w-5 text-white" />
            )}
          </Button>
        )}

        {/* Surprise Me button - secondary: desktop only */}
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

        {/* Share button - secondary: desktop only */}
        {isEnabled("story_sharing") && (
          <div className="hidden md:block">
            <ShareButton story={story} />
          </div>
        )}

        {/* Suggest Place button - secondary: desktop only */}
        {isEnabled("user_story_suggestions") && (
          <div className="hidden md:block">
            <SuggestPlaceButton onOpen={() => setIsSuggestDialogOpen(true)} />
          </div>
        )}

        {/* Mobile overflow menu — secondary controls only (ambient is promoted above) */}
        <ToolbarOverflowMenu>
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
          {/* #908/#771: was a standalone inline handler that skipped error
              feedback and never handled share-cancellation/clipboard-failure
              rejections. Now reuses the exact same ShareButton + useShareStory
              hook as the desktop control ("menu" variant renders as a
              ToolbarOverflowItem-style row), so there is one share behaviour
              with consistent localization and feedback everywhere. */}
          {isEnabled("story_sharing") && (
            <ShareButton story={story} variant="menu" />
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
      <AuthorTypewriter visible={showInfo} />

      {/* First-visit navigation hint for mobile users */}
      <NavigationHint />

      {/* Suggest Place dialog — state lifted here (#328: no DOM coupling).
          FE-M7 (#769): only mounted when the flag is on — SuggestPlaceButton
          already returns null when the flag is off, so isSuggestDialogOpen
          can never become true in that case anyway; this also keeps the
          dialog's code out of the bundle until the flag is enabled. */}
      {isEnabled("user_story_suggestions") && (
        <SuggestPlaceDialog
          isOpen={isSuggestDialogOpen}
          onClose={() => setIsSuggestDialogOpen(false)}
        />
      )}
    </main>
  );
}
