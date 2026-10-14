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
    bg: "bg-white dark:bg-admin-panel",
    activeBg: "bg-admin-ink dark:bg-admin-paper",
    icon: "text-admin-muted dark:text-admin-subtle",
    activeIcon: "text-admin-subtle dark:text-admin-muted",
    text: "text-admin-ink dark:text-admin-paper",
    activeText: "text-admin-paper dark:text-admin-ink",
    subtext: "text-admin-muted dark:text-admin-subtle",
    activeSubtext: "text-admin-subtle dark:text-admin-muted",
  },
  warning: {
    bg: "bg-white dark:bg-admin-panel",
    activeBg: "bg-[#8b7355] dark:bg-[#8b7355]",
    icon: "text-admin-warning",
    activeIcon: "text-admin-warning",
    text: "text-admin-ink dark:text-admin-paper",
    activeText: "text-admin-paper",
    subtext: "text-admin-muted dark:text-admin-subtle",
    activeSubtext: "text-[#d4c4a8]",
  },
  success: {
    bg: "bg-white dark:bg-admin-panel",
    activeBg: "bg-admin-approve dark:bg-admin-approve",
    icon: "text-admin-health-success",
    activeIcon: "text-[#a8c9a8]",
    text: "text-admin-ink dark:text-admin-paper",
    activeText: "text-admin-paper",
    subtext: "text-admin-muted dark:text-admin-subtle",
    activeSubtext: "text-[#c4d9c4]",
  },
  purple: {
    bg: "bg-white dark:bg-admin-panel",
    activeBg: "bg-[#6b5a8a] dark:bg-[#6b5a8a]",
    icon: "text-[#9b7ac9]",
    activeIcon: "text-[#c9b7e8]",
    text: "text-admin-ink dark:text-admin-paper",
    activeText: "text-admin-paper",
    subtext: "text-admin-muted dark:text-admin-subtle",
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
