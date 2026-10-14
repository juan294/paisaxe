"use client";

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
import { TRANSLATION_LOCALES, LOCALE_NAMES } from "@/lib/translation-locales";
import type { TranslationStatus } from "@/types/immersive";
import { cn } from "@/lib/utils";

import { useStoryTranslations, type StoryTranslationsTabProps } from "./story-translations-tab/use-story-translations";

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
  const {
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
  } = useStoryTranslations({ story, onTranslationChange, onMetadataUpdated });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-admin-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between rounded-lg bg-admin-paper px-4 py-3 dark:bg-admin-ink">
        <div className="flex items-center gap-2 text-sm text-admin-muted dark:text-admin-subtle">
          <Languages className="h-4 w-4" />
          <span>
            {completeCount}/{TRANSLATION_LOCALES.length} complete
          </span>
        </div>
        <Button
          size="sm"
          onClick={handleGenerateAll}
          disabled={isGenerating}
          className="bg-admin-ink text-admin-paper hover:bg-admin-depth dark:bg-admin-paper dark:text-admin-ink dark:hover:bg-admin-line"
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
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-admin-paper p-1 dark:bg-admin-ink">
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
                  ? "bg-white text-admin-ink shadow-sm dark:bg-admin-depth dark:text-admin-paper"
                  : "text-admin-muted hover:text-admin-ink dark:text-admin-subtle dark:hover:text-admin-paper"
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
        <div className="space-y-3 rounded-xl border border-admin-line bg-admin-paper/50 p-4 dark:border-admin-depth dark:bg-admin-ink/50">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-admin-muted dark:text-admin-subtle">
              Spanish (Original)
            </h4>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-admin-muted dark:text-admin-subtle">
                Title
              </Label>
              <div className="mt-1 rounded-md bg-white/80 px-3 py-2 text-sm dark:bg-admin-panel/80">
                {original.title || <span className="italic text-admin-subtle">Empty</span>}
              </div>
            </div>

            <div>
              <Label className="text-xs text-admin-muted dark:text-admin-subtle">
                Subtitle
              </Label>
              <div className="mt-1 rounded-md bg-white/80 px-3 py-2 text-sm dark:bg-admin-panel/80">
                {original.subtitle || <span className="italic text-admin-subtle">Empty</span>}
              </div>
            </div>

            <div>
              <Label className="text-xs text-admin-muted dark:text-admin-subtle">
                Description
              </Label>
              <div className="mt-1 min-h-[80px] rounded-md bg-white/80 px-3 py-2 text-sm dark:bg-admin-panel/80">
                {original.description || <span className="italic text-admin-subtle">Empty</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Translation */}
        <div className="space-y-3 rounded-xl border border-admin-line p-4 dark:border-admin-depth">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-admin-muted dark:text-admin-subtle">
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
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-admin-muted transition-colors hover:bg-admin-paper dark:text-admin-subtle dark:hover:bg-admin-depth"
            >
              <RefreshCw className={cn("h-3 w-3", isGenerating && "animate-spin")} />
              Regenerate
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <Label
                htmlFor="trans-title"
                className="text-xs text-admin-muted dark:text-admin-subtle"
              >
                Title
              </Label>
              <Input
                id="trans-title"
                value={currentState.translation.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder={original.title}
                className="mt-1 bg-white dark:bg-admin-panel"
              />
            </div>

            <div>
              <Label
                htmlFor="trans-subtitle"
                className="text-xs text-admin-muted dark:text-admin-subtle"
              >
                Subtitle
              </Label>
              <Input
                id="trans-subtitle"
                value={currentState.translation.subtitle}
                onChange={(e) => updateField("subtitle", e.target.value)}
                placeholder={original.subtitle}
                className="mt-1 bg-white dark:bg-admin-panel"
              />
            </div>

            <div>
              <Label
                htmlFor="trans-description"
                className="text-xs text-admin-muted dark:text-admin-subtle"
              >
                Description
              </Label>
              <textarea
                id="trans-description"
                value={currentState.translation.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder={original.description}
                className="mt-1 min-h-[80px] w-full resize-none rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-admin-panel"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
