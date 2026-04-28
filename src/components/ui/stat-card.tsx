import { cn } from "@/lib/utils";

export interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  variant: "default" | "warning" | "success" | "purple";
  isActive?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}

const VARIANTS = {
  default: {
    bg: "bg-white dark:bg-[#252320]",
    activeBg: "bg-[#2d2a26] dark:bg-[#f5f3ee]",
    icon: "text-[#6b6560] dark:text-[#a39e98]",
    activeIcon: "text-[#a39e98] dark:text-[#6b6560]",
    text: "text-[#2d2a26] dark:text-[#f5f3ee]",
    activeText: "text-[#f5f3ee] dark:text-[#2d2a26]",
    subtext: "text-[#6b6560] dark:text-[#a39e98]",
    activeSubtext: "text-[#a39e98] dark:text-[#6b6560]",
  },
  warning: {
    bg: "bg-white dark:bg-[#252320]",
    activeBg: "bg-[#8b7355] dark:bg-[#8b7355]",
    icon: "text-[#c9a55c]",
    activeIcon: "text-[#c9a55c]",
    text: "text-[#2d2a26] dark:text-[#f5f3ee]",
    activeText: "text-[#f5f3ee]",
    subtext: "text-[#6b6560] dark:text-[#a39e98]",
    activeSubtext: "text-[#d4c4a8]",
  },
  success: {
    bg: "bg-white dark:bg-[#252320]",
    activeBg: "bg-[#5a7a5a] dark:bg-[#5a7a5a]",
    icon: "text-[#7a9e7a]",
    activeIcon: "text-[#a8c9a8]",
    text: "text-[#2d2a26] dark:text-[#f5f3ee]",
    activeText: "text-[#f5f3ee]",
    subtext: "text-[#6b6560] dark:text-[#a39e98]",
    activeSubtext: "text-[#c4d9c4]",
  },
  purple: {
    bg: "bg-white dark:bg-[#252320]",
    activeBg: "bg-[#6b5a8a] dark:bg-[#6b5a8a]",
    icon: "text-[#9b7ac9]",
    activeIcon: "text-[#c9b7e8]",
    text: "text-[#2d2a26] dark:text-[#f5f3ee]",
    activeText: "text-[#f5f3ee]",
    subtext: "text-[#6b6560] dark:text-[#a39e98]",
    activeSubtext: "text-[#d4c9e8]",
  },
} as const;

export function StatCard({
  icon,
  value,
  label,
  variant,
  isActive,
  onClick,
  ariaLabel,
}: StatCardProps) {
  const v = VARIANTS[variant];

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "rounded-2xl p-5 text-left transition-all",
        isActive ? v.activeBg : v.bg,
        !isActive && "hover:scale-[1.02] hover:shadow-md"
      )}
    >
      <div className={cn("mb-4", isActive ? v.activeIcon : v.icon)}>{icon}</div>
      <p
        className={cn(
          "text-4xl font-extralight tabular-nums tracking-tighter",
          isActive ? v.activeText : v.text
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-[10px] uppercase tracking-widest",
          isActive ? v.activeSubtext : v.subtext
        )}
      >
        {label}
      </p>
    </button>
  );
}
