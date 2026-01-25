"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { Story, CATEGORY_LABELS } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { RelatedStories } from "./related-stories";
import { getRelatedStories } from "@/lib/related-stories";

interface StoryViewerProps {
  stories: Story[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onAskAbout: () => void;
}

export function StoryViewer({
  stories,
  currentIndex,
  onIndexChange,
  onAskAbout,
}: StoryViewerProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [autoPlay, setAutoPlay] = useState(false);

  const story = stories[currentIndex];

  // Compute related stories for the current story
  const relatedStories = useMemo(() => {
    if (!story) return [];
    return getRelatedStories(story, stories, 3);
  }, [story, stories]);

  // Handle selecting a related story
  const handleSelectRelated = useCallback((selectedStory: Story) => {
    const newIndex = stories.findIndex(s => s.id === selectedStory.id);
    if (newIndex !== -1 && newIndex !== currentIndex) {
      setIsTransitioning(true);
      setTimeout(() => {
        onIndexChange(newIndex);
        setIsTransitioning(false);
      }, 300);
    }
  }, [stories, currentIndex, onIndexChange]);

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

      {/* Category badge */}
      <div
        className={cn(
          "absolute top-16 left-6 z-20 transition-all duration-500",
          showInfo ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        )}
      >
        <span className="px-3 py-1.5 text-sm font-medium text-white/90 bg-white/20 backdrop-blur-sm rounded-full">
          {CATEGORY_LABELS[story.category]}
        </span>
      </div>

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

      {/* Related Stories */}
      {showInfo && relatedStories.length > 0 && (
        <RelatedStories
          stories={relatedStories}
          onSelectStory={handleSelectRelated}
        />
      )}

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
