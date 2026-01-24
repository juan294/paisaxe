"use client";

import { Button } from "@/components/ui/button";
import type { SuggestionChip } from "@/types";
import { cn } from "@/lib/utils";

interface SuggestionChipsProps {
  suggestions: SuggestionChip[];
  onSelect: (query: string) => void;
  compact?: boolean;
}

export function SuggestionChips({
  suggestions,
  onSelect,
  compact = false,
}: SuggestionChipsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        compact ? "justify-start" : "justify-center"
      )}
    >
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion.query}
          variant="outline"
          size={compact ? "sm" : "default"}
          onClick={() => onSelect(suggestion.query)}
          className={cn(
            "rounded-full",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {suggestion.label}
        </Button>
      ))}
    </div>
  );
}
