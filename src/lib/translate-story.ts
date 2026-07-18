/**
 * Story translation service using Claude API.
 *
 * Generates translations for story content (title, subtitle, description)
 * into 5 supported locales: en, fr, de, pt, ast.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { StoryLocale, StoryTranslation, TranslationStatus, StoryMetadata } from "@/types/immersive";
import { CHAT_MODEL } from "./models";
import { callAnthropicAPI } from "./claude";
import { createAdminClient } from "./supabase-admin";
import { LOCALE_NAMES, TRANSLATION_LOCALES } from "./translation-locales";

export { LOCALE_NAMES, TRANSLATION_LOCALES };

interface TranslationOptions {
  /** Specific locales to translate. If omitted, translates all 5 locales */
  locales?: StoryLocale[];
  /** Force retranslation even if translation already exists */
  forceRetranslate?: boolean;
}

interface TranslationResult {
  success: boolean;
  error?: string;
  results?: Record<StoryLocale, { success: boolean; error?: string }>;
  successCount?: number;
  failedCount?: number;
}

interface ParseResult {
  success: boolean;
  translations?: Partial<Record<StoryLocale, StoryTranslation>>;
  error?: string;
}

interface StoryContent {
  title: string;
  subtitle: string;
  description: string;
}

interface TranslationMetadataPatch {
  translations?: Partial<Record<StoryLocale, StoryTranslation>>;
  translationStatus?: Partial<Record<StoryLocale, TranslationStatus>>;
  lastTranslatedAt?: string;
}

async function patchStoryTranslationMetadata(
  supabase: ReturnType<typeof createAdminClient>,
  storyId: string,
  patch: TranslationMetadataPatch
) {
  return supabase.rpc("patch_story_translation_metadata", {
    p_story_id: storyId,
    p_translations: patch.translations || {},
    p_translation_status: patch.translationStatus,
    p_last_translated_at: patch.lastTranslatedAt || null,
    p_set_last_translated_at: patch.lastTranslatedAt !== undefined,
  });
}

/**
 * Build the translation prompt for Claude.
 */
export function buildTranslationPrompt(
  story: StoryContent,
  locales: StoryLocale[] = TRANSLATION_LOCALES
): string {
  const localeList = locales.map(l => `"${l}"`).join(", ");

  return `You are a professional translator specializing in tourism content. Translate the following Spanish tourism content into the requested languages while maintaining the engaging, evocative tone appropriate for travel marketing.

SPANISH ORIGINAL:
Title: ${story.title}
Subtitle: ${story.subtitle || "(empty)"}
Description: ${story.description || "(empty)"}

TARGET LANGUAGES: ${localeList}

Language codes:
- en: English (British/International)
- fr: French
- de: German
- pt: Portuguese (European)
- ast: Asturian (Asturianu) - the regional language of Asturias, Spain

IMPORTANT GUIDELINES:
1. Maintain the poetic, evocative tourism style
2. Keep proper nouns (place names like "Covadonga", "Picos de Europa") in their original form
3. For Asturian (ast), use authentic Asturianu vocabulary and grammar, not just Spanish with minor changes
4. If the original is empty, leave the translation empty as well
5. Preserve any formatting or punctuation style

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  ${locales.map(locale => `"${locale}": {
    "title": "translated title",
    "subtitle": "translated subtitle",
    "description": "translated description"
  }`).join(",\n  ")}
}`;
}

/**
 * Parse Claude's translation response.
 */
