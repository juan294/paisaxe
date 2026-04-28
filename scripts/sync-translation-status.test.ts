import { describe, it, expect } from "vitest";
import {
  TRANSLATION_LOCALES,
  localesWithContent,
  localesNeedingStatusUpdate,
  buildUpdatedMetadata,
} from "./sync-translation-status";
import type { StoryMetadata, StoryLocale } from "./sync-translation-status";

// ---------------------------------------------------------------------------
// TRANSLATION_LOCALES constant
// ---------------------------------------------------------------------------
describe("TRANSLATION_LOCALES", () => {
  it("contains exactly the expected locales", () => {
    expect([...TRANSLATION_LOCALES]).toEqual(["en", "fr", "de", "pt", "ast"]);
  });

  it("has 5 locales", () => {
    expect(TRANSLATION_LOCALES.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// localesWithContent
// ---------------------------------------------------------------------------
describe("localesWithContent", () => {
  it("returns empty array when no translations exist", () => {
    const metadata: StoryMetadata = {};
    expect(localesWithContent(metadata)).toEqual([]);
  });

  it("returns empty array when translations object is empty", () => {
    const metadata: StoryMetadata = { translations: {} };
    expect(localesWithContent(metadata)).toEqual([]);
  });

  it("identifies locales that have a title", () => {
    const metadata: StoryMetadata = {
      translations: {
        en: { title: "Lakes of Covadonga", subtitle: "", description: "" },
      },
    };
    expect(localesWithContent(metadata)).toContain("en");
  });

  it("identifies locales that have only a subtitle", () => {
    const metadata: StoryMetadata = {
      translations: {
        fr: { title: "", subtitle: "Picos de Europa", description: "" },
      },
    };
    expect(localesWithContent(metadata)).toContain("fr");
  });

  it("identifies locales that have only a description", () => {
    const metadata: StoryMetadata = {
      translations: {
        de: { title: "", subtitle: "", description: "Wunderschöne Seen." },
      },
    };
    expect(localesWithContent(metadata)).toContain("de");
  });

  it("excludes locales where all fields are empty strings", () => {
    const metadata: StoryMetadata = {
      translations: {
        pt: { title: "", subtitle: "", description: "" },
      },
    };
    expect(localesWithContent(metadata)).not.toContain("pt");
  });

  it("excludes locales where all fields are whitespace-only", () => {
    const metadata: StoryMetadata = {
      translations: {
        ast: { title: "   ", subtitle: "  ", description: "  " },
      },
    };
    expect(localesWithContent(metadata)).not.toContain("ast");
  });

  it("returns all 5 locales when all have content", () => {
    const makeT = () => ({ title: "Title", subtitle: "Sub", description: "Desc" });
    const metadata: StoryMetadata = {
      translations: {
        en: makeT(),
        fr: makeT(),
        de: makeT(),
        pt: makeT(),
        ast: makeT(),
      },
    };
    expect(localesWithContent(metadata)).toHaveLength(5);
  });

  it("only returns locales actually in TRANSLATION_LOCALES", () => {
    // Even if metadata has an unexpected key, result is only from valid locales
    const metadata: StoryMetadata = {
      translations: {
        en: { title: "Hello", subtitle: "", description: "" },
        // 'it' is not a known locale in the list
      } as Partial<Record<StoryLocale, { title: string; subtitle: string; description: string }>>,
    };
    const result = localesWithContent(metadata);
    for (const locale of result) {
      expect(TRANSLATION_LOCALES).toContain(locale);
    }
  });
});

// ---------------------------------------------------------------------------
// localesNeedingStatusUpdate
// ---------------------------------------------------------------------------
describe("localesNeedingStatusUpdate", () => {
  it("returns locales with content but no existing status", () => {
    const metadata: StoryMetadata = {
      translations: { en: { title: "Lakes", subtitle: "", description: "" } },
    };
    expect(localesNeedingStatusUpdate(metadata)).toContain("en");
  });

  it("returns locales with content but status != 'complete'", () => {
    const metadata: StoryMetadata = {
      translations: { en: { title: "Lakes", subtitle: "", description: "" } },
      translation_status: { en: { status: "pending" } },
    };
    expect(localesNeedingStatusUpdate(metadata)).toContain("en");
  });

  it("excludes locales already marked as complete", () => {
    const metadata: StoryMetadata = {
      translations: { en: { title: "Lakes", subtitle: "", description: "" } },
      translation_status: { en: { status: "complete", updatedAt: "2025-01-01T00:00:00Z" } },
    };
    expect(localesNeedingStatusUpdate(metadata)).not.toContain("en");
  });

  it("returns empty array when there are no translations at all", () => {
    const metadata: StoryMetadata = {};
    expect(localesNeedingStatusUpdate(metadata)).toEqual([]);
  });

  it("returns empty array when all translated locales are already complete", () => {
    const metadata: StoryMetadata = {
      translations: {
        en: { title: "Lakes", subtitle: "Covadonga", description: "A beautiful place." },
        fr: { title: "Lacs", subtitle: "Covadonga", description: "Un bel endroit." },
      },
      translation_status: {
        en: { status: "complete" },
        fr: { status: "complete" },
      },
    };
    expect(localesNeedingStatusUpdate(metadata)).toEqual([]);
  });

  it("returns only the out-of-date locales when some are complete and some are not", () => {
    const metadata: StoryMetadata = {
      translations: {
        en: { title: "Lakes", subtitle: "", description: "" },
        fr: { title: "Lacs", subtitle: "", description: "" },
      },
      translation_status: {
        en: { status: "complete" },
        fr: { status: "translating" },
      },
    };
    const result = localesNeedingStatusUpdate(metadata);
    expect(result).not.toContain("en");
    expect(result).toContain("fr");
  });
});

// ---------------------------------------------------------------------------
// buildUpdatedMetadata
// ---------------------------------------------------------------------------
describe("buildUpdatedMetadata", () => {
  const NOW = "2026-04-28T12:00:00.000Z";

  it("marks specified locales as complete with the given timestamp", () => {
    const metadata: StoryMetadata = {
      translations: { en: { title: "Lakes", subtitle: "", description: "" } },
    };
    const result = buildUpdatedMetadata(metadata, ["en"], NOW);
    expect(result.translation_status?.en?.status).toBe("complete");
    expect(result.translation_status?.en?.updatedAt).toBe(NOW);
  });

  it("preserves existing status for locales not in localesToMark", () => {
    const metadata: StoryMetadata = {
      translations: {
        en: { title: "Lakes", subtitle: "", description: "" },
        fr: { title: "Lacs", subtitle: "", description: "" },
      },
      translation_status: {
        fr: { status: "complete", updatedAt: "2025-01-01T00:00:00Z" },
      },
    };
    const result = buildUpdatedMetadata(metadata, ["en"], NOW);
    // fr should remain untouched
    expect(result.translation_status?.fr?.updatedAt).toBe("2025-01-01T00:00:00Z");
  });

  it("sets last_translated_at to now when not already set", () => {
    const metadata: StoryMetadata = {};
    const result = buildUpdatedMetadata(metadata, [], NOW);
    expect(result.last_translated_at).toBe(NOW);
  });

  it("preserves existing last_translated_at when already set", () => {
    const existingDate = "2025-06-01T00:00:00Z";
    const metadata: StoryMetadata = { last_translated_at: existingDate };
    const result = buildUpdatedMetadata(metadata, [], NOW);
    expect(result.last_translated_at).toBe(existingDate);
  });

  it("does not mutate the original metadata", () => {
    const metadata: StoryMetadata = {
      translations: { en: { title: "Lakes", subtitle: "", description: "" } },
    };
    buildUpdatedMetadata(metadata, ["en"], NOW);
    expect(metadata.translation_status).toBeUndefined();
  });

  it("handles multiple locales in one call", () => {
    const metadata: StoryMetadata = {};
    const result = buildUpdatedMetadata(metadata, ["en", "fr", "de"], NOW);
    expect(result.translation_status?.en?.status).toBe("complete");
    expect(result.translation_status?.fr?.status).toBe("complete");
    expect(result.translation_status?.de?.status).toBe("complete");
  });

  it("handles empty localesToMark gracefully", () => {
    const metadata: StoryMetadata = {
      translation_status: { en: { status: "complete" } },
    };
    const result = buildUpdatedMetadata(metadata, [], NOW);
    // Existing status preserved, nothing added
    expect(result.translation_status?.en?.status).toBe("complete");
    expect(Object.keys(result.translation_status ?? {})).toHaveLength(1);
  });

  it("preserves other metadata fields unchanged", () => {
    const metadata: StoryMetadata = {
      custom_field: "preserved value",
      translations: { en: { title: "Lakes", subtitle: "", description: "" } },
    };
    const result = buildUpdatedMetadata(metadata, ["en"], NOW);
    expect(result.custom_field).toBe("preserved value");
  });
});
