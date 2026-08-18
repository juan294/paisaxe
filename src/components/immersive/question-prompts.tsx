"use client";

import { cn } from "@/lib/utils";
import { useTranslation, type Locale } from "@/lib/i18n";
import type { Story, StoryLocale } from "@/types/immersive";

interface QuestionPromptsProps {
  prompts: string[];
  storyId: string;
  onSelectPrompt: (prompt: string) => void;
}

/**
 * UX-H6 (#892): resolve the suggested-question chips for the active locale.
 *
 * `StoryTranslation.question_prompts` is optional — a translation may exist
 * for title/subtitle/description without ever having translated prompts (or
 * the field may be missing entirely on older translation entries). This
 * falls back gracefully to the story's Spanish `question_prompts` rather
 * than rendering an empty/undefined list.
 */
export function getLocalizedQuestionPrompts(story: Story, locale: Locale): string[] {
  const spanishPrompts = story.metadata?.question_prompts || [];

  if (locale === "es") return spanishPrompts;

  const translatedPrompts = story.metadata?.translations?.[locale as StoryLocale]?.question_prompts;

  return translatedPrompts && translatedPrompts.length > 0 ? translatedPrompts : spanishPrompts;
}

export function QuestionPrompts({ prompts, storyId: _storyId, onSelectPrompt }: QuestionPromptsProps) {
  const { t } = useTranslation();

  if (!prompts || prompts.length === 0) return null;

  const handleClick = (prompt: string) => {
    onSelectPrompt(prompt);
  };

  return (
    <div role="group" aria-label={t("accessibility.suggested_questions")} className="flex flex-wrap gap-2 mt-3">
      {prompts.slice(0, 3).map((prompt) => (
        <button
          key={prompt}
          onClick={(e) => {
            e.stopPropagation();
            handleClick(prompt);
          }}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full",
            "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
            "text-white/80 hover:text-white",
            "transition-all motion-reduce:transition-none hover:scale-105 motion-reduce:hover:scale-100",
            "border border-white/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          )}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
