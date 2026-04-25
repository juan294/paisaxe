"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFavorites } from "@/hooks/use-favorites";
import { useStories } from "@/hooks/use-stories";
import { Bookmark, ArrowLeft, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { Story } from "@/types/immersive";

const ITEMS_PER_PAGE = 20;

export default function FavoritesPage() {
  const { favorites, toggleFavorite, isLoading: favoritesLoading, requiresAuth } = useFavorites();
  const { stories: allStories, isLoading } = useStories();
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // requiresAuth is true for anonymous users — they can never have saved favorites.
  const canWaitForStories = !requiresAuth || favorites.length > 0;
  const stories = canWaitForStories ? allStories : [];

  // Filter to only favorited stories
  const favoriteStories = stories.filter((story) =>
    favorites.includes(story.id)
  );

  // Get the stories to display (paginated)
  const displayedStories = favoriteStories.slice(0, displayCount);
  const hasMore = displayCount < favoriteStories.length;

  // Load more items
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    // Small delay to show loading state and prevent rapid firing
    setTimeout(() => {
      setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, favoriteStories.length));
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMore, favoriteStories.length]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      {
        rootMargin: "200px", // Start loading before user reaches the end
        threshold: 0
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, loadMore]);

  // Reset display count when favorites change significantly
  useEffect(() => {
    if (favoriteStories.length < displayCount) {
      setDisplayCount(Math.max(ITEMS_PER_PAGE, favoriteStories.length));
    }
  }, [favoriteStories.length, displayCount]);

  if (favoritesLoading || (canWaitForStories && isLoading)) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-neutral-400" />
        <p className="mt-3 text-sm text-neutral-500">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/immersive"
              aria-label={t("accessibility.go_back")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-white fill-white" />
              <h1 className="text-sm font-semibold tracking-tight text-white">
                {t("favorites.title")}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-neutral-500">
              {favoriteStories.length} {favoriteStories.length === 1 ? t("favorites.place_singular") : t("favorites.place_plural")}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {favoriteStories.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <Bookmark className="h-16 w-16 text-neutral-700 mb-4" />
            <h2 className="text-lg font-medium text-white mb-2">
              {t("favorites.empty_title")}
            </h2>
            {requiresAuth ? (
              <p className="text-neutral-500 mb-6 max-w-sm text-sm">
                {t("favorites.sign_in_to_save")}
              </p>
            ) : (
              <p className="text-neutral-500 mb-6 max-w-sm text-sm">
                {t("favorites.empty_description")}
              </p>
            )}
            <Link
              href="/immersive"
              className="px-5 py-2.5 bg-white text-neutral-900 rounded-full text-sm font-medium transition-all hover:bg-neutral-200"
            >
              {t("favorites.explore")}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedStories.map((story, index) => (
                <GalleryItem
                  key={story.id}
                  story={story}
                  isFeature={index === 0 && favoriteStories.length > 2}
                  onRemove={() => toggleFavorite(story.id)}
                />
              ))}
            </div>

            {/* Load more trigger */}
            <div
              ref={loadMoreRef}
              className="flex justify-center py-8"
            >
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-neutral-500">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t("favorites.loading_more")}</span>
                </div>
              )}
              {!hasMore && favoriteStories.length > ITEMS_PER_PAGE && (
                <span className="text-sm text-neutral-600">
                  {t("favorites.all_viewed")}
                </span>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Separate component for gallery items to optimize re-renders
interface GalleryItemProps {
  story: Story;
  isFeature: boolean;
  onRemove: () => void;
}

function GalleryItem({ story, isFeature, onRemove }: GalleryItemProps) {
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef<HTMLAnchorElement>(null);
  const { t } = useTranslation();

  // Intersection Observer for lazy rendering
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "100px",
        threshold: 0
      }
    );

    const currentRef = itemRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  return (
    <Link
      ref={itemRef}
      href={`/immersive?story=${story.slug || story.id}`}
      className={cn(
        "group relative w-full overflow-hidden rounded-lg",
        isFeature && "sm:col-span-2"
      )}
    >
      {/* Image Container */}
      <div className={cn(
        "relative w-full overflow-hidden bg-neutral-900",
        isFeature ? "aspect-[21/9]" : "aspect-[4/3]"
      )}>
        {isVisible && story.image ? (
          <>
            <Image
              src={story.image}
              alt={story.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes={isFeature
                ? "(max-width: 768px) 100vw, 66vw"
                : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              }
              loading="lazy"
              placeholder="empty"
            />

            {/* Gradient overlay - appears on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* Content overlay - appears on hover */}
            <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 transition-all duration-300 group-hover:opacity-100">
              <div className="translate-y-2 transform transition-transform duration-300 group-hover:translate-y-0">
                <p className="text-xs font-medium uppercase tracking-wider text-white/60">
                  {t(`stories.categories.${story.category}`)}
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {story.title}
                </h3>
                {story.subtitle && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-white/70">
                    {story.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Delete button - top right on hover */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-red-500 group-hover:opacity-100"
              aria-label={t("favorites.remove_from_saved")}
            >
              <Trash2 className="h-4 w-4 text-neutral-800 group-hover/btn:text-white" />
            </button>
          </>
        ) : (
          /* Placeholder while loading or no image */
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-neutral-800 animate-pulse">
            {!isVisible ? (
              <div className="h-8 w-8 rounded bg-neutral-700" />
            ) : (
              <>
                <Bookmark className="h-8 w-8 text-neutral-600" />
                <p className="text-sm font-medium text-neutral-400">
                  {story.title}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
