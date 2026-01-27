"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
        "absolute top-16 left-6 z-20 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}
    >
      {/* Toggle Button */}
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl",
          "text-sm font-medium text-white",
          "bg-white/10 backdrop-blur-xl border border-white/20",
          "transition-colors duration-200",
          "hover:bg-white/15",
          hasActiveFilters && "ring-1 ring-white/30"
        )}
      >
        <span>{t(`stories.categories.${selectedCategory || currentCategory}`)}</span>
        {activeFilterCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 text-xs bg-white text-black rounded-full font-semibold">
            {activeFilterCount}
          </span>
        )}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.4, ease: [0.65, 0, 0.35, 1] }}
        >
          <ChevronDown className="h-4 w-4 text-white/70" />
        </motion.div>
      </motion.button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.65, 0, 0.35, 1] }}
            className={cn(
              "absolute top-full left-0 mt-2 p-4 rounded-xl",
              "bg-white/10 backdrop-blur-xl border border-white/20",
              "min-w-[280px]"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Category Filter */}
            <motion.div
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="mb-4"
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
                    delay={0.1 + index * 0.03}
                  />
                ))}
              </div>
            </motion.div>

            {/* Location Filter */}
            <motion.div
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="mb-4"
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
                    delay={0.15 + index * 0.03}
                  />
                ))}
              </div>
            </motion.div>

            {/* Duration Filter */}
            <motion.div
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="mb-4"
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
                    delay={0.2 + index * 0.03}
                  />
                ))}
              </div>
            </motion.div>

            {/* Clear All */}
            <AnimatePresence>
              {hasActiveFilters && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.15)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    onClearAll();
                    setIsExpanded(false);
                  }}
                  className={cn(
                    "w-full py-2 rounded-xl text-sm font-medium",
                    "bg-white/10 text-white/80 border border-white/10",
                    "transition-colors"
                  )}
                >
                  {t("stories.filters.clear")}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  selected: boolean;
  highlighted?: boolean;
  onClick: () => void;
  delay?: number;
}

function FilterChip({ label, selected, highlighted, onClick, delay = 0 }: FilterChipProps) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ delay, duration: 0.2, ease: [0.65, 0, 0.35, 1] }}
      whileHover={{ backgroundColor: selected ? undefined : "rgba(255, 255, 255, 0.15)" }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm transition-colors",
        selected
          ? "bg-white text-black font-medium"
          : highlighted
          ? "bg-white/20 text-white border border-white/20"
          : "bg-white/10 text-white/80"
      )}
    >
      {label}
    </motion.button>
  );
}
