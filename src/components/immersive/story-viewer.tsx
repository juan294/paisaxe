"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Story, StoryCategory, StoryLocation, StoryDuration } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { CategoryFilterBadge } from "./category-filter-badge";

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

  const story = stories[currentIndex];

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
          className={cn(
            "object-cover",
            autoPlay && "animate-slow-zoom"
          )}
          priority
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
        <p className="text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed mb-8">
          {story.description}
        </p>

        {/* Ask button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAskAbout();
          }}
          className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all hover:scale-105"
        >
          Preguntar sobre esto
        </button>
      </div>

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

      {/* Auto-play toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setAutoPlay((prev) => !prev);
        }}
        className="absolute top-16 right-6 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all"
      >
        {autoPlay ? (
          <Volume2 className="h-5 w-5 text-white" />
        ) : (
          <VolumeX className="h-5 w-5 text-white" />
        )}
      </button>

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
