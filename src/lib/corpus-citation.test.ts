import { describe, expect, it } from "vitest";
import { isAuthoredCitation } from "./corpus-citation";

const citation = {
  title: "Synthetic factual source",
  url: "https://source.example.test/facts",
  license: "CC0-1.0",
  revision: "2026-10-11",
  attribution: "Example source owner",
};

describe("authored citation boundary", () => {
  it("accepts explicit factual-source evidence", () => {
    expect(isAuthoredCitation(citation)).toBe(true);
  });

  it("uses the real context and source formatters without inventing a PDF or page", async () => {
    const { buildContextText, extractSourcesFromChunks } = await import("./claude");
    const chunks = [{ id: "authored-fact", content: "An independently authored synthetic fact", citation }];
    const context = buildContextText(chunks);
    expect(context).toContain(citation.title);
    expect(context).toContain(citation.url);
    expect(context).toContain(citation.license);
    expect(context).not.toContain("undefined");
    expect(context).not.toContain("pag.");
    const sources = extractSourcesFromChunks(chunks);
    expect(sources).toHaveLength(1);
    expect(sources[0]?.citation).toEqual(citation);
    expect(sources[0]?.sourcePdf).toBeUndefined();
    expect(sources[0]?.pageNumber).toBeUndefined();
    expect(sources[0]?.title).toBe(citation.title);
  });

  it.each(["title", "url", "license", "revision", "attribution"])("rejects missing or malformed %s", field => {
    for (const value of [undefined, null, "", " \t ", 4]) {
      expect(isAuthoredCitation({ ...citation, [field]: value })).toBe(false);
    }
  });

  it("rejects non-record and unsafe-source citations", () => {
    for (const value of [undefined, null, [], "PDF", 1]) expect(isAuthoredCitation(value)).toBe(false);
    for (const url of ["/source", "//source.example.test", "http://source.example.test", "javascript:alert(1)", "data:text/plain,source", "https://name:secret@source.example.test/facts"]) {
      expect(isAuthoredCitation({ ...citation, url })).toBe(false);
    }
  });
});
