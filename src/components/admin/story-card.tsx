"use client";

import Image from "next/image";
import { ImageIcon, Pencil } from "lucide-react";
import type { AdminStory } from "@/types/admin";
import { CATEGORY_LABELS } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/unsplash-placeholders";
import { hasMissingTranslations } from "@/lib/admin-formatters";
import { StorySelectionCheckbox } from "./story-card/selection-checkbox";

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
        "group relative w-full overflow-hidden rounded-2xl bg-white text-left transition-all hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-approve focus-visible:ring-offset-2 dark:bg-admin-panel",
        span === 2 && "sm:col-span-2",
        isSelected && "ring-2 ring-admin-approve ring-offset-2 ring-offset-admin-paper dark:ring-offset-admin-canvas-dark"
      )}
    >
      {/* Image Container */}
      <div className={cn(
        "relative w-full overflow-hidden bg-admin-paper dark:bg-admin-ink",
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

            {/* Reveal readable content for hover, keyboard focus and touch. */}
            <div className="absolute inset-0 bg-gradient-to-t from-admin-ink/80 via-admin-ink/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100" />

            {/* Selection checkbox - top left */}
            {onToggleSelect && (
              <StorySelectionCheckbox storyTitle={story.title} isSelected={isSelected} selectionMode={selectionMode} onClick={handleCheckboxClick} hasImage={true} />
            )}

            {/* Content overlay follows the same access modes as the gradient. */}
            <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 transition-all duration-300 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
              <div className="translate-y-2 transform transition-transform duration-300 group-hover:translate-y-0 group-focus-within:translate-y-0 pointer-coarse:translate-y-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-admin-paper/70">
                  {CATEGORY_LABELS[story.category]}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-admin-paper">
                  {story.title}
                </h3>
                {story.subtitle && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-admin-paper/80">
                    {story.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Badges container - top right, always visible */}
            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              {/* Pending badge */}
              {needsCuration && (
                <span className="rounded-full bg-admin-warning px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white shadow-lg">
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

              {/* Visual edit affordance for the parent card button. */}
              <div className="flex h-7 w-7 scale-90 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 pointer-coarse:scale-100 pointer-coarse:opacity-100 dark:bg-admin-panel/90">
                <Pencil className="h-3 w-3 text-admin-ink dark:text-admin-paper" />
              </div>
            </div>
          </>
        ) : (
          /* No image state */
          <div className="relative flex h-full flex-col items-center justify-center gap-3">
            {/* Selection checkbox - top left */}
            {onToggleSelect && (
              <StorySelectionCheckbox storyTitle={story.title} isSelected={isSelected} selectionMode={selectionMode} onClick={handleCheckboxClick} hasImage={false} />
            )}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-admin-ink">
              <ImageIcon className="h-6 w-6 text-admin-subtle" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-admin-ink dark:text-admin-paper">
                {story.title}
              </p>
              <p className="mt-0.5 text-xs text-admin-muted dark:text-admin-subtle">
                No image · Click to add
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {needsCuration && (
                <span className="rounded-full bg-admin-warning px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">
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
