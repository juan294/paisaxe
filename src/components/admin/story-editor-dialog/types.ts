import type { AdminStory } from "@/types/admin";
import type { StoryCategory, StoryLocation, StoryDuration, StoryLocale, StoryTranslation } from "@/types/immersive";

export type TabType = "details" | "image" | "translations";
export type ImageSourceType = "content" | "url" | "upload";

export interface PendingTranslationChange {
  locale: StoryLocale;
  translation: StoryTranslation;
}

export interface StoryEditorDialogProps {
  story: AdminStory | null;
  onClose: () => void;
  onUpdate: (storyId: string, updates: Partial<AdminStory>) => void;
}

export const CATEGORIES: { value: StoryCategory; label: string }[] = [
  { value: "nature", label: "Nature" },
  { value: "cities", label: "Cities" },
  { value: "food", label: "Food" },
  { value: "culture", label: "Culture" },
  { value: "activities", label: "Activities" },
];

export const LOCATIONS: { value: StoryLocation; label: string }[] = [
  { value: "eastern", label: "Eastern Asturias" },
  { value: "central", label: "Central Asturias" },
  { value: "western", label: "Western Asturias" },
];

export const DURATIONS: { value: StoryDuration; label: string }[] = [
  { value: "day-trip", label: "Day Trip" },
  { value: "weekend", label: "Weekend" },
  { value: "week", label: "Week" },
];

/**
 * Generate a URL-safe slug from a title.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type { AdminStory };

