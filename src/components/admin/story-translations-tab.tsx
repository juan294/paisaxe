"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertCircle,
  Check,
  RefreshCw,
  Languages,
  Clock,
} from "lucide-react";
import {
  fetchStoryTranslations,
  generateStoryTranslations,
} from "@/lib/admin-api";
import { TRANSLATION_LOCALES, LOCALE_NAMES } from "@/lib/translation-locales";
import type { StoryLocale, StoryTranslation, TranslationStatus } from "@/types/immersive";
import type { AdminStory } from "@/types/admin";
import { cn } from "@/lib/utils";

interface PendingTranslationChanges {
  locale: StoryLocale;
  translation: StoryTranslation;
}

interface StoryTranslationsTabProps {
  story: AdminStory;
  onTranslationChange?: (hasChanges: boolean, pendingChanges: PendingTranslationChanges[]) => void;
  onMetadataUpdated?: (metadata: Record<string, unknown>) => void;
}

interface LocaleState {
  translation: StoryTranslation;
  status: TranslationStatus | null;
  isDirty: boolean;
}

const STATUS_ICONS: Record<TranslationStatus["status"], React.ReactNode> = {
  complete: <Check className="h-3 w-3 text-emerald-500" />,
  pending: <Clock className="h-3 w-3 text-amber-500" />,
  translating: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
  failed: <AlertCircle className="h-3 w-3 text-red-500" />,
};

const STATUS_COLORS: Record<TranslationStatus["status"], string> = {
  complete: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  translating: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
};

export function StoryTranslationsTab({
  story,
  onTranslationChange,
  onMetadataUpdated,
}: StoryTranslationsTabProps) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#6b6560]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between rounded-lg bg-[#f5f3ee] px-4 py-3 dark:bg-[#2d2a26]">
        <div className="flex items-center gap-2 text-sm text-[#6b6560] dark:text-[#a39e98]">
          <Languages className="h-4 w-4" />
          <span>
            {completeCount}/{TRANSLATION_LOCALES.length} complete
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleGenerateAll}
          disabled={isGenerating}
          className="bg-[#2d2a26] text-[#f5f3ee] hover:bg-[#3d3a36] dark:bg-[#f5f3ee] dark:text-[#2d2a26] dark:hover:bg-[#e5e3de]"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Languages className="mr-2 h-3 w-3" />
              Generate All Translations
            </>
          )}
        </Button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          <Check className="h-4 w-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Locale Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#f5f3ee] p-1 dark:bg-[#2d2a26]">
        {TRANSLATION_LOCALES.map((locale) => {
          const state = localeStates[locale];
          const status = state.status?.status;
          return (
            <button
              key={locale}
              onClick={() => setSelectedLocale(locale)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all",
                selectedLocale === locale
                  ? "bg-white text-[#2d2a26] shadow-sm dark:bg-[#3d3a36] dark:text-[#f5f3ee]"
                  : "text-[#6b6560] hover:text-[#2d2a26] dark:text-[#a39e98] dark:hover:text-[#f5f3ee]"
              )}
            >
              {locale.toUpperCase()}
              {status && STATUS_ICONS[status]}
              {state.isDirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Side-by-Side Editor */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Original (Spanish) */}
        <div className="space-y-3 rounded-xl border border-[#e5e3de] bg-[#f5f3ee]/50 p-4 dark:border-[#3d3a36] dark:bg-[#2d2a26]/50">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#a39e98]">
              Spanish (Original)
            </h4>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-[#6b6560] dark:text-[#a39e98]">
                Title
              </Label>
              <div className="mt-1 rounded-md bg-white/80 px-3 py-2 text-sm dark:bg-[#252320]/80">
                {original.title || <span className="italic text-[#a39e98]">Empty</span>}
              </div>
            </div>

            <div>
              <Label className="text-xs text-[#6b6560] dark:text-[#a39e98]">
                Subtitle
              </Label>
              <div className="mt-1 rounded-md bg-white/80 px-3 py-2 text-sm dark:bg-[#252320]/80">
                {original.subtitle || <span className="italic text-[#a39e98]">Empty</span>}
              </div>
            </div>

            <div>
              <Label className="text-xs text-[#6b6560] dark:text-[#a39e98]">
                Description
              </Label>
              <div className="mt-1 min-h-[80px] rounded-md bg-white/80 px-3 py-2 text-sm dark:bg-[#252320]/80">
                {original.description || <span className="italic text-[#a39e98]">Empty</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Translation */}
        <div className="space-y-3 rounded-xl border border-[#e5e3de] p-4 dark:border-[#3d3a36]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#a39e98]">
                {LOCALE_NAMES[selectedLocale]}
              </h4>
              {currentState.status && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full py-0.5 text-[10px] font-medium",
                    currentState.status.status === "complete" ? "px-1" : "px-2",
                    STATUS_COLORS[currentState.status.status]
                  )}
                  title={currentState.status.status}
                >
                  {STATUS_ICONS[currentState.status.status]}
                  {currentState.status.status !== "complete" && currentState.status.status}
                </span>
              )}
            </div>
            <button
              onClick={() => handleRegenerateLocale(selectedLocale)}
              disabled={isGenerating}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-[#6b6560] transition-colors hover:bg-[#f5f3ee] dark:text-[#a39e98] dark:hover:bg-[#3d3a36]"
            >
              <RefreshCw className={cn("h-3 w-3", isGenerating && "animate-spin")} />
              Regenerate
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <Label
                htmlFor="trans-title"
                className="text-xs text-[#6b6560] dark:text-[#a39e98]"
              >
                Title
              </Label>
              <Input
                id="trans-title"
                value={currentState.translation.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder={original.title}
                className="mt-1 bg-white dark:bg-[#252320]"
              />
            </div>

            <div>
              <Label
                htmlFor="trans-subtitle"
                className="text-xs text-[#6b6560] dark:text-[#a39e98]"
              >
                Subtitle
              </Label>
              <Input
                id="trans-subtitle"
                value={currentState.translation.subtitle}
                onChange={(e) => updateField("subtitle", e.target.value)}
                placeholder={original.subtitle}
                className="mt-1 bg-white dark:bg-[#252320]"
              />
            </div>

            <div>
              <Label
                htmlFor="trans-description"
                className="text-xs text-[#6b6560] dark:text-[#a39e98]"
              >
                Description
              </Label>
              <textarea
                id="trans-description"
                value={currentState.translation.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder={original.description}
                className="mt-1 min-h-[80px] w-full resize-none rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#252320]"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
