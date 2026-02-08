"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Play, Pause, Bookmark, Share2, Shuffle, Lightbulb, Camera } from "lucide-react";
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
import { NavigationHint } from "./navigation-hint";

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
  const [typewriterText, setTypewriterText] = useState("</> JG");

  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isEnabled } = useFeatureFlags();
  const { t, locale } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  const { requiresAuth, isFavorite, toggleFavorite } = useFavorites();

  const { signInWithGoogle } = useAuth();
  const router = useRouter();

  const story = stories[currentIndex];
  const prefetchedUrls = useRef<Set<string>>(new Set());
  const ambientStartRef = useRef<number | null>(null);

  // Terminal typewriter animation for the author pill
  useEffect(() => {
    if (prefersReducedMotion) return;

    const messages = [
      "</> JG",
      t("author_pill.made_with_love"),
      t("author_pill.fueled_by_sidra"),
      "npm run explore",
      t("author_pill.buen_camino"),
      t("author_pill.probably_hiking"),
      t("author_pill.out_cycling"),
      t("author_pill.scaling_rocks"),
      t("author_pill.sleep_not_found"),
      t("author_pill.works_on_my_machine"),
      t("author_pill.bug_free"),
    ];
    const HOME = messages[0];
    const CHAR_DELAY = 80;
    const EMPTY_PAUSE = 300;
    const HOME_HOLD = 30_000;
    const MSG_HOLD = 4000;

    let messageIndex = 0;
    let cancelled = false;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        typewriterRef.current = setTimeout(() => {
          if (!cancelled) resolve();
        }, ms);
      });

    const eraseText = async (text: string) => {
      for (let i = text.length; i >= 0; i--) {
        if (cancelled) return;
        setTypewriterText(text.slice(0, i));
        if (i > 0) await wait(CHAR_DELAY);
      }
    };

    const typeText = async (text: string) => {
      for (let i = 0; i <= text.length; i++) {
        if (cancelled) return;
        setTypewriterText(text.slice(0, i));
        if (i < text.length) await wait(CHAR_DELAY);
      }
    };

    const cycle = async () => {
      // Start at home, wait
      setTypewriterText(HOME);
      await wait(HOME_HOLD);

      while (!cancelled) {
        // Move to next non-home message
        messageIndex = (messageIndex + 1) % messages.length;
        if (messageIndex === 0) messageIndex = 1; // skip home in rotation

        const nextMsg = messages[messageIndex];
        const currentText = HOME;

        // Erase current text
        await eraseText(currentText);
        if (cancelled) return;

        // Brief pause when empty
        await wait(EMPTY_PAUSE);
        if (cancelled) return;

        // Type the new message
        await typeText(nextMsg);
        if (cancelled) return;

        // Hold the message
        await wait(MSG_HOLD);
        if (cancelled) return;

        // Erase the message
        await eraseText(nextMsg);
        if (cancelled) return;

        // Brief pause when empty
        await wait(EMPTY_PAUSE);
        if (cancelled) return;

        // Type home back
        await typeText(HOME);
        if (cancelled) return;

        // Hold at home
        await wait(HOME_HOLD);
      }
    };

    cycle();

    return () => {
      cancelled = true;
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
    };
  }, [prefersReducedMotion, t]);

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
      onClick={() => {
        // Only toggle info on desktop (pointer: fine) — on mobile, tap zones handle navigation
        if (window.matchMedia("(pointer: fine)").matches) {
          setShowInfo((prev) => !prev);
        }
      }}
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
            {Array.from({ length: segmentCount }, (_, i) => {
              const base = currentIndex - fillPosition;
              const targetIndex = base + i;
              const handleJump = () => {
                if (targetIndex >= 0 && targetIndex < stories.length) {
                  onIndexChange(targetIndex);
                }
              };
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-label={t("accessibility.go_to_story")
                    .replace("{current}", String(targetIndex + 1))
                    .replace("{total}", String(stories.length))}
                  className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden cursor-pointer transition-all duration-300 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJump();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleJump();
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
              );
            })}
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
        onClick={(e) => {
          e.stopPropagation();
          setShowInfo((prev) => !prev);
        }}
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
          <p className="text-xs text-white/50 mb-6 flex items-center gap-1">
            <Camera className="h-3 w-3" aria-hidden="true" />
            <span>{story.imageSource}</span>
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

      {/* Navigation arrows - invisible tap zones on phones, visible buttons on tablets/desktop */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          goToPrev();
        }}
        aria-label={t("accessibility.previous_story")}
        className="absolute left-0 top-0 h-full w-20 z-20 flex items-center justify-start pl-4 sm:left-4 sm:top-1/2 sm:h-auto sm:w-auto sm:-translate-y-1/2 sm:p-3 sm:rounded-full sm:bg-white/10 sm:hover:bg-white/20 sm:backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-nav-reset touch-nav-left"
      >
        <ChevronLeft className="h-8 w-8 text-white hidden sm:block" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          goToNext();
        }}
        aria-label={t("accessibility.next_story")}
        className="absolute right-0 top-0 h-full w-20 z-20 flex items-center justify-end pr-4 sm:right-4 sm:top-1/2 sm:h-auto sm:w-auto sm:-translate-y-1/2 sm:p-3 sm:rounded-full sm:bg-white/10 sm:hover:bg-white/20 sm:backdrop-blur-sm transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black touch-nav-reset touch-nav-right"
      >
        <ChevronRight className="h-8 w-8 text-white hidden sm:block" />
      </button>

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
            <SuggestPlaceButton />
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
          {isEnabled("user_story_suggestions") && (
            <ToolbarOverflowItem
              icon={<Lightbulb className="h-4 w-4" />}
              label={t("suggestions.suggest_short")}
              onClick={() => {
                // Trigger suggest place dialog - need to use a global event or ref
                document.querySelector<HTMLButtonElement>('[data-suggest-place-trigger]')?.click();
              }}
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
        {/* Auth - always visible */}
        <AuthButton />
      </nav>

      {/* Keyboard hints - hidden on mobile and touch-only devices */}
      <div
        className={cn(
          "hidden md:block desktop-pointer-only absolute bottom-4 right-4 z-20 text-white/40 text-xs transition-opacity duration-500 motion-reduce:transition-none",
          showInfo ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      >
        ← → {t("nav.navigate")} · i {t("nav.show_hide")} · {t("nav.space")} {t("nav.next")}
      </div>

      {/* "Made by" pill with vertical popover — desktop only */}
      <div
        className="group hidden md:block desktop-pointer-only absolute bottom-10 right-4 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Popover card — appears above the pill on hover */}
        <div
          className="absolute bottom-full right-0 pb-2 opacity-0 translate-y-2 scale-95 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 ease-[cubic-bezier(0.65,0,0.35,1)]"
        >
        <div
          className="p-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/15"
        >
          <p className="text-[11px] text-white/60 font-medium whitespace-nowrap mb-2 select-none">
            Juan Gonz&aacute;lez
          </p>
          <div className="flex items-center gap-2">
            <a
              href="https://x.com/JuanG294"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-white/10 text-white/50 hover:text-white hover:bg-white/20 transition-all duration-200"
              aria-label="X (Twitter)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/juanagonzalezp/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-white/10 text-white/50 hover:text-white hover:bg-white/20 transition-all duration-200"
              aria-label="LinkedIn"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            <a
              href="https://medium.com/@juang294"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-white/10 text-white/50 hover:text-white hover:bg-white/20 transition-all duration-200"
              aria-label="Medium"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
              </svg>
            </a>
          </div>
        </div>
        </div>

        {/* Trigger pill (always visible) — terminal typewriter */}
        <div
          className="flex items-center h-6 min-w-[3.5rem] px-2.5 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-sm cursor-default transition-all duration-150"
          aria-label="Made by Juan González"
        >
          <span className="text-[10px] font-mono text-white/45 group-hover:text-white/60 transition-colors duration-300 select-none whitespace-nowrap">
            {typewriterText}
            <span
              className={cn(
                "text-white/30 ml-px",
                !prefersReducedMotion && "animate-cursor-blink"
              )}
              aria-hidden="true"
            >
              &#9612;
            </span>
          </span>
        </div>
      </div>

      {/* First-visit navigation hint for mobile users */}
      <NavigationHint />
    </main>
  );
}
