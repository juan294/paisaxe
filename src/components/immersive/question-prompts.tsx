"use client";

import { cn } from "@/lib/utils";

interface QuestionPromptsProps {
  prompts: string[];
  storyId: string;
  onSelectPrompt: (prompt: string) => void;
}

export function QuestionPrompts({ prompts, storyId: _storyId, onSelectPrompt }: QuestionPromptsProps) {
  if (!prompts || prompts.length === 0) return null;

  const handleClick = (prompt: string) => {
    onSelectPrompt(prompt);
  };

  return (
    <div className="flex flex-wrap gap-2 mt-3">
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
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-1 focus-visible:ring-offset-black"
          )}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
