import type { SuggestionStatus } from "@/types/suggestions";

export const STATUS_LABELS: Record<SuggestionStatus, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  converted: "Converted",
  rejected: "Rejected",
};

export const STATUS_COLORS: Record<SuggestionStatus, { bg: string; text: string; dot: string }> = {
  pending: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  reviewed: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  converted: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  rejected: {
    bg: "bg-admin-paper dark:bg-admin-depth",
    text: "text-admin-muted dark:text-admin-subtle",
    dot: "bg-admin-subtle",
  },
};

export const LOCATION_LABELS: Record<string, string> = {
  eastern: "Eastern Asturias",
  central: "Central Asturias",
  western: "Western Asturias",
};

