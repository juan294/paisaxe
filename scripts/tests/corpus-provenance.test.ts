import { describe, expect, it } from "vitest";
import { contentHash, scanOverlap, validateVector, assessQuality } from "../lib/corpus-provenance";

describe("authored corpus provenance", () => {
  it("binds approval identity to content rather than property insertion order", () => {
    expect(contentHash({ a: 1, b: [2, 3] })).toBe(contentHash({ b: [2, 3], a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
  it("rejects transformed copied sentences and matches spanning chunk boundaries without returning text", () => {
    const reference = ["The invented purple observatory overlooks seven quiet valleys beyond the fictional river."];
    const result = scanOverlap(["THE invented purple observatory,", "overlooks seven quiet valleys beyond the fictional river!"], reference);
    expect(result.sentences).toHaveLength(1);
    expect(result.unreviewedWindows.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain("observatory");
  });
  it("normalizes Unicode accents and requires narrow reviewed fingerprints", () => {
    const candidate = ["Árbol azul uno dos tres cuatro cinco seis nueve diez."];
    const reference = ["arbol azul uno dos tres cuatro cinco seis siete ocho."];
    const initial = scanOverlap(candidate, reference);
    expect(initial.sentences).toHaveLength(0);
    expect(initial.unreviewedWindows).toHaveLength(1);
    expect(scanOverlap(candidate, reference, initial.unreviewedWindows.map(fingerprint => ({ fingerprint, reviewer: "owner", reason: "invented fixture only" }))).unreviewedWindows).toHaveLength(0);
    expect(scanOverlap(["Completely independent words describe another invented place."], reference).unreviewedWindows).toHaveLength(0);
  });
  it("rejects wrong dimensions, nonfinite and zero vectors", () => {
    expect(() => validateVector(Array(512).fill(0))).toThrow();
    expect(() => validateVector([1])).toThrow();
    expect(() => validateVector([Infinity, ...Array(511).fill(0)])).toThrow();
    expect(() => validateVector([1, ...Array(511).fill(0)])).not.toThrow();
  });
  it("does not discard copied short safety sentences or abbreviations", () => {
    expect(scanOverlap(["Swimming here is dangerous!"], ["Swimming here is dangerous."]).sentences).toHaveLength(1);
    expect(scanOverlap(["Meet Dr Vega beside St Paul today!"], ["Meet Dr. Vega beside St. Paul today."]).sentences).toHaveLength(1);
    expect(scanOverlap(["The quiet path follows the river toward town."], ["The quiet path follows the ri\u00adver toward town."]).sentences).toHaveLength(1);
  });
  it("blocks missing queries, unsupported claims, source mistakes and regressions", () => {
    const scores = Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, answerable: true, factualSupport: 4, relevance: 4, grounding: 4, safeHandling: 4, sourceCorrect: true, unsupportedClaim: false }));
    expect(assessQuality(scores, scores)).toEqual([]);
    expect(assessQuality(scores.slice(1), scores).length).toBeGreaterThan(0);
    expect(assessQuality(scores.map((s, i) => i === 0 ? { ...s, grounding: 2, unsupportedClaim: true } : s), scores).length).toBeGreaterThan(0);
    expect(assessQuality(scores.map(s => ({ ...s, sourceCorrect: false })), scores).length).toBeGreaterThan(0);
  });
});
