"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  StoryCategory,
  StoryLocation,
  StoryDuration,
  CATEGORY_LABELS,
  LOCATION_LABELS,
  DURATION_LABELS,
} from "@/types/immersive";

interface CategoryFilterBadgeProps {
  currentCategory: StoryCategory;
  selectedCategory: StoryCategory | null;
  selectedLocation: StoryLocation | null;
  selectedDuration: StoryDuration | null;
  onCategoryChange: (category: StoryCategory | null) => void;
  onLocationChange: (location: StoryLocation | null) => void;
  onDurationChange: (duration: StoryDuration | null) => void;
  onClearAll: () => void;
  visible: boolean;
}

const CATEGORIES: StoryCategory[] = ["nature", "cities", "food", "culture", "activities"];
const LOCATIONS: StoryLocation[] = ["eastern", "central", "western"];
const DURATIONS: StoryDuration[] = ["day-trip", "weekend", "week"];

export function CategoryFilterBadge({
  currentCategory,
  selectedCategory,
  selectedLocation,
  selectedDuration,
  onCategoryChange,
  onLocationChange,
  onDurationChange,
  onClearAll,
  visible,
}: CategoryFilterBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = selectedCategory !== null || selectedLocation !== null || selectedDuration !== null;
  const activeFilterCount = [selectedCategory, selectedLocation, selectedDuration].filter(Boolean).length;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExpanded]);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }

    if (isExpanded) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isExpanded]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute top-16 left-6 z-20 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}
    >
      {/* Collapsed: Category Badge */}
      {!isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            "text-sm font-medium text-white/90",
            "bg-white/20 hover:bg-white/30 backdrop-blur-sm",
            "transition-all duration-300 hover:scale-105",
            hasActiveFilters && "ring-2 ring-white/40"
          )}
        >
          <span>{CATEGORY_LABELS[selectedCategory || currentCategory]}</span>
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 text-xs bg-white text-black rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      {/* Expanded: Filter Panel */}
      {isExpanded && (
        <div
          className={cn(
            "p-4 rounded-2xl",
            "bg-black/80 backdrop-blur-md border border-white/10",
            "min-w-[280px]",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-white/60 text-xs uppercase tracking-wider">
              Filtrar historias
            </span>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4 text-white/60" />
            </button>
          </div>

          {/* Category Filter */}
          <div className="mb-4">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-2">
              Categoría
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <FilterChip
                  key={category}
                  label={CATEGORY_LABELS[category]}
                  selected={selectedCategory === category}
                  highlighted={!selectedCategory && category === currentCategory}
                  onClick={() =>
                    onCategoryChange(selectedCategory === category ? null : category)
                  }
                />
              ))}
            </div>
          </div>

          {/* Location Filter */}
          <div className="mb-4">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-2">
              Zona
            </div>
            <div className="flex flex-wrap gap-2">
              {LOCATIONS.map((location) => (
                <FilterChip
                  key={location}
                  label={LOCATION_LABELS[location]}
                  selected={selectedLocation === location}
                  onClick={() =>
                    onLocationChange(selectedLocation === location ? null : location)
                  }
                />
              ))}
            </div>
          </div>

          {/* Duration Filter */}
          <div className="mb-4">
            <div className="text-white/40 text-xs uppercase tracking-wider mb-2">
              Duración
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((duration) => (
                <FilterChip
                  key={duration}
                  label={DURATION_LABELS[duration]}
                  selected={selectedDuration === duration}
                  onClick={() =>
                    onDurationChange(selectedDuration === duration ? null : duration)
                  }
                />
              ))}
            </div>
          </div>

          {/* Clear All */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                onClearAll();
                setIsExpanded(false);
              }}
              className={cn(
                "w-full py-2 rounded-full text-sm",
                "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white",
                "transition-all"
              )}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  selected: boolean;
  highlighted?: boolean;
  onClick: () => void;
}

function FilterChip({ label, selected, highlighted, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm transition-all",
        selected
          ? "bg-white text-black font-medium"
          : highlighted
          ? "bg-white/30 text-white"
          : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
      )}
    >
      {label}
    </button>
  );
}
