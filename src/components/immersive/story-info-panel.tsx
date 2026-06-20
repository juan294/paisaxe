"use client";

import { memo, type RefObject } from "react";
import { Camera, Bookmark, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Story } from "@/types/immersive";
import type { FeatureFlagKey } from "@/types/feature-flags";
import { QuestionPrompts } from "./question-prompts";
import { FreshnessBadge } from "./freshness-badge";
import { UserSubmittedBadge } from "./user-submitted-badge";
import { getLabel } from "@/lib/asturianu";

type TFunction = (key: string) => string;

interface LocalizedStory {
  title: string;
  subtitle: string;
  description: string;
}

interface StoryInfoPanelProps {
  story: Story;
  localizedStory: LocalizedStory;
  showInfo: boolean;
  t: TFunction;
  onAskAbout: ((prompt?: string) => void) | undefined;
  onToggleInfo: (() => void) | undefined;
  ast: boolean;
  isEnabled: (flag: FeatureFlagKey) => boolean;
  questionPrompts: string[];
  requiresAuth: boolean;
  onAuthRequired: (() => void) | undefined;
  onFavoritesNav: (() => void) | undefined;
  isFavorite: boolean;
  onToggleFavorite: (() => void) | undefined;
  chatTriggerRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Overlay panel that displays story title, description, badges, and action buttons.
 * Slides in/out based on `showInfo` state.
 *
 * FE-L1: memoized — all callback props passed by StoryViewer are stabilized with
 * useCallback so this component doesn't re-render on every index change.
 */
export const StoryInfoPanel = memo(function StoryInfoPanel({
  story,
  localizedStory,
  showInfo,
  t,
  onAskAbout,
  onToggleInfo,
  ast,
  isEnabled,
  questionPrompts,
  requiresAuth,
  onAuthRequired,
  onFavoritesNav,
  chatTriggerRef,
}: StoryInfoPanelProps) {
  return (
    <article
      data-testid="story-info-panel"
      aria-hidden={showInfo ? undefined : true}
      inert={showInfo ? undefined : true}
      className={cn(
        "absolute bottom-0 left-0 right-0 p-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:p-12 z-10 transition-all duration-500 motion-reduce:transition-none",
        showInfo
          ? "opacity-100 translate-y-0"
          : "pointer-events-none opacity-0 translate-y-8 motion-reduce:translate-y-0"
      )}
    >
      {/* Dedicated hide affordance — only this element dismisses the panel (#634).
          Clicking the description text no longer toggles the panel, so reading
          long descriptions is no longer fragile. */}
      {onToggleInfo && (
        <button
          type="button"
          data-testid="hide-info-button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleInfo();
          }}
          aria-label={t("accessibility.hide_info")}
          className="absolute top-3 right-3 md:top-4 md:right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white transition-all motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <ChevronDown className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {/* Badges */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {isEnabled("story_freshness") && (
          <FreshnessBadge createdAt={story.createdAt} storyId={story.id} />
        )}
        {story.sourceType === "user_submitted" && (
          <UserSubmittedBadge />
        )}
      </div>

      <p className="text-white/70 text-sm md:text-base font-medium mb-2 tracking-wider uppercase">
        {ast && story.metadata?.asturianu_subtitle
          ? story.metadata.asturianu_subtitle
          : localizedStory.subtitle}
      </p>
      <h1 data-testid="story-title" className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
        {ast && story.metadata?.asturianu_title
          ? story.metadata.asturianu_title
          : localizedStory.title}
      </h1>
      <p className="text-lg md:text-xl text-white/80 max-w-2xl leading-relaxed mb-2">
        {localizedStory.description}
      </p>

      {/* Image source attribution */}
      {story.imageSource && (
        <p className="text-xs text-white/60 mb-6 flex items-center gap-1">
          <Camera className="h-3 w-3" aria-hidden="true" />
          <span>{story.imageSource}</span>
        </p>
      )}

      {!story.imageSource && <div className="mb-6" />}

      {/* Contextual question prompts */}
      {isEnabled("contextual_prompts") && questionPrompts.length > 0 && (
        <QuestionPrompts
          prompts={questionPrompts}
          storyId={story.id}
          onSelectPrompt={(prompt) => onAskAbout?.(prompt)}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          ref={chatTriggerRef}
          data-testid="ask-button"
          onClick={(e) => {
            e.stopPropagation();
            onAskAbout?.();
          }}
          className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all motion-reduce:transition-none hover:scale-105 motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          {ast ? getLabel("ask_about", true) : t("stories.ask_about")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (requiresAuth) {
              onAuthRequired?.();
            } else {
              onFavoritesNav?.();
            }
          }}
          className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-full font-medium transition-all motion-reduce:transition-none hover:scale-105 motion-reduce:hover:scale-100 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <Bookmark className="h-5 w-5" />
          <span>{ast ? getLabel("bookmarks", true) : t("favorites.bookmarks")}</span>
        </button>
      </div>
    </article>
  );
});
