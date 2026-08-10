import { describe, it, expect } from "vitest";
import {
  validateGeneratedStories,
  NON_ASTURIAN_BLOCKLIST,
  type GeneratedStoryWithQuote,
} from "./generate-stories";

describe("NON_ASTURIAN_BLOCKLIST", () => {
  it("contains known non-Asturian border places", () => {
    expect(NON_ASTURIAN_BLOCKLIST).toContain("Ribadeo");
    expect(NON_ASTURIAN_BLOCKLIST).toContain("Santander");
    expect(NON_ASTURIAN_BLOCKLIST).toContain("Fuente Dé");
  });

  it("does not contain Asturian places", () => {
    for (const place of NON_ASTURIAN_BLOCKLIST) {
      expect(["Oviedo", "Gijón", "Avilés", "Llanes", "Cangas de Onís"]).not.toContain(place);
    }
  });
});

describe("validateGeneratedStories", () => {
  const sampleChunks = [
    "La Catedral de San Salvador de Oviedo es una joya del gótico asturiano.",
    "El Museo de Bellas Artes se encuentra en el palacio de Velarde.",
    "Santa María del Naranco, declarada Patrimonio de la Humanidad por la UNESCO.",
    "El Jardín Botánico Atlántico de Gijón es un espacio verde de referencia.",
  ];

  function makeStory(overrides: Partial<GeneratedStoryWithQuote>): GeneratedStoryWithQuote {
    return {
      id: "test-story",
      slug: "test-story",
      title: "Test Story",
      subtitle: "Oviedo",
      description: "A test story.",
      image: "",
      category: "culture",
      sourcePdf: "test.pdf",
      sourceQuote: "La Catedral de San Salvador de Oviedo",
      ...overrides,
    };
  }

  it("accepts a story with a valid sourceQuote found in chunks", () => {
    const stories = [makeStory({
      title: "Catedral de San Salvador",
      sourceQuote: "Catedral de San Salvador de Oviedo",
    })];

    const result = validateGeneratedStories(stories, sampleChunks);
    expect(result.valid).toHaveLength(1);
    expect(result.excluded).toHaveLength(0);
  });

  it("excludes a story whose sourceQuote is not found in any chunk", () => {
    const stories = [makeStory({
      title: "Playa de las Catedrales",
      subtitle: "Ribadeo",
      sourceQuote: "La Playa de las Catedrales en Ribadeo",
    })];

    const result = validateGeneratedStories(stories, sampleChunks);
    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reason).toContain("citation");
  });

  it("excludes a story with a non-Asturian place in the title", () => {
    const stories = [makeStory({
      title: "Playa de las Catedrales",
      subtitle: "Ribadeo",
      sourceQuote: "La Catedral de San Salvador de Oviedo", // valid quote but wrong geography
    })];

    const result = validateGeneratedStories(stories, sampleChunks);
    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reason).toContain("geographic");
  });

  it("excludes a story with a non-Asturian place in the subtitle", () => {
    const stories = [makeStory({
      title: "Beautiful Beach",
      subtitle: "Santander, Cantabria",
      sourceQuote: "La Catedral de San Salvador de Oviedo",
    })];

    const result = validateGeneratedStories(stories, sampleChunks);
    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reason).toContain("geographic");
  });

  it("uses fuzzy matching for sourceQuote (substring match)", () => {
    const stories = [makeStory({
      title: "Santa María del Naranco",
      sourceQuote: "Santa María del Naranco, declarada Patrimonio",
    })];

    const result = validateGeneratedStories(stories, sampleChunks);
    expect(result.valid).toHaveLength(1);
    expect(result.excluded).toHaveLength(0);
  });

  it("uses case-insensitive matching for sourceQuote", () => {
    const stories = [makeStory({
      title: "Jardín Botánico",
      sourceQuote: "jardín botánico atlántico de gijón",
    })];

    const result = validateGeneratedStories(stories, sampleChunks);
    expect(result.valid).toHaveLength(1);
  });

  it("handles multiple stories — keeps valid, excludes invalid", () => {
    const stories = [
      makeStory({
        id: "valid-1",
        title: "Catedral de San Salvador",
        sourceQuote: "Catedral de San Salvador de Oviedo",
      }),
      makeStory({
        id: "invalid-geo",
        title: "Teleférico de Fuente Dé",
        subtitle: "Picos de Europa",
        sourceQuote: "Catedral de San Salvador de Oviedo",
      }),
      makeStory({
        id: "invalid-citation",
        title: "Invented Place",
        sourceQuote: "This text does not exist in any chunk",
      }),
    ];

    const result = validateGeneratedStories(stories, sampleChunks);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].id).toBe("valid-1");
    expect(result.excluded).toHaveLength(2);
  });

  it("returns empty valid array when all stories fail", () => {
    const stories = [makeStory({
      title: "Fake Place in Santander",
      subtitle: "Santander",
      sourceQuote: "nonexistent quote",
    })];

    const result = validateGeneratedStories(stories, sampleChunks);
    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
  });

  it("handles empty stories array", () => {
    const result = validateGeneratedStories([], sampleChunks);
    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(0);
  });

  it("handles empty chunks array", () => {
    const stories = [makeStory({
      sourceQuote: "anything",
    })];

    const result = validateGeneratedStories(stories, []);
    expect(result.valid).toHaveLength(0);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reason).toContain("citation");
  });

  it("reports both citation and geographic failures", () => {
    const stories = [makeStory({
      title: "Beach in Ribadeo",
      subtitle: "Ribadeo",
      sourceQuote: "this quote does not exist",
    })];

    const result = validateGeneratedStories(stories, sampleChunks);
    expect(result.excluded).toHaveLength(1);
    // Should mention both failures
    expect(result.excluded[0].reason).toContain("citation");
    expect(result.excluded[0].reason).toContain("geographic");
  });
});
