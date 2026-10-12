import { z } from "zod";
import { CHAT_MODEL } from "../../src/lib/models";
import { assessQuality, contentHash } from "./corpus-provenance";

const nonempty = z.string().refine(value => value.trim().length > 0, "Required nonblank value");
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const run = z.object({
  runId: nonempty, recordedAt: z.iso.datetime(), manifestHash: sha, corpusVersion: nonempty,
  embeddingModel: z.literal("voyage-context-3"), dimensions: z.literal(512),
  answerModel: nonempty, configSha256: sha, answersSha256: sha,
}).strict();
const score = z.object({
  id: nonempty, answerable: z.boolean(), factualSupport: z.number().int().min(0).max(4),
  relevance: z.number().int().min(0).max(4), grounding: z.number().int().min(0).max(4),
  safeHandling: z.number().int().min(0).max(4), sourceCorrect: z.boolean(), unsupportedClaim: z.boolean(),
}).strict();
const evidenceSchema = z.object({
  schemaVersion: z.literal(1), querySetHash: sha,
  candidateRun: run.extend({ answerModel: z.literal(CHAT_MODEL) }), baselineRun: run,
  baselineAcceptance: z.object({ subjectHash: sha, reviewer: nonempty, recordedAt: z.iso.datetime(), evidenceSha256: sha }).strict(),
  blindReview: z.object({ comparisonHash: sha, scoresHash: sha,
    reviewers: z.array(z.object({ name: nonempty, kind: z.enum(["independent-agent", "owner", "native-reviewer"]) }).strict()).min(1),
    recordedAt: z.iso.datetime(), evidenceSha256: sha,
  }).strict(),
  candidate: z.array(score).length(40), baseline: z.array(score).length(40),
}).strict();
const source = z.object({ title: nonempty, url: z.url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Expected an HTTPS source URL without credentials") }).strict();
const answersSchema = z.object({ schemaVersion: z.literal(1), runId: nonempty,
  answers: z.array(z.object({ id: nonempty, answer: nonempty, sources: z.array(source) }).strict()).length(40),
}).strict();
const queriesSchema = z.object({ schemaVersion: z.literal(1), queries: z.array(z.object({
  id: nonempty, query: nonempty, answerability: z.enum(["answerable", "unknown", "safety"]),
}).passthrough()).length(40) }).passthrough();

/** Validates consistency of externally recorded answers and review receipts.
 * Hashes do not establish provider authenticity, actual review or owner authority.
 * This function never captures answers, generates approval or accesses a network. */
export function validateQualityEvidence(
  quality: unknown, queries: unknown, baselineAnswers: unknown, candidateAnswers: unknown,
  manifestHash: string, version: string, now: Date,
): void {
  const q = evidenceSchema.parse(quality);
  const frozen = queriesSchema.parse(queries);
  const baseline = answersSchema.parse(baselineAnswers);
  const candidate = answersSchema.parse(candidateAnswers);
  if (q.querySetHash !== contentHash(frozen)) throw new Error("Frozen query hash mismatch");
  const ids = new Set(frozen.queries.map(query => query.id));
  if (ids.size !== 40) throw new Error("Frozen query set requires forty distinct IDs");
  if (q.candidateRun.manifestHash !== manifestHash || q.candidateRun.corpusVersion !== version) throw new Error("Candidate corpus identity mismatch");
  for (const record of [q.candidateRun, q.baselineRun, q.baselineAcceptance, q.blindReview]) {
    if (Date.parse(record.recordedAt) > now.getTime()) throw new Error("Quality evidence date is in the future");
  }
  if (Date.parse(q.baselineAcceptance.recordedAt) < Date.parse(q.baselineRun.recordedAt)) throw new Error("Baseline acceptance predates the recorded baseline answers");
  if (Date.parse(q.blindReview.recordedAt) < Math.max(Date.parse(q.candidateRun.recordedAt), Date.parse(q.baselineRun.recordedAt), Date.parse(q.baselineAcceptance.recordedAt))) throw new Error("Blind review predates recorded answers or baseline acceptance");
  for (const [artifact, metadata] of [[baseline, q.baselineRun], [candidate, q.candidateRun]] as const) {
    if (artifact.runId !== metadata.runId) throw new Error("Answer run identity mismatch");
    if (contentHash(artifact) !== metadata.answersSha256) throw new Error("Recorded answer hash mismatch");
    if (new Set(artifact.answers.map(answer => answer.id)).size !== 40 || artifact.answers.some(answer => !ids.has(answer.id))) throw new Error("Recorded answers do not match forty distinct frozen query IDs");
  }
  if (q.baselineAcceptance.subjectHash !== contentHash({ querySetHash: q.querySetHash, run: q.baselineRun })) throw new Error("Baseline acceptance subject mismatch");
  if (q.blindReview.comparisonHash !== contentHash({ querySetHash: q.querySetHash, candidateRun: q.candidateRun, baselineRun: q.baselineRun })) throw new Error("Blind review comparison hash mismatch");
  if (q.blindReview.scoresHash !== contentHash({ candidate: q.candidate, baseline: q.baseline })) throw new Error("Blind review score hash mismatch");
  if (!["independent-agent", "owner"].every(kind => q.blindReview.reviewers.some(reviewer => reviewer.kind === kind))) throw new Error("Blind review requires independent-agent and owner reviewers");
  const identity = (name: string) => name.normalize("NFKC").trim().toLowerCase();
  const independent = q.blindReview.reviewers.filter(reviewer => reviewer.kind === "independent-agent");
  const owners = q.blindReview.reviewers.filter(reviewer => reviewer.kind === "owner");
  if (!independent.some(agent => owners.some(owner => identity(owner.name) !== identity(agent.name)))) throw new Error("Blind review requires distinct independent-agent and owner identities");
  const failures = assessQuality(q.candidate, q.baseline);
  for (const scores of [q.candidate, q.baseline]) {
    for (const query of frozen.queries) {
      const judgment = scores.find(item => item.id === query.id);
      if (!judgment || judgment.answerable !== (query.answerability === "answerable")) failures.push(`${query.id}: frozen query answerability mismatch`);
    }
  }
  for (const judgment of q.candidate) {
    if (judgment.answerable && judgment.sourceCorrect && !candidate.answers.find(answer => answer.id === judgment.id)?.sources.length) failures.push(`${judgment.id}: source-correct answer requires recorded attribution`);
  }
  if (failures.length) throw new Error(`Quality gate failed: ${failures.join("; ")}`);
}
