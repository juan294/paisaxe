import { createHash } from "node:crypto";

/** Canonical JSON binds receipts, retries and vectors to the same immutable input. */
export function canonicalJson(input: unknown): string {
    if (Array.isArray(input)) return `[${input.map(canonicalJson).join(",")}]`;
    if (input !== null && typeof input === "object") {
      return `{${Object.entries(input).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
    }
    const encoded = JSON.stringify(input);
    if (encoded === undefined) throw new Error("Corpus inputs must be JSON");
    return encoded;
}

export function contentHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function tokens(text: string): string[] {
  return text.normalize("NFKD").replace(/[\p{M}\p{Cf}]/gu, "").toLocaleLowerCase("und").match(/[\p{L}\p{N}]+/gu) ?? [];
}

export interface OverlapReview { fingerprint: string; reviewer: string; reason: string }

/** Restricted references stay in the caller's process; results contain hashes only. */
export function scanOverlap(candidateChunks: string[], referenceChunks: string[], reviews: OverlapReview[] = []) {
  const candidateTokens = tokens(candidateChunks.join(" "));
  const candidate = ` ${candidateTokens.join(" ")} `;
  const reference = referenceChunks.join(" ").replace(/\b(Dr|Dra|Sr|Sra|St|Sta|Prof)\./giu, "$1");
  const approved = new Set(reviews.filter(r => r.reviewer.trim() && r.reason.trim()).map(r => r.fingerprint));
  // Short matches require narrow human review too. A length threshold must not
  // silently discard a copied safety sentence or an abbreviation fragment.
  const sentenceMatches = [...new Map(reference.split(/[.!?。！？]+/u).map(tokens).filter(t => t.length >= 2)
    .filter(t => candidate.includes(` ${t.join(" ")} `)).map(t => [contentHash(t), t.length])).entries()];
  const sentences = sentenceMatches.filter(([fingerprint, length]) => length >= 8 || !approved.has(fingerprint)).map(([fingerprint]) => fingerprint);
  const windows = function* (list: string[]) { for (let i = 0; i + 8 <= list.length; i++) yield contentHash(list.slice(i, i + 8)); };
  const referenceWindows = new Set(windows(tokens(reference)));
  const matched = new Set<string>();
  for (const hash of windows(candidateTokens)) if (referenceWindows.has(hash)) matched.add(hash);
  const matches = [...matched];

  return { sentences, unreviewedWindows: matches.filter(hash => !approved.has(hash)), reviewedWindows: matches.filter(hash => approved.has(hash)) };
}

export function validateVector(vector: unknown): asserts vector is number[] {
  if (!Array.isArray(vector) || vector.length !== 512 || !vector.every(n => typeof n === "number" && Number.isFinite(n)) || !vector.some(n => n !== 0)) {
    throw new Error("Expected a finite nonzero voyage-context-3 vector with 512 dimensions");
  }
}

export interface QualityScore {
  id: string; answerable: boolean; factualSupport: number; relevance: number; grounding: number; safeHandling: number;
  sourceCorrect: boolean; unsupportedClaim: boolean;
}

/** Scores must come from blind review of recorded answers, never keyword heuristics. */
export function assessQuality(candidate: QualityScore[], baseline: QualityScore[]): string[] {
  const failures: string[] = [];
  if (!Array.isArray(candidate) || !Array.isArray(baseline) || [...candidate, ...baseline].some(s => !s || typeof s !== "object" || typeof s.id !== "string" || !s.id.trim() || typeof s.answerable !== "boolean" || typeof s.sourceCorrect !== "boolean" || typeof s.unsupportedClaim !== "boolean")) return ["Malformed quality judgments"];
  const fields = ["factualSupport", "relevance", "grounding", "safeHandling"] as const;
  if (candidate.length !== 40 || baseline.length !== 40 || new Set(candidate.map(s => s.id)).size !== 40 || new Set(baseline.map(s => s.id)).size !== 40) failures.push("Exactly forty distinct queries are required in both runs");
  for (const score of candidate) {
    const previous = baseline.find(s => s.id === score.id);
    if (!previous || score.answerable !== previous.answerable) failures.push(`${score.id}: baseline/query mismatch`);
    if (score.unsupportedClaim) failures.push(`${score.id}: unsupported safety, price, opening or factual claim`);
    for (const field of fields) {
      if (!Number.isInteger(score[field]) || score[field] < 0 || score[field] > 4 || (previous && (!Number.isInteger(previous[field]) || previous[field] < 0 || previous[field] > 4))) failures.push(`${score.id}: invalid ${field} score`);
      if (previous && previous[field] - score[field] > 1) failures.push(`${score.id}: ${field} drop exceeds one point`);
    }
  }
  for (const field of ["factualSupport", "grounding"] as const) {
    if (candidate.reduce((n, s) => n + s[field], 0) < baseline.reduce((n, s) => n + s[field], 0)) failures.push(`${field}: aggregate regression`);
  }
  const answerable = candidate.filter(s => s.answerable);
  if (!answerable.length || answerable.filter(s => s.sourceCorrect).length / answerable.length < 0.95) failures.push("Source correctness below 95 percent");
  return failures;
}