export function parseTranslationResponse(responseText: string): ParseResult {
  try {
    // Remove markdown code blocks if present
    let jsonText = responseText.trim();
    if (jsonText.startsWith("```")) {
      const lines = jsonText.split("\n");
      // Remove first line (```json) and last line (```)
      lines.shift();
      if (lines[lines.length - 1]?.trim() === "```") {
        lines.pop();
      }
      jsonText = lines.join("\n").trim();
    }

    const parsed = JSON.parse(jsonText);

    // Validate structure
    const translations: Partial<Record<StoryLocale, StoryTranslation>> = {};

    for (const locale of TRANSLATION_LOCALES) {
      if (parsed[locale]) {
        const t = parsed[locale];
        translations[locale] = {
          title: String(t.title || ""),
          subtitle: String(t.subtitle || ""),
          description: String(t.description || ""),
        };
      }
    }

    return { success: true, translations };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse translation response: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Translate a story into multiple languages using Claude.
 */
export async function translateStory(
  storyId: string,
  options: TranslationOptions = {}
): Promise<TranslationResult> {
  const { locales = TRANSLATION_LOCALES, forceRetranslate = false } = options;

  const supabase = createAdminClient();

  // Fetch the story
  const { data: story, error: fetchError } = await supabase
    .from("stories")
    .select("id, title, subtitle, description, metadata")
    .eq("id", storyId)
    .single();

  if (fetchError || !story) {
    return {
      success: false,
      error: `Story not found: ${fetchError?.message || "No data returned"}`,
    };
  }

  const metadata = (story.metadata || {}) as StoryMetadata;
  const existingTranslations = metadata.translations || {};
  const existingStatus = metadata.translation_status || {};

  // Determine which locales need translation
  const localesToTranslate: StoryLocale[] = [];
  const results: Record<StoryLocale, { success: boolean; error?: string }> = {} as Record<
    StoryLocale,
    { success: boolean; error?: string }
  >;

  for (const locale of locales) {
    const hasExisting = existingTranslations[locale] && existingStatus[locale]?.status === "complete";

    if (hasExisting && !forceRetranslate) {
      // Skip - already translated
      results[locale] = { success: true };
    } else {
      localesToTranslate.push(locale);
    }
  }

  // If nothing to translate, return early
  if (localesToTranslate.length === 0) {
    return {
      success: true,
      results,
      successCount: locales.length,
      failedCount: 0,
    };
  }

  // Mark locales as translating.
  const translatingStatus: Partial<Record<StoryLocale, TranslationStatus>> = {};
  for (const locale of localesToTranslate) {
    translatingStatus[locale] = {
      status: "translating",
      updatedAt: new Date().toISOString(),
    };
  }

  await patchStoryTranslationMetadata(supabase, storyId, {
    translationStatus: translatingStatus,
  });

  // Call Claude API
  try {
    const prompt = buildTranslationPrompt(
      {
        title: story.title,
        subtitle: story.subtitle || "",
        description: story.description || "",
      },
      localesToTranslate
    );

    const response = await callAnthropicAPI(
      "You are a professional translator. Return only valid JSON, no other text.",
      [{ role: "user", content: prompt }],
      CHAT_MODEL,
      2048
    );

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    if (!textBlock?.text) {
      throw new Error("No text response from Claude");
    }

    const parseResult = parseTranslationResponse(textBlock.text);

    if (!parseResult.success || !parseResult.translations) {
      throw new Error(parseResult.error || "Failed to parse translations");
    }

    const completedTranslations: Partial<Record<StoryLocale, StoryTranslation>> = {};
    const completedStatus: Partial<Record<StoryLocale, TranslationStatus>> = {};
    let successCount = 0;
    let failedCount = 0;

    for (const locale of localesToTranslate) {
      if (parseResult.translations[locale]) {
        completedTranslations[locale] = parseResult.translations[locale];
        completedStatus[locale] = {
          status: "complete",
          updatedAt: new Date().toISOString(),
        };
        results[locale] = { success: true };
        successCount++;
      } else {
        completedStatus[locale] = {
          status: "failed",
          error: "Translation not returned by API",
          updatedAt: new Date().toISOString(),
        };
        results[locale] = { success: false, error: "Translation not returned by API" };
        failedCount++;
      }
    }

    // Count pre-existing successful translations
    for (const locale of locales) {
      if (!localesToTranslate.includes(locale)) {
        successCount++;
      }
    }

    const { error: updateError } = await patchStoryTranslationMetadata(supabase, storyId, {
      translations: completedTranslations,
      translationStatus: completedStatus,
      lastTranslatedAt: new Date().toISOString(),
    });

    if (updateError) {
      return {
        success: false,
        error: `Failed to save translations: ${updateError.message}`,
        results,
        successCount,
        failedCount,
      };
    }

    return {
      success: failedCount === 0,
      results,
      successCount,
      failedCount,
    };
  } catch (error) {
    // Mark all pending locales as failed
    const failedStatus: Partial<Record<StoryLocale, TranslationStatus>> = {};
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    for (const locale of localesToTranslate) {
      failedStatus[locale] = {
        status: "failed",
        error: errorMessage,
        updatedAt: new Date().toISOString(),
      };
      results[locale] = { success: false, error: errorMessage };
    }

    await patchStoryTranslationMetadata(supabase, storyId, {
      translationStatus: failedStatus,
    });

    return {
      success: false,
      error: errorMessage,
      results,
      successCount: locales.length - localesToTranslate.length,
      failedCount: localesToTranslate.length,
    };
  }
}

/**
 * Update a single translation for a story (admin edit).
 */
export async function updateStoryTranslation(
  storyId: string,
  locale: StoryLocale,
  translation: StoryTranslation
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // Fetch current metadata
  const { data: story, error: fetchError } = await supabase
    .from("stories")
    .select("metadata")
    .eq("id", storyId)
    .single();

  if (fetchError || !story) {
    return {
      success: false,
      error: `Story not found: ${fetchError?.message || "No data returned"}`,
    };
  }

  const status: TranslationStatus = {
    status: "complete",
    updatedAt: new Date().toISOString(),
  };

  const { error: updateError } = await patchStoryTranslationMetadata(supabase, storyId, {
    translations: { [locale]: translation },
    translationStatus: { [locale]: status },
  });

  if (updateError) {
    return {
      success: false,
      error: `Failed to update translation: ${updateError.message}`,
    };
  }

  return { success: true };
}

/**
 * Get translations for a story.
 */
export async function getStoryTranslations(storyId: string): Promise<{
  success: boolean;
  data?: {
    original: StoryContent;
    translations: Partial<Record<StoryLocale, StoryTranslation>>;
    status: Partial<Record<StoryLocale, TranslationStatus>>;
    lastTranslatedAt?: string;
  };
  error?: string;
}> {
  const supabase = createAdminClient();

  const { data: story, error: fetchError } = await supabase
    .from("stories")
    .select("title, subtitle, description, metadata")
    .eq("id", storyId)
    .single();

  if (fetchError || !story) {
    return {
      success: false,
      error: `Story not found: ${fetchError?.message || "No data returned"}`,
    };
  }

  const metadata = (story.metadata || {}) as StoryMetadata;

  return {
    success: true,
    data: {
      original: {
        title: story.title,
        subtitle: story.subtitle || "",
        description: story.description || "",
      },
      translations: metadata.translations || {},
      status: metadata.translation_status || {},
      lastTranslatedAt: metadata.last_translated_at,
    },
  };
}
