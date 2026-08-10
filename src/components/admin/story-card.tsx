"use client";

import Image from "next/image";
import { ImageIcon, Pencil, Check } from "lucide-react";
import type { AdminStory } from "@/types/admin";
import { CATEGORY_LABELS } from "@/types/immersive";
import type { StoryMetadata, TranslationStatus } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/unsplash-placeholders";
import { TRANSLATION_LOCALES } from "@/lib/translation-locales";

/**
 * Check if a story is missing any translations.
 */
function hasMissingTranslations(story: AdminStory): boolean {
  const metadata = story.metadata as StoryMetadata | undefined;
  if (!metadata) return true;

  const translations = metadata.translations || {};
  const status = metadata.translation_status || {};

  for (const locale of TRANSLATION_LOCALES) {
    const translation = translations[locale];
    const localeStatus = status[locale] as TranslationStatus | undefined;

    // Missing if no translation content or status is not complete
    const hasContent = translation && (
      translation.title?.trim() ||
      translation.subtitle?.trim() ||
      translation.description?.trim()
    );

    if (!hasContent || localeStatus?.status !== "complete") {
      return true;
    }
  }

  return false;
}

interface StoryCardProps {
  story: AdminStory;
  onEdit: (story: AdminStory) => void;
  span?: 1 | 2;
  isSelected?: boolean;
  onToggleSelect?: (storyId: string) => void;
  selectionMode?: boolean;
}

export function StoryCard({
  story,
  onEdit,
  span = 1,
  isSelected = false,
  onToggleSelect,
  selectionMode = false,
}: StoryCardProps) {
  const needsCuration = story.curationStatus === "needs_curation";

  const handleClick = (e: React.MouseEvent) => {
    if (selectionMode && onToggleSelect) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(story.id);
    } else {
      onEdit(story);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect?.(story.id);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl bg-white text-left transition-all hover:shadow-lg dark:bg-[#252320]",
        span === 2 && "sm:col-span-2",
        isSelected && "ring-2 ring-[#5a7a5a] ring-offset-2 ring-offset-[#f5f3ee] dark:ring-offset-[#1a1917]"
      )}
    >
      {/* Image Container */}
      <div className={cn(
        "relative w-full overflow-hidden bg-[#f5f3ee] dark:bg-[#2d2a26]",
        span === 2 ? "aspect-[21/9]" : "aspect-[4/3]"
      )}>
        {story.image ? (
          <>
            <Image
              src={story.image}
              alt={story.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes={span === 2
                ? "(max-width: 768px) 100vw, 66vw"
                : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              }
            />

            {/* Gradient overlay - appears on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#2d2a26]/80 via-[#2d2a26]/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* Selection checkbox - top left */}
            {onToggleSelect && (
              <div
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={handleCheckboxClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCheckboxClick(e as unknown as React.MouseEvent);
                  }
                }}
                className={cn(
                  "absolute left-3 top-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-2 transition-all",
                  isSelected
                    ? "border-[#5a7a5a] bg-[#5a7a5a]"
                    : "border-white/80 bg-white/20 opacity-0 backdrop-blur-sm group-hover:opacity-100",
                  selectionMode && !isSelected && "opacity-100"
                )}
              >
                {isSelected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
              </div>
            )}

            {/* Content overlay - appears on hover */}
            <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 transition-all duration-300 group-hover:opacity-100">
              <div className="translate-y-2 transform transition-transform duration-300 group-hover:translate-y-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#f5f3ee]/70">
                  {CATEGORY_LABELS[story.category]}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-[#f5f3ee]">
                  {story.title}
                </h3>
                {story.subtitle && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-[#f5f3ee]/80">
                    {story.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Badges container - top right, always visible */}
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              {/* Pending badge */}
              {needsCuration && (
                <span className="rounded-full bg-[#c9a55c] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white shadow-lg">
                  Pending
                </span>
              )}

              {/* Placeholder badge */}
              {isPlaceholderImage(story) && (
                <span
                  data-testid="placeholder-badge"
                  className="rounded-full bg-blue-500 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white shadow-lg"
                >
                  Placeholder
                </span>
              )}

              {/* Missing translations badge */}
              {hasMissingTranslations(story) && (
                <span
                  data-testid="translations-badge"
                  className="rounded-full bg-purple-500 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white shadow-lg"
                >
                  i18n
                </span>
              )}

              {/* Edit button - appears on hover */}
              <div className="flex h-7 w-7 scale-90 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 dark:bg-[#252320]/90">
                <Pencil className="h-3 w-3 text-[#2d2a26] dark:text-[#f5f3ee]" />
              </div>
            </div>
          </>
        ) : (
          /* No image state */
          <div className="relative flex h-full flex-col items-center justify-center gap-3">
            {/* Selection checkbox - top left */}
            {onToggleSelect && (
              <div
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={handleCheckboxClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCheckboxClick(e as unknown as React.MouseEvent);
                  }
                }}
                className={cn(
                  "absolute left-3 top-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-2 transition-all",
                  isSelected
                    ? "border-[#5a7a5a] bg-[#5a7a5a]"
                    : "border-[#a39e98]/50 bg-white/50 opacity-0 group-hover:opacity-100 dark:bg-[#2d2a26]/50",
                  selectionMode && !isSelected && "opacity-100"
                )}
              >
                {isSelected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
              </div>
            )}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-[#2d2a26]">
              <ImageIcon className="h-6 w-6 text-[#a39e98]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#2d2a26] dark:text-[#f5f3ee]">
                {story.title}
              </p>
              <p className="mt-0.5 text-xs text-[#6b6560] dark:text-[#a39e98]">
                No image · Click to add
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {needsCuration && (
                <span className="rounded-full bg-[#c9a55c] px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">
                  Pending
                </span>
              )}
              {hasMissingTranslations(story) && (
                <span className="rounded-full bg-purple-500 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">
                  i18n
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
