export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const OG_IMAGE_CONTENT_TYPE = "image/png";

export const OG_COLORS = {
  background: "#0a0f1a",
  backgroundGradient: "#0d1b2a",
  text: "#ffffff",
  textMuted: "#94a3b8",
  accent: "#38bdf8",
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  nature: "#22c55e",
  cities: "#a78bfa",
  food: "#f97316",
  culture: "#eab308",
  activities: "#06b6d4",
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? OG_COLORS.accent;
}
