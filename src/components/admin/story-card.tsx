"use client";

import Image from "next/image";
import { ImageIcon, Pencil } from "lucide-react";
import type { AdminStory } from "@/types/admin";
import { CATEGORY_LABELS } from "@/types/immersive";
import { cn } from "@/lib/utils";
import { isPlaceholderImage } from "@/lib/unsplash-placeholders";
import { PlaceholderBadge } from "./placeholder-badge";

interface StoryCardProps {
  story: AdminStory;
  onEdit: (story: AdminStory) => void;
  span?: 1 | 2;
}

export function StoryCard({ story, onEdit, span = 1 }: StoryCardProps) {
  const needsCuration = story.curationStatus === "needs_curation";

  return (
    <button
      onClick={() => onEdit(story)}
      className={cn(
        "group relative w-full overflow-hidden rounded-lg text-left",
        span === 2 && "sm:col-span-2"
      )}
    >
      {/* Image Container - taller aspect ratio for gallery feel */}
      <div className={cn(
        "relative w-full overflow-hidden bg-neutral-900",
        span === 2 ? "aspect-[21/9]" : "aspect-[4/3]"
      )}>
        {story.image ? (
          <>
            <Image
              src={story.image}
              alt={story.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes={span === 2
                ? "(max-width: 768px) 100vw, 66vw"
                : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              }
            />

            {/* Gradient overlay - appears on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* Content overlay - appears on hover */}
            <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-0 transition-all duration-300 group-hover:opacity-100">
              {/* Title and subtitle slide up */}
              <div className="translate-y-2 transform transition-transform duration-300 group-hover:translate-y-0">
                <p className="text-xs font-medium uppercase tracking-wider text-white/60">
                  {CATEGORY_LABELS[story.category]}
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

            {/* Edit button - top right on hover */}
            <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:opacity-100">
              <Pencil className="h-4 w-4 text-neutral-800" />
            </div>

            {/* Status indicator - top left on hover */}
            {needsCuration && (
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-1 opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white">
                  Pending
                </span>
              </div>
            )}

            {/* Placeholder badge - bottom left, always visible */}
            {isPlaceholderImage(story) && <PlaceholderBadge />}
          </>
        ) : (
          /* No image state - always visible */
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-neutral-100 dark:bg-neutral-800">
            <ImageIcon className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {story.title}
              </p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                No image · Click to add
              </p>
            </div>
            {needsCuration && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Needs curation
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
