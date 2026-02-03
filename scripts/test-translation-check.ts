import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

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
  [key: string]: unknown;
}

// This is the EXACT function from story-card.tsx
function hasMissingTranslations(metadata: StoryMetadata | undefined): boolean {
  if (!metadata) return true;

  const translations = metadata.translations || {};
  const status = metadata.translation_status || {};

  for (const locale of TRANSLATION_LOCALES) {
    const translation = translations[locale];
    const localeStatus = status[locale] as TranslationStatus | undefined;

    // Missing if no translation content or status is not complete
    const hasContent = translation && (
      translation.title?.trim() ||
      translation.subtitle?.trim() ||
      translation.description?.trim()
    );

    if (!hasContent || localeStatus?.status !== "complete") {
      return true;
    }
  }

  return false;
}

async function main() {
  const { data: stories } = await supabase
    .from("stories")
    .select("id, title, metadata")
    .eq("curation_status", "approved")
    .order("title")
    .limit(10);

  console.log("Testing hasMissingTranslations function with real data:\n");

  for (const story of stories || []) {
    const metadata = story.metadata as StoryMetadata | undefined;
    const result = hasMissingTranslations(metadata);

    // Also count manually
    let completeCount = 0;
    const translations = metadata?.translations || {};
    const status = metadata?.translation_status || {};

    for (const locale of TRANSLATION_LOCALES) {
      const t = translations[locale];
      const s = status[locale] as TranslationStatus | undefined;
      const hasContent = t && (t.title?.trim() || t.subtitle?.trim() || t.description?.trim());
      if (hasContent && s?.status === "complete") {
        completeCount++;
      }
    }

    const expected = completeCount < 5;
    const match = result === expected;

    console.log(`${match ? "✓" : "✗"} "${story.title}": ${completeCount}/5 complete, hasMissingTranslations=${result}, expected=${expected}`);

    if (!match) {
      console.log("  Debug: metadata keys:", Object.keys(metadata || {}));
      console.log("  Debug: translation_status:", JSON.stringify(metadata?.translation_status));
    }
  }
}

main();
