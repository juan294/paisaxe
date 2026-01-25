"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Play, Pause, Bookmark } from "lucide-react";
import { CategoryFilterBadge } from "./category-filter-badge";
import { AuthButton } from "@/components/auth/auth-button";
import { SignInPrompt } from "@/components/auth/sign-in-prompt";
import { useFavorites } from "@/hooks/use-favorites";

// Simple dark placeholder for images (prevents flash of white)
const darkPlaceholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%231a1a1a' width='1' height='1'/%3E%3C/svg%3E";

interface StoryViewerProps {
  stories: Story[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onAskAbout: () => void;
  // Filter props
  selectedCategory: StoryCategory | null;
  selectedLocation: StoryLocation | null;
  selectedDuration: StoryDuration | null;
  onCategoryChange: (category: StoryCategory | null) => void;
  onLocationChange: (location: StoryLocation | null) => void;
  onDurationChange: (duration: StoryDuration | null) => void;
  onClearFilters: () => void;
}

export function StoryViewer({
  stories,
  currentIndex,
  onIndexChange,
  onAskAbout,
  selectedCategory,
  selectedLocation,
  selectedDuration,
  onCategoryChange,
  onLocationChange,
  onDurationChange,
  onClearFilters,
}: StoryViewerProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);

  const {
    isFavorite,
    toggleFavorite,
    showSignInPrompt,
    dismissSignInPrompt,
  } = useFavorites();

  const story = stories[currentIndex];
  const prefetchedUrls = useRef<Set<string>>(new Set());

  // Prefetch adjacent images for smoother navigation
  useEffect(() => {
    const prefetchImage = (url: string) => {
      if (!url || prefetchedUrls.current.has(url)) return;

      const img = new window.Image();
      img.src = url;
      prefetchedUrls.current.add(url);
    };

    // Prefetch next image
    if (currentIndex < stories.length - 1) {
      prefetchImage(stories[currentIndex + 1].image);
    }
    // Prefetch previous image
    if (currentIndex > 0) {
      prefetchImage(stories[currentIndex - 1].image);
    }
    // Prefetch 2 ahead if available (for faster auto-play)
    if (currentIndex < stories.length - 2) {
      prefetchImage(stories[currentIndex + 2].image);
    }
  }, [currentIndex, stories]);

  const goToNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        onIndexChange(currentIndex + 1);
        setIsTransitioning(false);
      }, 300);
    }
  }, [currentIndex, stories.length, onIndexChange]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        onIndexChange(currentIndex - 1);
        setIsTransitioning(false);
      }, 300);
    }
  }, [currentIndex, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
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
  }, [goToNext, goToPrev]);

  // Auto-play
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(goToNext, 6000);
    return () => clearInterval(timer);
  }, [autoPlay, goToNext]);

  if (!story) return null;

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-black cursor-pointer"
      onClick={() => setShowInfo((prev) => !prev)}
    >
      {/* Background Image with Ken Burns effect */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-500",
          isTransitioning ? "opacity-0" : "opacity-100"
        )}
      >
        <Image
          src={story.image}
          alt={story.title}
          fill
          sizes="100vw"
          className={cn(
            "object-cover",
            autoPlay && "animate-slow-zoom"
          )}
          priority
          placeholder="blur"
          blurDataURL={darkPlaceholder}
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
      </div>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-4">
        {stories.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange(i);
            }}
          >
            <div
              className={cn(
                "h-full bg-white transition-all duration-300",
                i < currentIndex ? "w-full" : i === currentIndex ? "w-full" : "w-0"
              )}
            />
          </div>
        ))}
      </div>

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

      {/* Main content */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 p-8 md:p-12 z-10 transition-all duration-500",
          showInfo ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
      >
        <p className="text-white/70 text-sm md:text-base font-medium mb-2 tracking-wider uppercase">
          {story.subtitle}
        </p>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
          {story.title}
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

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAskAbout();
            }}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all hover:scale-105"
          >
            Preguntar sobre esto
          </button>
          <a
            href="/favorites"
            onClick={(e) => e.stopPropagation()}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all hover:scale-105 flex items-center gap-2"
          >
            <Bookmark className="h-5 w-5" />
            <span>Guardados</span>
          </a>
        </div>
      </div>

      {/* Sign-in prompt modal */}
      <SignInPrompt open={showSignInPrompt} onClose={dismissSignInPrompt} />

      {/* Navigation arrows */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          goToPrev();
        }}
        disabled={currentIndex === 0}
        className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all",
          currentIndex === 0 && "opacity-30 cursor-not-allowed"
        )}
      >
        <ChevronLeft className="h-8 w-8 text-white" />
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          goToNext();
        }}
        disabled={currentIndex === stories.length - 1}
        className={cn(
          "absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all",
          currentIndex === stories.length - 1 && "opacity-30 cursor-not-allowed"
        )}
      >
        <ChevronRight className="h-8 w-8 text-white" />
      </button>

      {/* Top-right controls: Auth + Auto-play + Favorites link */}
      <div className="absolute top-16 right-6 z-20 flex items-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAutoPlay((prev) => !prev);
          }}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
        >
          {autoPlay ? (
            <Pause className="h-5 w-5 text-white" />
          ) : (
            <Play className="h-5 w-5 text-white" />
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(story.id);
          }}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
          title={isFavorite(story.id) ? "Quitar de guardados" : "Agregar a guardados"}
        >
          <Bookmark
            className={cn(
              "h-5 w-5 text-white transition-all",
              isFavorite(story.id) && "fill-white"
            )}
          />
        </button>
        <AuthButton />
      </div>

      {/* Keyboard hints */}
      <div
        className={cn(
          "absolute bottom-4 right-4 z-20 text-white/40 text-xs transition-opacity duration-500",
          showInfo ? "opacity-100" : "opacity-0"
        )}
      >
        ← → navegar · i mostrar/ocultar · espacio siguiente
      </div>
    </div>
  );
}
