"use client";

import { useState, memo } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { Story } from "@/types/immersive";

// Dark placeholder for images (prevents flash of white and CLS)
const darkPlaceholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect fill='%231a1a1a' width='1' height='1'/%3E%3C/svg%3E";

interface RelatedStoriesProps {
  stories: Story[];
  onSelectStory: (story: Story) => void;
}

export const RelatedStories = memo(function RelatedStories({
  stories,
  onSelectStory,
}: RelatedStoriesProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useTranslation();

  if (stories.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={t("accessibility.related_stories")}
      role="region"
      className="absolute bottom-24 left-0 right-0 z-20 px-6"
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 mb-3 px-3 py-1.5 rounded-full",
          "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
          "text-white/80 hover:text-white text-sm font-medium",
          "transition-all motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        )}
        aria-expanded={isExpanded}
      >
        <span>{t("stories.related")}</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </button>

      {/* Stories Grid */}
      {isExpanded && (
        <div
          className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in duration-300 motion-reduce:animate-none"
        >
        {stories.map((story) => (
          <button
            key={story.id}
            onClick={() => onSelectStory(story)}
            className={cn(
              "group relative flex items-end overflow-hidden rounded-lg",
              "h-24 md:h-28",
              "bg-black/40 backdrop-blur-sm",
              "hover:ring-2 hover:ring-white/50 transition-all motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            )}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <Image
                src={story.image}
                alt={story.title}
                fill
                className="object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                sizes="(max-width: 768px) 50vw, 33vw"
                placeholder="blur"
                blurDataURL={story.blurDataUrl || darkPlaceholder}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </div>

            {/* Content */}
            <div className="relative p-3 w-full">
              <span className="text-[10px] uppercase tracking-wider text-white/60 block mb-0.5">
                {t(`stories.categories.${story.category}`)}
              </span>
              <h3 className="text-sm font-medium text-white line-clamp-1">
                {story.title}
              </h3>
            </div>
          </button>
        ))}
        </div>
      )}
    </section>
  );
});
