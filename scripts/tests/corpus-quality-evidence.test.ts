// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateQualityEvidence } from "../lib/corpus-quality-evidence";
import { contentHash, type QualityScore } from "../lib/corpus-provenance";

const NOW = new Date("2026-10-11T12:00:00Z");
const HASH = "a".repeat(64);
const VERSION = "synthetic-reviewed-corpus";

/** Independently invented answers/receipts only. These exercise bindings, never
 * establish actual provider capture, owner acceptance or blind human review. */
function fixture() {
  const queries = { schemaVersion: 1, queries: Array.from({ length: 40 }, (_, i) => ({
    id: `synthetic-q${i + 1}`, query: `Invented fixture question ${i + 1}?`,
    language: i % 2 ? "en" : "es", region: "fixture", topic: "fixture", season: "all",
    answerability: i < 20 ? "answerable" : i < 30 ? "unknown" : "safety",
    expectedSourceIds: [], unsupportedClaimsToReject: ["Invented unsupported advice"],
  })) };
  const answers = (runId: string) => ({ schemaVersion: 1, runId, answers: queries.queries.map(q => ({
    id: q.id, answer: `Invented response for ${q.id}; not a real tourism answer.`,
    sources: q.answerability === "answerable" ? [{ url: "https://example.com/synthetic-evidence", title: "Invented fixture evidence" }] : [],
  })) });
  const baselineAnswers = answers("synthetic-baseline");
  const candidateAnswers = answers("synthetic-candidate");
  const run = (artifact: typeof baselineAnswers) => ({
    runId: artifact.runId, recordedAt: "2026-10-10T10:00:00Z", manifestHash: HASH,
    corpusVersion: VERSION, embeddingModel: "voyage-context-3", dimensions: 512,
    answerModel: "claude-sonnet-5-5", configSha256: HASH, answersSha256: contentHash(artifact),
  });
  const judgments: QualityScore[] = queries.queries.map(q => ({ id: q.id,
    answerable: q.answerability === "answerable", factualSupport: 3, relevance: 3,
    grounding: 3, safeHandling: 3, sourceCorrect: true, unsupportedClaim: false,
  }));
  const quality = {
    schemaVersion: 1, querySetHash: contentHash(queries),
    candidateRun: run(candidateAnswers), baselineRun: { ...run(baselineAnswers), answerModel: "synthetic-historical-model", corpusVersion: "legacy" },
    baselineAcceptance: { subjectHash: HASH, reviewer: "Synthetic owner only", recordedAt: "2026-10-10T11:00:00Z", evidenceSha256: HASH },
    blindReview: { comparisonHash: HASH, scoresHash: HASH,
      reviewers: [{ name: "Synthetic independent reviewer", kind: "independent-agent" }, { name: "Synthetic owner", kind: "owner" }],
      recordedAt: "2026-10-10T12:00:00Z", evidenceSha256: HASH },
    candidate: judgments.map(s => ({ ...s })), baseline: judgments.map(s => ({ ...s })),
  };
  const result = { queries, quality, baselineAnswers, candidateAnswers };
  quality.baselineAcceptance.subjectHash = contentHash({ querySetHash: quality.querySetHash, run: quality.baselineRun });
  quality.blindReview.comparisonHash = contentHash({ querySetHash: quality.querySetHash, candidateRun: quality.candidateRun, baselineRun: quality.baselineRun });
  quality.blindReview.scoresHash = contentHash({ candidate: quality.candidate, baseline: quality.baseline });
  return result;
}

type Fixture = ReturnType<typeof fixture>;
function reseal(f: Pick<Fixture, "queries" | "quality" | "baselineAnswers" | "candidateAnswers">) {
  const q = f.quality;
  q.querySetHash = contentHash(f.queries);
  q.baselineRun.answersSha256 = contentHash(f.baselineAnswers);
  q.candidateRun.answersSha256 = contentHash(f.candidateAnswers);
  q.baselineAcceptance.subjectHash = contentHash({ querySetHash: q.querySetHash, run: q.baselineRun });
  q.blindReview.comparisonHash = contentHash({ querySetHash: q.querySetHash, candidateRun: q.candidateRun, baselineRun: q.baselineRun });
  q.blindReview.scoresHash = contentHash({ candidate: q.candidate, baseline: q.baseline });
}
function validate(f: Fixture) {
  return validateQualityEvidence(f.quality, f.queries, f.baselineAnswers, f.candidateAnswers, HASH, VERSION, NOW);
}
function qualityWithCandidateArtifact(f: Fixture, artifact: unknown) {
  const candidateRun = { ...f.quality.candidateRun, answersSha256: contentHash(artifact) };
  return { ...f.quality, candidateRun, blindReview: { ...f.quality.blindReview,
    comparisonHash: contentHash({ querySetHash: f.quality.querySetHash, candidateRun, baselineRun: f.quality.baselineRun }),
  } };
}

