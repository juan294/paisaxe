"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CurationBadge } from "./curation-badge";
import type { AdminStory } from "@/types/admin";
import { CATEGORY_LABELS } from "@/types/immersive";

interface StoryCardProps {
  story: AdminStory;
  onEdit: (story: AdminStory) => void;
}

export function StoryCard({ story, onEdit }: StoryCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card">
      {/* Image */}
      <div className="relative aspect-[4/3] bg-muted">
        {story.image ? (
          <Image
            src={story.image}
            alt={story.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold">{story.title}</h3>
          <CurationBadge status={story.curationStatus} />
        </div>

        {story.subtitle && (
          <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
            {story.subtitle}
          </p>
        )}

        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-secondary px-1.5 py-0.5">
            {CATEGORY_LABELS[story.category]}
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onEdit(story)}
        >
          Edit Image
        </Button>
      </div>
    </div>
  );
}
