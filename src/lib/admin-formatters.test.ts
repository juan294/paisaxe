import { describe, it, expect } from "vitest";
import {
  hasMissingTranslations,
  TRANSLATION_LOCALES,
} from "./admin-formatters";
import type { AdminStory } from "@/types/admin";
import type { StoryMetadata } from "@/types/immersive";

const baseStory: AdminStory = {
  id: "s1",
  slug: "test-story",
  title: "Test Story",
  subtitle: "Subtitle",
  description: "Desc",
  image: "",
  category: "nature",
  displayOrder: 1,
  curationStatus: "approved",
  createdAt: "2024-01-01",
  updatedAt: "2024-01-01",
};

const completeTranslation = {
  title: "Translated Title",
  subtitle: "Translated Subtitle",
  description: "Translated Description",
};

const completeStatus = { status: "complete" as const };

describe("TRANSLATION_LOCALES", () => {
  it("includes all 5 required locales", () => {
    expect(TRANSLATION_LOCALES).toEqual(
      expect.arrayContaining(["en", "fr", "de", "pt", "ast"])
    );
    expect(TRANSLATION_LOCALES).toHaveLength(5);
  });
});

describe("hasMissingTranslations", () => {
  it("returns true when metadata is undefined", () => {
    expect(hasMissingTranslations(baseStory)).toBe(true);
  });

  it("returns true when metadata exists but translations are empty", () => {
    const story: AdminStory = {
      ...baseStory,
      metadata: { translations: {}, translation_status: {} },
    };
    expect(hasMissingTranslations(story)).toBe(true);
  });

  it("returns false when all locales are complete", () => {
    const translations: Record<string, typeof completeTranslation> = {};
    const translation_status: Record<string, typeof completeStatus> = {};
    for (const locale of TRANSLATION_LOCALES) {
      translations[locale] = completeTranslation;
      translation_status[locale] = completeStatus;
    }
    const story: AdminStory = {
      ...baseStory,
      metadata: { translations, translation_status },
    };
    expect(hasMissingTranslations(story)).toBe(false);
  });

  it("returns true when one locale has status !== complete", () => {
    const translations: Record<string, typeof completeTranslation> = {};
    const translation_status: Record<string, { status: string }> = {};
    for (const locale of TRANSLATION_LOCALES) {
      translations[locale] = completeTranslation;
      translation_status[locale] = locale === "de" ? { status: "pending" } : completeStatus;
    }
    const story: AdminStory = {
      ...baseStory,
      metadata: { translations, translation_status },
    };
    expect(hasMissingTranslations(story)).toBe(true);
  });

  it("returns true when one locale has no content", () => {
    const translations: Record<string, typeof completeTranslation | object> = {};
    const translation_status: Record<string, typeof completeStatus> = {};
    for (const locale of TRANSLATION_LOCALES) {
      translations[locale] = locale === "ast" ? {} : completeTranslation;
      translation_status[locale] = completeStatus;
    }
    const story: AdminStory = {
      ...baseStory,
      metadata: { translations, translation_status },
    };
    expect(hasMissingTranslations(story)).toBe(true);
  });

  it("returns true when metadata has no translations field at all", () => {
    // Exercises the `metadata.translations || {}` fallback branch
    const story: AdminStory = {
      ...baseStory,
      metadata: { translation_status: {} } as StoryMetadata,
    };
    expect(hasMissingTranslations(story)).toBe(true);
  });

  it("returns true when metadata has no translation_status field at all", () => {
    // Exercises the `metadata.translation_status || {}` fallback branch
    const translations: Record<string, typeof completeTranslation> = {};
    for (const locale of TRANSLATION_LOCALES) {
      translations[locale] = completeTranslation;
    }
    const story: AdminStory = {
      ...baseStory,
      metadata: { translations } as StoryMetadata,
    };
    expect(hasMissingTranslations(story)).toBe(true);
  });
});
