import { z } from "zod";
import { JEV_MODEL, JEV_INPUT_USD_PER_MILLION, type JevJsonValue } from "../../src/lib/jev/contracts";

/** Shared record schemas keep the evaluator and HTML renderer independent. */
export const JEV_REQUEST_RESERVATION_USD = 65536 * JEV_INPUT_USD_PER_MILLION / 1_000_000;
export const PRICE_POLICY = "jev-1.14.0-input-65536-at-0.042-per-million-v1";
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const safeName = z.string().regex(/^[a-zA-Z0-9_.-]{1,120}$/);
export const json: z.ZodType<JevJsonValue> = z.lazy(() => z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(json), z.record(z.string(), json)]));
export const sourceSchema = z.object({ commit: z.string().regex(/^[a-f0-9]{40}$/), tree: z.string().regex(/^[a-f0-9]{40}$/), dirty: z.boolean(), diffHash: sha }).strict();
export const identitySchema = z.object({ suiteId: safeName, task: z.enum(["provider_contract", "booking_intake", "call_outcome", "evidence", "experience_match"]),
  model: z.literal(JEV_MODEL), questionVersion: safeName, policyVersion: safeName, questionIdentity: json,
  questionDigest: sha, caseSetHash: sha, assessmentPolicy: safeName, qualificationEligible: z.boolean(), pricePolicy: z.literal(PRICE_POLICY), source: sourceSchema }).strict();
export const requestSchema = z.object({ model: z.literal(JEV_MODEL), state: json, questions: json }).strict();
const aggregateUsageSchema = z.object({ inputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(), outputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable() }).strict();
const usageSchema = aggregateUsageSchema.extend({ inputTokens: z.number().int().min(0).max(65536).nullable() });
const eventBase = { schemaVersion: z.literal(1), attemptId: safeName, runId: safeName, caseId: safeName, recordedAt: z.iso.datetime() };
export const reservedSchema = z.object({ ...eventBase, event: z.literal("reserved"), requestIndex: z.number().int().nonnegative(), requestHash: sha, request: requestSchema,
  evidenceKind: z.enum(["fixture", "live"]), reservedUsd: z.number().nonnegative() }).strict();
export const completedSchema = z.object({ ...eventBase, event: z.literal("completed"), status: z.number().int().min(100).max(599), response: json,
  usage: usageSchema.nullable(), costUsd: z.number().nonnegative().nullable() }).strict();
export const eventSchema = z.discriminatedUnion("event", [reservedSchema, completedSchema]);
export type AttemptEvent = z.infer<typeof eventSchema>;
export const caseSchema = z.object({ id: safeName, split: safeName, input: json, inputHash: sha, expected: json, baseline: json, requests: z.array(json),
  status: z.enum(["complete", "unavailable", "missing", "unknown_completion"]), outcome: json, passed: z.boolean().nullable(), reason: z.string().nullable(),
  attemptIds: z.array(safeName), latencyMs: z.number().nonnegative().nullable(), latencyKind: z.enum(["fixture", "fresh", "replayed", "imported"]),
  usage: aggregateUsageSchema.nullable(), costUsd: z.number().nonnegative().nullable(), sourceRunId: safeName }).strict();
export type EvaluationCaseRecord = z.infer<typeof caseSchema>;
const budgetSchema = z.object({ maxRequests: z.number().int().positive().nullable(), maxSpendUsd: z.number().positive().nullable(),
  totalRequests: z.number().int().nonnegative(), newRequests: z.number().int().nonnegative(), priorRequests: z.number().int().nonnegative(),
  settledUsd: z.number().nonnegative(), reservedUsd: z.number().nonnegative(), priorUpperBoundUsd: z.number().nonnegative(), newUpperBoundUsd: z.number().nonnegative() }).strict();
export const runSchema = z.object({ schemaVersion: z.literal(2), runId: safeName, createdAt: z.iso.datetime(), directory: z.string(), evidenceKind: z.enum(["fixture", "live", "imported"]),
  importedFrom: z.enum(["fixture", "live", "imported"]).nullable(), resumedFrom: z.string().nullable(), identity: identitySchema,
  qualification: z.enum(["plumbing_only", "experimental_unqualified"]), cases: z.array(caseSchema), attempts: z.array(eventSchema), budget: budgetSchema,
  complete: z.boolean(), targetsMet: z.boolean(), pass: z.boolean(), qualified: z.boolean(), metrics: json, missingCount: z.number().int().nonnegative(), failedCount: z.number().int().nonnegative() }).strict();
export type EvaluationRun = z.infer<typeof runSchema>;
