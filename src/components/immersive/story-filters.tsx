"use client";

import { useState } from "react";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import {
  StoryCategory,
  StoryLocation,
  StoryDuration,
} from "@/types/immersive";

interface StoryFiltersProps {
  selectedCategory: StoryCategory | null;
  selectedLocation: StoryLocation | null;
  selectedDuration: StoryDuration | null;
  onCategoryChange: (category: StoryCategory | null) => void;
  onLocationChange: (location: StoryLocation | null) => void;
  onDurationChange: (duration: StoryDuration | null) => void;
  onClearAll: () => void;
}

const CATEGORIES: StoryCategory[] = ["nature", "cities", "food", "culture", "activities"];
const LOCATIONS: StoryLocation[] = ["eastern", "central", "western"];
const DURATIONS: StoryDuration[] = ["day-trip", "weekend", "week"];

export function StoryFilters({
  selectedCategory,
  selectedLocation,
  selectedDuration,
  onCategoryChange,
  onLocationChange,
  onDurationChange,
  onClearAll,
}: StoryFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  const activeFilterCount = [selectedCategory, selectedLocation, selectedDuration].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
          "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
          "text-white font-medium"
        )}
        aria-expanded={isOpen}
        aria-controls="filter-panel"
      >
        <Filter className="h-4 w-4" />
        <span>{t("stories.filters.title")}</span>
        {hasActiveFilters && (
          <span className="flex items-center justify-center w-5 h-5 text-xs bg-white text-black rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div
          id="filter-panel"
          className={cn(
            "absolute top-full right-0 mt-2 p-4 rounded-xl",
            "bg-black/80 backdrop-blur-md border border-white/10",
            "min-w-[280px] max-w-[320px]"
          )}
        >
          {/* Category Filter */}
          <fieldset role="group" aria-label={t("stories.filters.category")} className="mb-4">
            <legend className="text-white/60 text-xs uppercase tracking-wider mb-2">
              {t("stories.filters.category")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <FilterChip
                  key={category}
                  label={t(`stories.categories.${category}`)}
                  selected={selectedCategory === category}
                  onClick={() =>
                    onCategoryChange(selectedCategory === category ? null : category)
                  }
                />
              ))}
            </div>
          </fieldset>

          {/* Location Filter */}
          <fieldset role="group" aria-label={t("stories.filters.location")} className="mb-4">
            <legend className="text-white/60 text-xs uppercase tracking-wider mb-2">
              {t("stories.filters.location")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {LOCATIONS.map((location) => (
                <FilterChip
                  key={location}
                  label={t(`stories.locations.${location}`)}
                  selected={selectedLocation === location}
                  onClick={() =>
                    onLocationChange(selectedLocation === location ? null : location)
                  }
                />
              ))}
            </div>
          </fieldset>

          {/* Duration Filter */}
          <fieldset role="group" aria-label={t("stories.filters.duration")} className="mb-4">
            <legend className="text-white/60 text-xs uppercase tracking-wider mb-2">
              {t("stories.filters.duration")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((duration) => (
                <FilterChip
                  key={duration}
                  label={t(`stories.durations.${duration}`)}
                  selected={selectedDuration === duration}
                  onClick={() =>
                    onDurationChange(selectedDuration === duration ? null : duration)
                  }
                />
              ))}
            </div>
          </fieldset>

          {/* Clear All Button */}
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm",
                "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white",
                "transition-all"
              )}
            >
              <X className="h-3 w-3" />
              <span>{t("stories.filters.clear")}</span>
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
  onClick: () => void;
}

function FilterChip({ label, selected, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      data-selected={selected}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm transition-all",
        selected
          ? "bg-white text-black font-medium"
          : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
      )}
    >
      {label}
    </button>
  );
}
