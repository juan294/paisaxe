import type { MouseEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StorySelectionCheckboxProps {
  storyTitle: string;
  isSelected: boolean;
  selectionMode: boolean;
  hasImage: boolean;
  onClick: (event: MouseEvent) => void;
}

export function StorySelectionCheckbox({ storyTitle, isSelected, selectionMode, hasImage, onClick }: StorySelectionCheckboxProps) {
  return (
    <div
      role="checkbox"
      aria-label={`Seleccionar ${storyTitle}`}
      aria-checked={isSelected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(event as unknown as MouseEvent);
        }
      }}
      className={cn(
        "absolute left-3 top-3 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-2 transition-all group-focus-within:opacity-100 pointer-coarse:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-approve focus-visible:ring-offset-2",
        isSelected
          ? "border-admin-approve bg-admin-approve"
          : hasImage
            ? "border-white/80 bg-white/20 opacity-0 backdrop-blur-sm group-hover:opacity-100"
            : "border-admin-subtle/50 bg-white/50 opacity-0 group-hover:opacity-100 dark:bg-admin-ink/50",
        selectionMode && !isSelected && "opacity-100"
      )}
    >
      {isSelected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
    </div>
  );
}
