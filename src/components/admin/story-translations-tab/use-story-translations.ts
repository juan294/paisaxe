"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchStoryTranslations, generateStoryTranslations } from "@/lib/admin-api";
import { TRANSLATION_LOCALES, LOCALE_NAMES } from "@/lib/translation-locales";
import type { StoryLocale, StoryTranslation, TranslationStatus } from "@/types/immersive";
import type { AdminStory } from "@/types/admin";

interface PendingTranslationChanges {
  locale: StoryLocale;
  translation: StoryTranslation;
}

export interface StoryTranslationsTabProps {
  story: AdminStory;
  onTranslationChange?: (hasChanges: boolean, pendingChanges: PendingTranslationChanges[]) => void;
  onMetadataUpdated?: (metadata: Record<string, unknown>) => void;
}

interface LocaleState {
  translation: StoryTranslation;
  status: TranslationStatus | null;
  isDirty: boolean;
}

export function useStoryTranslations({ story, onTranslationChange, onMetadataUpdated }: StoryTranslationsTabProps) {
  const [selectedLocale, setSelectedLocale] = useState<StoryLocale>("en");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Original Spanish content
  const [original, setOriginal] = useState({
    title: story.title,
    subtitle: story.subtitle,
    description: story.description,
  });

  // Translation state per locale
  const [localeStates, setLocaleStates] = useState<
    Record<StoryLocale, LocaleState>
  >(() => {
    const initial: Record<StoryLocale, LocaleState> = {} as Record<StoryLocale, LocaleState>;
    for (const locale of TRANSLATION_LOCALES) {
      initial[locale] = {
        translation: { title: "", subtitle: "", description: "" },
        status: null,
        isDirty: false,
      };
    }
    return initial;
  });

  // Load translations on mount
  const loadTranslations = useCallback(async (notifyParent = false) => {
    setIsLoading(true);
    setError("");

    const result = await fetchStoryTranslations(story.id);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setOriginal(result.data.original);

      const newStates: Record<StoryLocale, LocaleState> = {} as Record<StoryLocale, LocaleState>;
      for (const locale of TRANSLATION_LOCALES) {
        newStates[locale] = {
          translation: result.data.translations[locale] || {
            title: "",
            subtitle: "",
            description: "",
          },
          status: result.data.status[locale] || null,
          isDirty: false,
        };
      }
      setLocaleStates(newStates);

      // Notify parent of updated metadata (for refreshing story cards)
      if (notifyParent && onMetadataUpdated) {
        onMetadataUpdated({
          ...story.metadata,
          translations: result.data.translations,
          translation_status: result.data.status,
        });
      }
    }

    setIsLoading(false);
  }, [story.id, story.metadata, onMetadataUpdated]);

  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  // Track changes and notify parent with pending changes
  useEffect(() => {
    const pendingChanges: PendingTranslationChanges[] = [];
    for (const locale of TRANSLATION_LOCALES) {
      const state = localeStates[locale];
      if (state.isDirty) {
        pendingChanges.push({ locale, translation: state.translation });
      }
    }
    const hasChanges = pendingChanges.length > 0;
    onTranslationChange?.(hasChanges, pendingChanges);
  }, [localeStates, onTranslationChange]);

  // Update a field in the current locale
  const updateField = (
    field: keyof StoryTranslation,
    value: string
  ) => {
    setLocaleStates((prev) => ({
      ...prev,
      [selectedLocale]: {
        ...prev[selectedLocale],
        translation: {
          ...prev[selectedLocale].translation,
          [field]: value,
        },
        isDirty: true,
      },
    }));
  };

  // Generate all translations
  const handleGenerateAll = async () => {
    setIsGenerating(true);
    setError("");
    setSuccessMessage("");

    const result = await generateStoryTranslations(story.id);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSuccessMessage(
        `Generated ${result.data.successCount}/${
          result.data.successCount + result.data.failedCount
        } translations`
      );
      // Reload to get fresh data and notify parent to update story cards
      await loadTranslations(true);
      setTimeout(() => setSuccessMessage(""), 3000);
    }

    setIsGenerating(false);
  };

  // Regenerate single locale
  const handleRegenerateLocale = async (locale: StoryLocale) => {
    setIsGenerating(true);
    setError("");
    setSuccessMessage("");

    const result = await generateStoryTranslations(story.id, {
      locales: [locale],
      forceRetranslate: true,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage(`${LOCALE_NAMES[locale]} regenerated`);
      // Reload to get fresh data and notify parent to update story cards
      await loadTranslations(true);
      setTimeout(() => setSuccessMessage(""), 3000);
    }

    setIsGenerating(false);
  };

  // Count complete translations
  const completeCount = Object.values(localeStates).filter(
    (s) => s.status?.status === "complete"
  ).length;

  const currentState = localeStates[selectedLocale];

  return {
    selectedLocale,
    setSelectedLocale,
    isLoading,
    isGenerating,
    error,
    successMessage,
    original,
    localeStates,
    updateField,
    handleGenerateAll,
    handleRegenerateLocale,
    completeCount,
    currentState,
  };
}
