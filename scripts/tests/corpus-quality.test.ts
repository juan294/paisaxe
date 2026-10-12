// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assessQuality, type QualityScore } from "../lib/corpus-provenance";

/** Synthetic scores only: not generated answers, human judgments or a real baseline. */
function scores(answerableCount = 20): QualityScore[] {
  return Array.from({ length: 40 }, (_, i) => ({
    id: `fixture-q${i + 1}`, answerable: i < answerableCount,
    factualSupport: 3, relevance: 3, grounding: 3, safeHandling: 3,
    sourceCorrect: true, unsupportedClaim: false,
  }));
}
const fields = ["factualSupport", "relevance", "grounding", "safeHandling"] as const;

describe("blind quality score contract", () => {
  it("accepts forty unchanged synthetic judgments without claiming they are real approvals", () => {
    expect(assessQuality(scores(), scores())).toEqual([]);
  });

  it.each(["candidate", "baseline"] as const)("rejects a missing query in the %s run", run => {
    const candidate = scores(); const baseline = scores();
    if (run === "candidate") candidate.pop(); else baseline.pop();
    expect(assessQuality(candidate, baseline)).toContain("Exactly forty distinct queries are required in both runs");
  });

  it.each(["candidate", "baseline"] as const)("rejects duplicate IDs in the %s run even when its count is forty", run => {
    const candidate = scores(); const baseline = scores();
    const target = run === "candidate" ? candidate : baseline;
    const changed = target.map((s, i) => i === 39 ? { ...s, id: "fixture-q1" } : s);
    expect(assessQuality(run === "candidate" ? changed : candidate, run === "baseline" ? changed : baseline)).toContain("Exactly forty distinct queries are required in both runs");
  });

  it("rejects replacement IDs and changed answerability instead of comparing unrelated answers", () => {
    const candidate = scores().map((s, i) => i === 0 ? { ...s, id: "unfrozen-query" } : i === 1 ? { ...s, answerable: false } : s);
    const failures = assessQuality(candidate, scores());
    expect(failures).toContain("unfrozen-query: baseline/query mismatch");
    expect(failures).toContain("fixture-q2: baseline/query mismatch");
  });

  it("accepts the exact 95 percent source threshold on answerable queries", () => {
    const candidate = scores().map((s, i) => i === 0 ? { ...s, sourceCorrect: false } : s);
    expect(assessQuality(candidate, scores())).toEqual([]);
  });

  it("rejects 90 percent even when all unanswerable queries have correct source flags", () => {
    const candidate = scores().map((s, i) => i < 2 ? { ...s, sourceCorrect: false } : s);
    expect(assessQuality(candidate, scores())).toContain("Source correctness below 95 percent");
  });

  it("does not penalize source flags on unanswerable cases or let them inflate answerable correctness", () => {
    const candidate = scores().map(s => s.answerable ? s : { ...s, sourceCorrect: false });
    expect(assessQuality(candidate, scores())).toEqual([]);
    expect(assessQuality(scores(0), scores(0))).toContain("Source correctness below 95 percent");
  });

  it("rejects unsupported claims on an unanswerable safety case despite perfect numeric scores", () => {
    const candidate = scores().map((s, i) => i === 39 ? { ...s, unsupportedClaim: true, factualSupport: 4, relevance: 4, grounding: 4, safeHandling: 4 } : s);
    expect(assessQuality(candidate, scores())).toContain("fixture-q40: unsupported safety, price, opening or factual claim");
  });

  it.each(fields)("rejects an individual %s drop over one even when another score offsets its aggregate", field => {
    const candidate = scores().map((s, i) => i === 0 ? { ...s, [field]: 1 } : i < 3 ? { ...s, [field]: 4 } : s);
    expect(assessQuality(candidate, scores())).toContain(`fixture-q1: ${field} drop exceeds one point`);
  });

  it.each(["factualSupport", "grounding"] as const)("rejects aggregate %s regression even when no individual drop exceeds one", field => {
    const candidate = scores().map((s, i) => i === 0 ? { ...s, [field]: 2 } : s);
    expect(assessQuality(candidate, scores())).toContain(`${field}: aggregate regression`);
  });

  it.each(["relevance", "safeHandling"] as const)("does not invent an aggregate %s rejection below the approved per-query limit", field => {
    const candidate = scores().map((s, i) => i === 0 ? { ...s, [field]: 2 } : s);
    expect(assessQuality(candidate, scores())).toEqual([]);
  });

  it.each(fields)("permits a one-point %s drop when offset and every other gate remains satisfied", field => {
    const candidate = scores().map((s, i) => i === 0 ? { ...s, [field]: 2 } : i === 1 ? { ...s, [field]: 4 } : s);
    expect(assessQuality(candidate, scores())).toEqual([]);
  });

  for (const field of fields) {
    it.each([-1, 5, 2.5, NaN, Infinity, -Infinity])(`rejects invalid candidate ${field}=%s`, value => {
      const candidate = scores().map((s, i) => i === 0 ? { ...s, [field]: value } : s);
      expect(assessQuality(candidate, scores())).toContain(`fixture-q1: invalid ${field} score`);
    });
    it.each([-1, 5, 2.5, NaN, Infinity])(`rejects invalid baseline ${field}=%s`, value => {
      const baseline = scores().map((s, i) => i === 0 ? { ...s, [field]: value } : s);
      expect(assessQuality(scores(), baseline)).toContain(`fixture-q1: invalid ${field} score`);
    });
  }

  it.each([
    ["empty query identifier", { id: " " }],
    ["missing unsupported-claim judgment", { unsupportedClaim: undefined }],
    ["string source judgment", { sourceCorrect: "true" }],
    ["numeric answerability judgment", { answerable: 1 }],
  ] satisfies Array<[string, Record<string, unknown>]>)("rejects malformed runtime input: %s", (_label, patch) => {
    // Reflect passes a deserialized external shape to the actual function without
    // pretending that a malformed row satisfies the compile-time score type.
    const candidate = scores().map((s, i) => i === 0 ? { ...s, ...patch } : s);
    const baseline = scores().map((s, i) => i === 0 ? { ...s, ...patch } : s);
    const failures: unknown = Reflect.apply(assessQuality, undefined, [candidate, baseline]);
    expect(Array.isArray(failures)).toBe(true);
    expect(failures).not.toEqual([]);
  });
});