describe("recorded quality evidence and externally supplied receipt bindings", () => {
  it.each([undefined, " ", 123])("rejects a resealed frozen query without actual question text %j", value => {
    const f = fixture();
    const queries = { ...f.queries, queries: f.queries.queries.map((query, i) => i ? query : value === undefined ? Object.fromEntries(Object.entries(query).filter(([key]) => key !== "query")) : { ...query, query: value }) };
    const querySetHash = contentHash(queries);
    const quality = { ...f.quality, querySetHash,
      baselineAcceptance: { ...f.quality.baselineAcceptance, subjectHash: contentHash({ querySetHash, run: f.quality.baselineRun }) },
      blindReview: { ...f.quality.blindReview, comparisonHash: contentHash({ querySetHash, candidateRun: f.quality.candidateRun, baselineRun: f.quality.baselineRun }) },
    };
    expect(() => validateQualityEvidence(quality, queries, f.baselineAnswers, f.candidateAnswers, HASH, VERSION, NOW)).toThrow();
  });

  it("rejects a source-correct answerable judgment when recorded attribution is absent", () => {
    const f = fixture(); f.candidateAnswers.answers = f.candidateAnswers.answers.map((answer, i) => i ? answer : { ...answer, sources: [] });
    reseal(f); expect(() => validate(f)).toThrow(/source|attribution/i);
  });

  it("accepts a fully bound synthetic pair without granting legacy serving rights", () => {
    expect(() => validate(fixture())).not.toThrow();
  });

  it("permits nonaggregate relevance/safe-handling drops within the approved per-query limit", () => {
    const f = fixture(); f.quality.candidate = f.quality.candidate.map((s, i) => i === 0 ? { ...s, relevance: 2, safeHandling: 2 } : s);
    reseal(f); expect(() => validate(f)).not.toThrow();
  });

  it.each(["baselineAnswers", "candidateAnswers"] as const)("rejects edited %s bytes despite matching run IDs", artifact => {
    const f = fixture(); f[artifact].answers = f[artifact].answers.map((a, i) => i === 0 ? { ...a, answer: "Changed synthetic answer" } : a);
    expect(() => validate(f)).toThrow(/answer.*hash|hash.*answer/i);
  });

  it.each(["baselineAnswers", "candidateAnswers"] as const)("rejects a different %s run identity even after rehashing", artifact => {
    const f = fixture(); f[artifact].runId = "another-synthetic-run"; reseal(f);
    expect(() => validate(f)).toThrow(/run.*identity|run.*mismatch/i);
  });

  it.each(["baselineAnswers", "candidateAnswers"] as const)("requires forty unique frozen IDs in %s, not merely valid hashes", artifact => {
    const f = fixture(); f[artifact].answers = f[artifact].answers.map((a, i) => i === 39 ? { ...a, id: "synthetic-q1" } : a); reseal(f);
    expect(() => validate(f)).toThrow(/answer|forty|distinct|query/i);
  });

  it.each(["baselineAnswers", "candidateAnswers"] as const)("rejects missing and unrelated %s entries after rehashing", artifact => {
    const missing = fixture(); missing[artifact].answers.pop(); reseal(missing);
    expect(() => validate(missing)).toThrow();
    const unrelated = fixture(); unrelated[artifact].answers = unrelated[artifact].answers.map((a, i) => i === 39 ? { ...a, id: "unfrozen" } : a); reseal(unrelated);
    expect(() => validate(unrelated)).toThrow(/answer|query|frozen/i);
  });

  it("rejects a modified frozen query file even when answer and score IDs stay unchanged", () => {
    const f = fixture(); f.queries.queries = f.queries.queries.map((q, i) => i === 0 ? { ...q, query: "Changed wording" } : q);
    expect(() => validate(f)).toThrow(/query.*hash|hash.*query/i);
  });

  it("rejects jointly changed score answerability contrary to the frozen query", () => {
    const f = fixture(); f.quality.candidate = f.quality.candidate.map((s, i) => i === 0 ? { ...s, answerable: false } : s);
    f.quality.baseline = f.quality.baseline.map((s, i) => i === 0 ? { ...s, answerable: false } : s); reseal(f);
    expect(() => validate(f)).toThrow(/frozen|answerability|query/i);
  });

  it("rejects forty matching but unfrozen judgment identities", () => {
    const f = fixture(); f.quality.candidate = f.quality.candidate.map((s, i) => ({ ...s, id: `other-${i}` }));
    f.quality.baseline = f.quality.baseline.map((s, i) => ({ ...s, id: `other-${i}` })); reseal(f);
    expect(() => validate(f)).toThrow(/frozen|query/i);
  });

  it.each(["manifestHash", "corpusVersion", "embeddingModel", "dimensions", "answerModel"] as const)("rejects mismatched candidate %s even with all dependent receipts rebound", field => {
    const f = fixture(); const replacement = { manifestHash: "b".repeat(64), corpusVersion: "another-corpus", embeddingModel: "voyage-3.5", dimensions: 256, answerModel: "another-model" };
    const candidateRun = { ...f.quality.candidateRun, [field]: replacement[field] };
    const quality: unknown = { ...f.quality, candidateRun, blindReview: { ...f.quality.blindReview,
      comparisonHash: contentHash({ querySetHash: f.quality.querySetHash, candidateRun, baselineRun: f.quality.baselineRun }),
    } };
    // Call the public unknown-input boundary, without casting invalid values to its schema.
    expect(() => validateQualityEvidence(quality, f.queries, f.baselineAnswers, f.candidateAnswers, HASH, VERSION, NOW)).toThrow();
  });

  it("rejects an edited baseline run until both owner acceptance and blind comparison are renewed", () => {
    const f = fixture(); f.quality.baselineRun.answerModel = "another-historical-model";
    expect(() => validate(f)).toThrow(/acceptance|comparison|subject/i);
  });

  it("rejects changed scores until the exact blind review score hash is renewed", () => {
    const f = fixture(); f.quality.candidate = f.quality.candidate.map((s, i) => i === 0 ? { ...s, relevance: 4 } : s);
    expect(() => validate(f)).toThrow(/score.*hash|hash.*score/i);
  });

  it.each(["candidateRun", "baselineRun", "baselineAcceptance", "blindReview"] as const)("rejects future-dated %s evidence", field => {
    const f = fixture(); f.quality[field].recordedAt = "2026-10-12T00:00:00Z"; reseal(f);
    expect(() => validate(f)).toThrow(/future|date|time/i);
  });

  it("rejects baseline acceptance before its recorded answers and accepts the later corrected receipt", () => {
    const f = fixture();
    f.quality.baselineAcceptance.recordedAt = "2026-10-10T09:00:00Z";
    reseal(f);
    expect(() => validate(f)).toThrow(/acceptance|baseline|chronolog|before|date|time/i);
    f.quality.baselineAcceptance.recordedAt = "2026-10-10T11:00:00Z";
    reseal(f);
    expect(() => validate(f)).not.toThrow();
  });

  it.each(["candidateRun", "baselineRun"] as const)("rejects blind review before %s answers and accepts a later corrected review", run => {
    const f = fixture();
    f.quality[run].recordedAt = run === "candidateRun" ? "2026-10-10T11:30:00Z" : "2026-10-10T11:00:00Z";
    f.quality.baselineAcceptance.recordedAt = run === "candidateRun" ? "2026-10-10T11:00:00Z" : "2026-10-10T11:15:00Z";
    f.quality.blindReview.recordedAt = run === "candidateRun" ? "2026-10-10T11:15:00Z" : "2026-10-10T10:30:00Z";
    reseal(f);
    expect(() => validate(f)).toThrow(/review|chronolog|before|date|time/i);
    f.quality.blindReview.recordedAt = "2026-10-10T12:00:00Z";
    reseal(f);
    expect(() => validate(f)).not.toThrow();
  });

  it.each([
    ["Synthetic reviewer", "Synthetic reviewer"],
    ["Synthetic reviewer", "  SYNTHETIC REVIEWER  "],
  ])("rejects one normalized identity filling both required review roles (%s / %s) and accepts a distinct owner", (independent, owner) => {
    const f = fixture();
    f.quality.blindReview.reviewers = [
      { name: independent, kind: "independent-agent" },
      { name: owner, kind: "owner" },
    ];
    expect(() => validate(f)).toThrow(/distinct|independent|review|identity/i);
    f.quality.blindReview.reviewers = [
      { name: independent, kind: "independent-agent" },
      { name: "Another synthetic owner", kind: "owner" },
    ];
    expect(() => validate(f)).not.toThrow();
  });

  it.each(["independent-agent", "owner"])("requires the %s review role, not an arbitrary nonempty list", kind => {
    const f = fixture(); f.quality.blindReview.reviewers = f.quality.blindReview.reviewers.filter(r => r.kind !== kind);
    expect(() => validate(f)).toThrow(/review|owner|independent/i);
  });

  it("does not treat a native reviewer alone as the required independent plus owner review", () => {
    const f = fixture(); f.quality.blindReview.reviewers = [{ name: "Synthetic native reviewer", kind: "native-reviewer" }];
    expect(() => validate(f)).toThrow(/review|owner|independent/i);
  });

  it.each([
    ["quality schema", (f: Fixture) => ({ ...f.quality, schemaVersion: 2 })],
    ["missing baseline acceptance", (f: Fixture) => Object.fromEntries(Object.entries(f.quality).filter(([key]) => key !== "baselineAcceptance"))],
    ["unknown receipt field", (f: Fixture) => ({ ...f.quality, blindReview: { ...f.quality.blindReview, automaticApproval: true } })],
    ["blank reviewer", (f: Fixture) => ({ ...f.quality, baselineAcceptance: { ...f.quality.baselineAcceptance, reviewer: " " } })],
    ["missing evidence", (f: Fixture) => ({ ...f.quality, blindReview: { ...f.quality.blindReview, evidenceSha256: "" } })],
    ["blank historical model", (f: Fixture) => ({ ...f.quality, baselineRun: { ...f.quality.baselineRun, answerModel: " " } })],
    ["invalid config hash", (f: Fixture) => ({ ...f.quality, candidateRun: { ...f.quality.candidateRun, configSha256: "not-a-hash" } })],
    ["nonboolean judgment", (f: Fixture) => ({ ...f.quality, candidate: f.quality.candidate.map((s, i) => i === 0 ? { ...s, sourceCorrect: "true" } : s) })],
  ] satisfies Array<[string, (f: Fixture) => unknown]>)("rejects malformed external quality: %s", (_label, mutate) => {
    const f = fixture(); expect(() => validateQualityEvidence(mutate(f), f.queries, f.baselineAnswers, f.candidateAnswers, HASH, VERSION, NOW)).toThrow();
  });

  it.each([
    { schemaVersion: 2 }, { unexpected: true }, { answers: null },
  ])("rejects malformed external answer artifacts %j", patch => {
    const f = fixture(); const artifact = { ...f.candidateAnswers, ...patch };
    expect(() => validateQualityEvidence(qualityWithCandidateArtifact(f, artifact), f.queries, f.baselineAnswers, artifact, HASH, VERSION, NOW)).toThrow();
  });

  it.each([
    { answer: " " }, { answer: 5 }, { sources: [{ url: "javascript:alert(1)", title: "Bad fixture URL" }] },
    { sources: [{ url: "https://example.com", title: " " }] }, { unreviewedField: true },
  ])("rejects malformed recorded answers before scoring %j", patch => {
    const f = fixture(); const artifact = { ...f.candidateAnswers, answers: f.candidateAnswers.answers.map((a, i) => i === 0 ? { ...a, ...patch } : a) };
    expect(() => validateQualityEvidence(qualityWithCandidateArtifact(f, artifact), f.queries, f.baselineAnswers, artifact, HASH, VERSION, NOW)).toThrow();
  });

  it.each(["unsupported", "source-correctness", "individual-drop", "aggregate-regression"] as const)("applies actual quality mathematics after every receipt hash agrees: %s", defect => {
    const f = fixture();
    f.quality.candidate = f.quality.candidate.map((s, i) => {
      if (defect === "unsupported" && i === 39) return { ...s, unsupportedClaim: true };
      if (defect === "source-correctness" && i < 2) return { ...s, sourceCorrect: false };
      if (defect === "individual-drop" && i === 0) return { ...s, relevance: 1 };
      if (defect === "aggregate-regression" && i === 0) return { ...s, grounding: 2 };
      return s;
    });
    reseal(f); expect(() => validate(f)).toThrow(/quality|unsupported|source|drop|regression/i);
  });
});
