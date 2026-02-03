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

const TRANSLATION_LOCALES = ["en", "fr", "de", "pt", "ast"] as const;
type StoryLocale = (typeof TRANSLATION_LOCALES)[number];

interface TranslationStatus {
  status: "pending" | "translating" | "complete" | "failed";
  error?: string;
  updatedAt?: string;
}

interface StoryTranslation {
  title: string;
  subtitle: string;
  description: string;
}

interface StoryMetadata {
  translations?: Partial<Record<StoryLocale, StoryTranslation>>;
  translation_status?: Partial<Record<StoryLocale, TranslationStatus>>;
  last_translated_at?: string;
  [key: string]: unknown;
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
    const translations = metadata.translations || {};
    const existingStatus = metadata.translation_status || {};

    // Check which locales have translations but missing/incorrect status
    const localesNeedingUpdate: StoryLocale[] = [];
    const localesWithTranslations: StoryLocale[] = [];

    for (const locale of TRANSLATION_LOCALES) {
      const translation = translations[locale];
      const status = existingStatus[locale];

      // Check if translation exists and has content
      const hasTranslation = translation && (
        translation.title?.trim() ||
        translation.subtitle?.trim() ||
        translation.description?.trim()
      );

      if (hasTranslation) {
        localesWithTranslations.push(locale);

        // Check if status is missing or not "complete"
        if (!status || status.status !== "complete") {
          localesNeedingUpdate.push(locale);
        }
      }
    }

    if (localesWithTranslations.length === 0) {
      noTranslationsCount++;
      continue;
    }

    if (localesNeedingUpdate.length === 0) {
      alreadyCorrectCount++;
      continue;
    }

    // Update the status for locales that need it
    const newStatus: Partial<Record<StoryLocale, TranslationStatus>> = { ...existingStatus };
    const now = new Date().toISOString();

    for (const locale of localesNeedingUpdate) {
      newStatus[locale] = {
        status: "complete",
        updatedAt: now,
      };
    }

    const updatedMetadata: StoryMetadata = {
      ...metadata,
      translation_status: newStatus,
      last_translated_at: metadata.last_translated_at || now,
    };

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

main().catch(console.error);
