/**
 * Sync translation status for stories that already have translations.
 *
 * This script finds stories where `metadata.translations` has data
 * but `metadata.translation_status` is missing or incomplete,
 * and marks those translations as "complete".
 *
 * Usage: npx tsx scripts/sync-translation-status.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

export const TRANSLATION_LOCALES = ["en", "fr", "de", "pt", "ast"] as const;
export type StoryLocale = (typeof TRANSLATION_LOCALES)[number];

export interface TranslationStatus {
  status: "pending" | "translating" | "complete" | "failed";
  error?: string;
  updatedAt?: string;
}

export interface StoryTranslation {
  title: string;
  subtitle: string;
  description: string;
}

export interface StoryMetadata {
  translations?: Partial<Record<StoryLocale, StoryTranslation>>;
  translation_status?: Partial<Record<StoryLocale, TranslationStatus>>;
  last_translated_at?: string;
  [key: string]: unknown;
}

/**
 * Determine which locales have translation content (any non-empty field).
 * Pure function — no I/O.
 */
export function localesWithContent(metadata: StoryMetadata): StoryLocale[] {
  const translations = metadata.translations ?? {};
  return TRANSLATION_LOCALES.filter((locale) => {
    const t = translations[locale];
    return t && (t.title?.trim() || t.subtitle?.trim() || t.description?.trim());
  });
}

/**
 * Determine which locales have content but missing or non-"complete" status.
 * Pure function — no I/O.
 */
export function localesNeedingStatusUpdate(metadata: StoryMetadata): StoryLocale[] {
  const existingStatus = metadata.translation_status ?? {};
  return localesWithContent(metadata).filter((locale) => {
    const status = existingStatus[locale];
    return !status || status.status !== "complete";
  });
}

/**
 * Build the updated metadata object with translation_status set to "complete"
 * for the given locales. Does not mutate input.
 * Pure function — no I/O.
 */
export function buildUpdatedMetadata(
  metadata: StoryMetadata,
  localesToMark: StoryLocale[],
  now: string,
): StoryMetadata {
  const newStatus: Partial<Record<StoryLocale, TranslationStatus>> = {
    ...(metadata.translation_status ?? {}),
  };
  for (const locale of localesToMark) {
    newStatus[locale] = { status: "complete", updatedAt: now };
  }
  return {
    ...metadata,
    translation_status: newStatus,
    last_translated_at: metadata.last_translated_at ?? now,
  };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log("Fetching all stories...\n");

  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, title, metadata")
    .order("title");

  if (error) {
    console.error("Error fetching stories:", error.message);
    process.exit(1);
  }

  if (!stories || stories.length === 0) {
    console.log("No stories found.");
    return;
  }

  console.log(`Found ${stories.length} stories. Checking translation status...\n`);

  let updatedCount = 0;
  let alreadyCorrectCount = 0;
  let noTranslationsCount = 0;

  for (const story of stories) {
    const metadata = (story.metadata || {}) as StoryMetadata;

    const localesWithTranslations = localesWithContent(metadata);
    const localesNeedingUpdate = localesNeedingStatusUpdate(metadata);

    if (localesWithTranslations.length === 0) {
      noTranslationsCount++;
      continue;
    }

    if (localesNeedingUpdate.length === 0) {
      alreadyCorrectCount++;
      continue;
    }

    const now = new Date().toISOString();
    const updatedMetadata = buildUpdatedMetadata(metadata, localesNeedingUpdate, now);

    const { error: updateError } = await supabase
      .from("stories")
      .update({ metadata: updatedMetadata })
      .eq("id", story.id);

    if (updateError) {
      console.error(`  Error updating "${story.title}": ${updateError.message}`);
    } else {
      console.log(`✓ Updated "${story.title}": marked ${localesNeedingUpdate.join(", ")} as complete (${localesWithTranslations.length}/5 total)`);
      updatedCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  Stories updated:        ${updatedCount}`);
  console.log(`  Already correct:        ${alreadyCorrectCount}`);
  console.log(`  No translations yet:    ${noTranslationsCount}`);
  console.log(`  Total stories:          ${stories.length}`);
  console.log("=".repeat(60));
}

// Only run when invoked directly, not when imported by tests
const isDirectExecution =
  process.argv[1]?.endsWith("sync-translation-status.ts") ||
  process.argv[1]?.endsWith("sync-translation-status.js");

if (isDirectExecution) {
  main().catch(console.error);
}
