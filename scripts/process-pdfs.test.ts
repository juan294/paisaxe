import { describe, it, expect } from "vitest";
import { isSectionHeader, chunkText } from "./process-pdfs";
import type { ExtractedChunk } from "./process-pdfs";

// ---------------------------------------------------------------------------
// isSectionHeader
// ---------------------------------------------------------------------------
describe("isSectionHeader", () => {
  it("returns true for an all-caps line under 100 chars", () => {
    expect(isSectionHeader("INTRODUCTION")).toBe(true);
    expect(isSectionHeader("PARQUES NATURALES DE ASTURIAS")).toBe(true);
  });

  it("returns true for a title-case Spanish line (letters + spaces + commas)", () => {
    expect(isSectionHeader("Cultura y Tradición")).toBe(true);
    expect(isSectionHeader("Gastronomía Asturiana")).toBe(true);
  });

  it("returns false for a regular sentence with mixed case", () => {
    expect(isSectionHeader("This is a normal sentence with mixed case and punctuation.")).toBe(false);
    expect(isSectionHeader("El río Sella tiene 80 km de recorrido.")).toBe(false);
  });

  it("returns false for text >= 100 characters even if all-caps", () => {
    const longCaps = "A".repeat(100);
    expect(isSectionHeader(longCaps)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isSectionHeader("")).toBe(false);
  });

  it("returns false for lines with digits mixed in (not pure title case)", () => {
    expect(isSectionHeader("Capítulo 3: Datos")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chunkText
// ---------------------------------------------------------------------------
describe("chunkText", () => {
  const FILENAME = "guide.pdf";

  it("returns an empty array for empty text", () => {
    expect(chunkText("", FILENAME)).toEqual([]);
  });

  it("returns an empty array when all sections are too short (< 50 chars of content)", () => {
    const text = "Hi\n\nBye";
    expect(chunkText(text, FILENAME)).toEqual([]);
  });

  it("creates a single chunk from plain body text", () => {
    const body = "Los Lagos de Covadonga son dos lagos de origen glaciar en los Picos de Europa. Forman parte del Parque Nacional de los Picos de Europa y son un destino turístico muy popular.";
    const chunks = chunkText(body, FILENAME);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sourcePdf).toBe(FILENAME);
    expect(chunks[0].content).toContain("Lagos de Covadonga");
  });

  it("assigns sectionTitle when a header precedes body text", () => {
    const text = [
      "NATURALEZA",
      "",
      "Los Lagos de Covadonga son dos lagos de origen glaciar en los Picos de Europa. Forman parte del Parque Nacional de los Picos de Europa.",
    ].join("\n");

    const chunks = chunkText(text, FILENAME);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].sectionTitle).toBe("NATURALEZA");
  });

  it("creates multiple chunks when content accumulates across sections to exceed maxChunkLength", () => {
    // Each paragraph section is ~80 chars; maxChunkLength = 100.
    // After 2 sections the accumulated content will exceed 100, triggering a flush.
    // With 6 sections we expect at least 2 flushes (chunks).
    const paragraph = "Esta es una oración de prueba con más de cincuenta chars.";
    // Join with double newlines so split produces multiple sections
    const sections = Array.from({ length: 6 }, () => paragraph);
    const text = sections.join("\n\n");
    const chunks = chunkText(text, FILENAME, 100);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("respects custom maxChunkLength", () => {
    // With a tiny maxChunkLength each paragraph becomes its own chunk
    const paragraph = "Esta es una oración larga que contiene más de cincuenta caracteres para que no sea filtrada como demasiado corta.";
    const text = paragraph + "\n\n" + paragraph + "\n\n" + paragraph;
    // maxChunkLength = 120 chars — each paragraph (> 120) will flush
    const chunksSmall = chunkText(text, FILENAME, 120);
    const chunksLarge = chunkText(text, FILENAME, 10000);
    expect(chunksSmall.length).toBeGreaterThan(chunksLarge.length);
  });

  it("increments pageNumber when form-feed character is present inline", () => {
    // The form-feed must appear within a non-empty section (not alone on a line),
    // because empty/whitespace-only sections are skipped by the parser.
    const text = [
      "Página uno con suficiente texto para superar los cincuenta caracteres necesarios.\fPágina dos.",
      "",
      "Continuación en página dos con suficiente texto para superar los cincuenta caracteres.",
    ].join("\n");

    const chunks = chunkText(text, FILENAME);
    const pages = chunks.map((c: ExtractedChunk) => c.pageNumber);
    // At least one chunk should be on page 2
    expect(Math.max(...pages)).toBeGreaterThanOrEqual(2);
  });

  it("increments pageNumber when the word 'Guía' appears in a section", () => {
    const text = [
      "Primera sección con suficiente texto para superar los cincuenta caracteres necesarios.",
      "",
      "Guía Turística de Asturias",
      "",
      "Segunda sección con suficiente texto para superar los cincuenta caracteres necesarios.",
    ].join("\n");

    const chunks = chunkText(text, FILENAME);
    const pages = chunks.map((c: ExtractedChunk) => c.pageNumber);
    expect(Math.max(...pages)).toBeGreaterThanOrEqual(2);
  });

  it("filters out content blocks shorter than 50 chars", () => {
    const text = "Short.\n\nAlso short.\n\nEste párrafo es lo suficientemente largo como para superar el umbral mínimo de cincuenta caracteres.";
    const chunks = chunkText(text, FILENAME);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("suficientemente largo");
  });

  it("does not include the header text in the chunk content", () => {
    const text = [
      "GASTRONOMÍA",
      "",
      "La fabada asturiana es uno de los platos más emblemáticos de la gastronomía asturiana, muy apreciado por los visitantes.",
    ].join("\n");

    const chunks = chunkText(text, FILENAME);
    expect(chunks[0].content).not.toContain("GASTRONOMÍA");
    expect(chunks[0].sectionTitle).toBe("GASTRONOMÍA");
  });

  it("flushes remaining content at end of text even without trailing newlines", () => {
    const text = "SECCIÓN\n\nContenido con suficientes caracteres para pasar el filtro de cincuenta caracteres mínimos necesarios.";
    const chunks = chunkText(text, FILENAME);
    expect(chunks).toHaveLength(1);
  });
});
