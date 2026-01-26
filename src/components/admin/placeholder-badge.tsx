import { cn } from "@/lib/utils";

interface PlaceholderBadgeProps {
  className?: string;
}

export function PlaceholderBadge({ className }: PlaceholderBadgeProps) {
  return (
    <span
      className={cn(
        "absolute bottom-3 left-3 rounded-full bg-blue-500 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg",
        className
      )}
    >
      Placeholder
    </span>
  );
}
