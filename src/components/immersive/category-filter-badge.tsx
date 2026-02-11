"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import {
  StoryCategory,
  StoryLocation,
  StoryDuration,
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
  const { t } = useTranslation();

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
        "absolute top-16 left-6 z-30 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        aria-expanded={isExpanded}
        aria-haspopup="true"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl",
          "text-sm font-medium text-white",
          "bg-white/10 backdrop-blur-xl border border-white/20",
          "transition-all duration-200",
          "hover:bg-white/15",
          "active:scale-95",
          hasActiveFilters && "ring-1 ring-white/30"
        )}
      >
        <span>{t(`stories.categories.${selectedCategory || currentCategory}`)}</span>
        {activeFilterCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-xs bg-white text-black rounded-full font-semibold">
            {activeFilterCount}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-white/70 transition-transform duration-300 ease-[cubic-bezier(0.65,0,0.35,1)]",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Panel */}
      <div
        className={cn(
          "absolute top-full left-0 mt-2 p-4 rounded-xl",
          "bg-white/10 backdrop-blur-xl border border-white/20",
          "min-w-[280px]",
          "transition-all duration-200 ease-[cubic-bezier(0.65,0,0.35,1)]",
          isExpanded
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Category Filter */}
        <div
          className={cn(
            "mb-4 transition-all duration-300",
            isExpanded ? "opacity-100" : "opacity-0"
          )}
          style={{ transitionDelay: isExpanded ? "50ms" : "0ms" }}
        >
          <div className="text-white/50 text-xs uppercase tracking-wider mb-2 font-medium">
            {t("stories.filters.category")}
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category, index) => (
              <FilterChip
                key={category}
                label={t(`stories.categories.${category}`)}
                selected={selectedCategory === category}
                highlighted={!selectedCategory && category === currentCategory}
                onClick={() =>
                  onCategoryChange(selectedCategory === category ? null : category)
                }
                delay={100 + index * 30}
                isVisible={isExpanded}
              />
            ))}
          </div>
        </div>

        {/* Location Filter */}
        <div
          className={cn(
            "mb-4 transition-all duration-300",
            isExpanded ? "opacity-100" : "opacity-0"
          )}
          style={{ transitionDelay: isExpanded ? "100ms" : "0ms" }}
        >
          <div className="text-white/50 text-xs uppercase tracking-wider mb-2 font-medium">
            {t("stories.filters.location")}
          </div>
          <div className="flex flex-wrap gap-2">
            {LOCATIONS.map((location, index) => (
              <FilterChip
                key={location}
                label={t(`stories.locations.${location}`)}
                selected={selectedLocation === location}
                onClick={() =>
                  onLocationChange(selectedLocation === location ? null : location)
                }
                delay={150 + index * 30}
                isVisible={isExpanded}
              />
            ))}
          </div>
        </div>

        {/* Duration Filter */}
        <div
          className={cn(
            "mb-4 transition-all duration-300",
            isExpanded ? "opacity-100" : "opacity-0"
          )}
          style={{ transitionDelay: isExpanded ? "150ms" : "0ms" }}
        >
          <div className="text-white/50 text-xs uppercase tracking-wider mb-2 font-medium">
            {t("stories.filters.duration")}
          </div>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((duration, index) => (
              <FilterChip
                key={duration}
                label={t(`stories.durations.${duration}`)}
                selected={selectedDuration === duration}
                onClick={() =>
                  onDurationChange(selectedDuration === duration ? null : duration)
                }
                delay={200 + index * 30}
                isVisible={isExpanded}
              />
            ))}
          </div>
        </div>

        {/* Clear All */}
        <button
          onClick={() => {
            onClearAll();
            setIsExpanded(false);
          }}
          className={cn(
            "w-full py-2 rounded-xl text-sm font-medium",
            "bg-white/10 text-white/80 border border-white/10",
            "transition-all duration-200",
            "hover:bg-white/15",
            "active:scale-95",
            hasActiveFilters
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          )}
        >
          {t("stories.filters.clear")}
        </button>
      </div>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  selected: boolean;
  highlighted?: boolean;
  onClick: () => void;
  delay?: number;
  isVisible: boolean;
}

function FilterChip({ label, selected, highlighted, onClick, delay = 0, isVisible }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        animationDelay: isVisible ? `${delay}ms` : "0ms",
      }}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm",
        "transition-all duration-200",
        "active:scale-95",
        selected
          ? "bg-white text-black font-medium"
          : highlighted
          ? "bg-white/20 text-white border border-white/20 hover:bg-white/25"
          : "bg-white/10 text-white/80 hover:bg-white/15",
        isVisible && "animate-fade-in-up"
      )}
    >
      {label}
    </button>
  );
}
