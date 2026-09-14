import { describe, it, expect } from "vitest";
import { collectTranslationKeys, getByPath, computeCoverage } from "./coverage";
import type { Translations } from "./types";

describe("collectTranslationKeys", () => {
  it("collects all leaf keys with dot notation", () => {
    const translations = {
      chat: {
        placeholder: "What would you like to explore?",
        title: "Chat",
      },
      settings: {
        language: "Language",
      },
    } as Translations;

    const keys = collectTranslationKeys(translations);
    expect(keys).toEqual(["chat.placeholder", "chat.title", "settings.language"]);
  });

  it("returns empty array for empty object", () => {
    const keys = collectTranslationKeys({} as Translations);
    expect(keys).toEqual([]);
  });
});

describe("getByPath", () => {
  const translations = {
    chat: {
      placeholder: "What would you like to explore?",
      title: "Chat",
    },
    settings: {
      language: "Language",
    },
  } as Translations;

  it("returns the leaf value for a valid nested path", () => {
    const value = getByPath(translations, "chat.placeholder");
    expect(value).toBe("What would you like to explore?");
  });

  it("returns the nested object for a partial path", () => {
    const value = getByPath(translations, "chat");
    expect(value).toEqual({
      placeholder: "What would you like to explore?",
      title: "Chat",
    });
  });

  it("returns undefined for a non-existent path", () => {
    const value = getByPath(translations, "nonexistent");
    expect(value).toBeUndefined();
  });

  it("returns undefined when accessing beyond a leaf node (line 25 — accessing property on string)", () => {
    // Attempting to access a property on a string value should return undefined
    const value = getByPath(translations, "chat.placeholder.invalid");
    expect(value).toBeUndefined();
  });

  it("returns undefined for deeply nested non-existent paths", () => {
    const value = getByPath(translations, "chat.nonexistent.deeply");
    expect(value).toBeUndefined();
  });
});

describe("computeCoverage", () => {
  it("returns 100 when all keys are translated (different from reference)", () => {
    const reference = {
      chat: { placeholder: "Spanish" },
    } as Translations;
    const target = {
      chat: { placeholder: "English" },
    } as Translations;

    const coverage = computeCoverage(reference, target);
    expect(coverage).toBe(100);
  });

  it("returns 0 when no keys are translated (identical to reference)", () => {
    const reference = {
      chat: { placeholder: "Spanish" },
    } as Translations;
    const target = {
      chat: { placeholder: "Spanish" },
    } as Translations;

    const coverage = computeCoverage(reference, target);
    expect(coverage).toBe(0);
  });

  it("returns 50 when half the keys are translated", () => {
    const reference = {
      chat: { placeholder: "Spanish", title: "Spanish" },
    } as Translations;
    const target = {
      chat: { placeholder: "English", title: "Spanish" },
    } as Translations;

    const coverage = computeCoverage(reference, target);
    expect(coverage).toBe(50);
  });

  it("returns 0 for an empty reference", () => {
    const reference = {} as Translations;
    const target = { chat: { placeholder: "English" } } as Translations;

    const coverage = computeCoverage(reference, target);
    expect(coverage).toBe(0);
  });
});
