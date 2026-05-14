import type { StoryLocale } from "@/types/immersive";

/** All supported translation locales. */
export const TRANSLATION_LOCALES: StoryLocale[] = ["en", "fr", "de", "pt", "ast"];

/** Locale display names for admin translation UI. */
export const LOCALE_NAMES: Record<StoryLocale, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ast: "Asturianu",
};
