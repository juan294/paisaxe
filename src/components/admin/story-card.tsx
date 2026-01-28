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
        "group relative w-full overflow-hidden rounded-2xl bg-white text-left transition-all hover:shadow-lg dark:bg-[#252320]",
        span === 2 && "sm:col-span-2"
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

            {/* Edit button - top right on hover */}
            <div className="absolute right-3 top-3 flex h-9 w-9 scale-90 items-center justify-center rounded-xl bg-white/90 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100 dark:bg-[#252320]/90">
              <Pencil className="h-4 w-4 text-[#2d2a26] dark:text-[#f5f3ee]" />
            </div>

            {/* Status indicator - top left on hover */}
            {needsCuration && (
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-xl bg-[#c9a55c] px-3 py-1.5 opacity-0 transition-all duration-300 group-hover:opacity-100">
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
          /* No image state */
          <div className="flex h-full flex-col items-center justify-center gap-3">
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
            {needsCuration && (
              <span className="rounded-xl bg-[#c9a55c] px-3 py-1.5 text-[10px] font-semibold text-white">
                Needs curation
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
