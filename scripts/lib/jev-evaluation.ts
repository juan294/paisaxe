import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { JEV_MODEL, JEV_INPUT_USD_PER_MILLION, type JevJsonValue, type JevQuestionSet, type JevQuestions, type JevState, type JevTask } from "../../src/lib/jev/contracts";
import { validateJevResponse } from "../../src/lib/jev/client";
import { renderJevReport } from "./jev-report";

export interface EvaluationRequest { state: JevState; questionSet: JevQuestionSet }
export interface EvaluationCase {
  id: string; split: string; input: JevState; expected: JevJsonValue; baseline: JevJsonValue;
  requests: EvaluationRequest[];
  fixtureResponses: { status: number; body: JevJsonValue }[];
}
export interface EvaluationOutcome { value: JevJsonValue; unavailable: boolean; reason?: string }
export interface EvaluationSuite {
  id: string; task: JevTask; questionVersion: string; policyVersion: string;
  questionIdentity: unknown; qualification: "plumbing_only" | "experimental_unqualified";
  cases: EvaluationCase[];
  evaluate(input: JevState, transport: { fetch: typeof globalThis.fetch }): Promise<EvaluationOutcome>;
  compare?(actual: JevJsonValue, expected: JevJsonValue): boolean;
}
export const JEV_REQUEST_RESERVATION_USD = 65536 * JEV_INPUT_USD_PER_MILLION / 1_000_000;
const PRICE_POLICY = "jev-1.14.0-input-65536-at-0.042-per-million-v1";
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const safeName = z.string().regex(/^[a-zA-Z0-9_.-]{1,120}$/);
const json: z.ZodType<JevJsonValue> = z.lazy(() => z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(json), z.record(z.string(), json)]));
const sourceSchema = z.object({ commit: z.string().regex(/^[a-f0-9]{40}$/), tree: z.string().regex(/^[a-f0-9]{40}$/), dirty: z.boolean(), diffHash: sha }).strict();
const identitySchema = z.object({ suiteId: safeName, task: z.enum(["provider_contract", "booking_intake", "call_outcome", "evidence", "experience_match"]),
  model: z.literal(JEV_MODEL), questionVersion: safeName, policyVersion: safeName, questionIdentity: json,
  questionDigest: sha, caseSetHash: sha, pricePolicy: z.literal(PRICE_POLICY), source: sourceSchema }).strict();
const requestSchema = z.object({ model: z.literal(JEV_MODEL), state: json, questions: json }).strict();
const aggregateUsageSchema = z.object({ inputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(), outputTokens: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable() }).strict();
const usageSchema = aggregateUsageSchema.extend({ inputTokens: z.number().int().min(0).max(65536).nullable() });
const eventBase = { schemaVersion: z.literal(1), attemptId: safeName, runId: safeName, caseId: safeName, recordedAt: z.iso.datetime() };
const reservedSchema = z.object({ ...eventBase, event: z.literal("reserved"), requestIndex: z.number().int().nonnegative(), requestHash: sha, request: requestSchema,
  evidenceKind: z.enum(["fixture", "live"]), reservedUsd: z.number().nonnegative() }).strict();
const completedSchema = z.object({ ...eventBase, event: z.literal("completed"), status: z.number().int().min(100).max(599), response: json,
  usage: usageSchema.nullable(), costUsd: z.number().nonnegative().nullable() }).strict();
const eventSchema = z.discriminatedUnion("event", [reservedSchema, completedSchema]);
export type AttemptEvent = z.infer<typeof eventSchema>;
const caseSchema = z.object({ id: safeName, split: safeName, input: json, inputHash: sha, expected: json, baseline: json, requests: z.array(json),
  status: z.enum(["complete", "unavailable", "missing", "unknown_completion"]), outcome: json, passed: z.boolean().nullable(), reason: z.string().nullable(),
  attemptIds: z.array(safeName), latencyMs: z.number().nonnegative().nullable(), latencyKind: z.enum(["fixture", "fresh", "replayed", "imported"]),
  usage: aggregateUsageSchema.nullable(), costUsd: z.number().nonnegative().nullable(), sourceRunId: safeName }).strict();
export type EvaluationCaseRecord = z.infer<typeof caseSchema>;
const budgetSchema = z.object({ maxRequests: z.number().int().positive().nullable(), maxSpendUsd: z.number().positive().nullable(),
  totalRequests: z.number().int().nonnegative(), newRequests: z.number().int().nonnegative(), priorRequests: z.number().int().nonnegative(),
  settledUsd: z.number().nonnegative(), reservedUsd: z.number().nonnegative(), priorUpperBoundUsd: z.number().nonnegative(), newUpperBoundUsd: z.number().nonnegative() }).strict();
const runSchema = z.object({ schemaVersion: z.literal(1), runId: safeName, createdAt: z.iso.datetime(), directory: z.string(), evidenceKind: z.enum(["fixture", "live", "imported"]),
  importedFrom: z.enum(["fixture", "live", "imported"]).nullable(), resumedFrom: z.string().nullable(), identity: identitySchema,
  qualification: z.enum(["plumbing_only", "experimental_unqualified"]), cases: z.array(caseSchema), attempts: z.array(eventSchema), budget: budgetSchema,
  complete: z.boolean(), missingCount: z.number().int().nonnegative(), failedCount: z.number().int().nonnegative() }).strict();
export type EvaluationRun = z.infer<typeof runSchema>;
export interface EvaluationOptions {
  mode: "fixture" | "live"; outputRoot?: string; maxRequests?: number; maxSpendUsd?: number;
  resume?: string; retryUnknown?: string[]; caseId?: string; fetch?: typeof globalThis.fetch;
  onDirectory?(directory: string): void;
}
export function hashJev(value: unknown): string {
  const canonical = (input: unknown): string => {
    if (input === null || typeof input !== "object") return JSON.stringify(input);
    if (Array.isArray(input)) return `[${input.map(canonical).join(",")}]`;
    return `{${Object.keys(input).sort().map(key => `${JSON.stringify(key)}:${canonical((input as Record<string, unknown>)[key])}`).join(",")}}`;
  };
  return createHash("sha256").update(canonical(value)).digest("hex");
}
function sourceIdentity(): z.infer<typeof sourceSchema> {
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const status = git("status", "--porcelain");
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean).sort().map(file => [file, createHash("sha256").update(readFileSync(file)).digest("hex")]);
  return { commit: git("rev-parse", "HEAD").trim(), tree: git("rev-parse", "HEAD^{tree}").trim(), dirty: status.length > 0,
    diffHash: hashJev({ diff: git("diff", "--binary", "HEAD"), untracked }) };
}
function durableAppend(filename: string, value: unknown): void {
  const fd = openSync(filename, "a");
  try { writeSync(fd, JSON.stringify(value) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
}
function durableJson(filename: string, value: unknown): void {
  const temp = `${filename}.${randomUUID()}.tmp`;
  const fd = openSync(temp, "wx");
  try { writeSync(fd, JSON.stringify(value, null, 2) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, filename);
  const directoryFd = openSync(dirname(filename), "r"); try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
}
function readLines(filename: string): unknown[] {
  const text = readFileSync(filename, "utf8");
  if (text && !text.endsWith("\n")) throw new Error("Interrupted or corrupted JSONL record");
  return text.split("\n").filter(Boolean).map(line => JSON.parse(line));
}
function requestBody(request: EvaluationRequest) { return { model: JEV_MODEL, state: request.state, questions: request.questionSet.questions }; }
function caseIdentity(item: { id: string; split: string; input: JevJsonValue; expected: JevJsonValue; baseline: JevJsonValue; requests: unknown[] }) {
  return { id: item.id, split: item.split, input: item.input, expected: item.expected, baseline: item.baseline, requests: item.requests };
}
function validateRun(record: EvaluationRun): void {
  if (hashJev(record.identity.questionIdentity) !== record.identity.questionDigest) throw new Error("Question digest mismatch");
  if (new Set(record.cases.map(c => c.id)).size !== record.cases.length || !record.cases.length) throw new Error("Invalid duplicate or empty case set");
  const caseSet = record.cases.map(c => ({ id: c.id, split: c.split, input: c.input, expected: c.expected, baseline: c.baseline, requests: c.requests }));
  if (hashJev(caseSet) !== record.identity.caseSetHash) throw new Error("Case-set digest mismatch");
  const reserved = new Map<string, z.infer<typeof reservedSchema>>(); const completed = new Set<string>();
  for (const event of record.attempts) {
    const item = record.cases.find(c => c.id === event.caseId);
    if (!item) throw new Error("Attempt refers to an unknown case");
    if (event.event === "reserved") {
      if (reserved.has(event.attemptId) || event.requestHash !== hashJev(event.request) ||
        event.requestIndex >= item.requests.length || hashJev(event.request) !== hashJev(requestBody(item.requests[event.requestIndex] as unknown as EvaluationRequest)) ||
        event.reservedUsd !== (event.evidenceKind === "live" ? JEV_REQUEST_RESERVATION_USD : 0)) throw new Error("Invalid reservation identity");
      reserved.set(event.attemptId, event);
    } else {
      const start = reserved.get(event.attemptId);
      if (!start || completed.has(event.attemptId) || start.caseId !== event.caseId || start.runId !== event.runId) throw new Error("Invalid completion identity");
      const validated = event.status >= 200 && event.status < 300 ? validateJevResponse(event.response, start.request.questions as unknown as JevQuestions) : null;
      if (hashJev(event.usage) !== hashJev(validated?.usage ?? null) || event.costUsd !== (validated?.estimatedCostUsd ?? null)) throw new Error("Invalid response/usage settlement");
      completed.add(event.attemptId);
    }
  }
  for (const item of record.cases) {
    if (hashJev(item.input) !== item.inputHash || item.attemptIds.some(id => !reserved.has(id) || reserved.get(id)?.caseId !== item.id)) throw new Error("Invalid case input/attempt identity");
    if (item.status === "complete" && (item.passed === null || item.attemptIds.some(id => !completed.has(id)))) throw new Error("Incomplete case falsely marked complete");
  }
  const expectedAccounting = accounting(record.attempts, record.runId);
  for (const key of Object.keys(expectedAccounting) as (keyof typeof expectedAccounting)[]) if (record.budget[key] !== expectedAccounting[key]) throw new Error("Invalid budget/count checkpoint");
  const missing = record.cases.filter(c => c.status === "missing" || c.status === "unknown_completion").length;
  const failed = record.cases.filter(c => c.status === "unavailable" || c.passed === false).length;
  if (record.missingCount !== missing || record.failedCount !== failed || record.complete !== record.cases.every(c => c.status === "complete" && c.passed === true)) throw new Error("Invalid completeness checkpoint");
}
export function readEvaluationRecord(filename: string): EvaluationRun {
  try { const result = runSchema.parse(JSON.parse(readFileSync(filename, "utf8"))); validateRun(result); return result; }
  catch { throw new Error("Invalid or incompatible Jev record; start a new run with npm run eval:jev -- fixture --suite provider-contract."); }
}
function readResume(directory: string): EvaluationRun {
  try {
    const run = readEvaluationRecord(join(directory, "run.json"));
    const events = readLines(join(directory, "attempts.jsonl")).map(event => eventSchema.parse(event));
    // The durable append may be ahead of the last atomic snapshot after interruption.
    if (run.attempts.length > events.length || run.attempts.some((event, index) => hashJev(event) !== hashJev(events[index]))) throw new Error("Truncated/changed attempt log");
    run.attempts = events;
    const rows = readLines(join(directory, "cases.jsonl")).map(row => caseSchema.parse(row));
    const snapshots = new Map<string, EvaluationCaseRecord>();
    for (const row of rows) {
      const original = run.cases.find(c => c.id === row.id);
      if (!original || hashJev(caseIdentity({ ...row, requests: row.requests as unknown as EvaluationRequest[] })) !== hashJev(caseIdentity({ ...original, requests: original.requests as unknown as EvaluationRequest[] }))) throw new Error("Changed case log identity");
      snapshots.set(row.id, row);
    }
    if (snapshots.size !== run.cases.length || run.cases.some(snapshot => !rows.some(row => hashJev(row) === hashJev(snapshot)))) throw new Error("Missing or truncated case log/checkpoint mismatch");
    run.cases = run.cases.map(c => snapshots.get(c.id)!);
    refresh(run); validateRun(run);
    return run;
  } catch { throw new Error("Corrupt or incompatible checkpoint; start a new run with npm run eval:jev -- fixture --suite provider-contract."); }
}
function accounting(events: AttemptEvent[], currentRunId: string) {
  let totalRequests = 0, newRequests = 0, settledUsd = 0, reservedUsd = 0, priorUpperBoundUsd = 0, newUpperBoundUsd = 0;
  for (const event of events) {
    if (event.event !== "reserved" || event.evidenceKind !== "live") continue;
    totalRequests++; if (event.runId === currentRunId) newRequests++;
    const completion = events.find(e => e.event === "completed" && e.attemptId === event.attemptId) as z.infer<typeof completedSchema> | undefined;
    const charge = completion?.costUsd ?? event.reservedUsd;
    if (completion?.costUsd != null) settledUsd += charge; else reservedUsd += charge;
    if (event.runId === currentRunId) newUpperBoundUsd += charge; else priorUpperBoundUsd += charge;
  }
  return { totalRequests, newRequests, priorRequests: totalRequests - newRequests, settledUsd, reservedUsd, priorUpperBoundUsd, newUpperBoundUsd };
}
function refresh(run: EvaluationRun): void {
  run.budget = { ...run.budget, ...accounting(run.attempts, run.runId) };
  run.missingCount = run.cases.filter(c => c.status === "missing" || c.status === "unknown_completion").length;
  run.failedCount = run.cases.filter(c => c.status === "unavailable" || c.passed === false).length;
  run.complete = run.cases.every(c => c.status === "complete" && c.passed === true);
}
function checkpoint(run: EvaluationRun): void { refresh(run); durableJson(join(run.directory, "run.json"), run); }
function initializeDirectory(root: string): string {
  const directory = resolve(root, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`);
  mkdirSync(directory, { recursive: true });
  for (const filename of ["attempts.jsonl", "cases.jsonl"]) writeFileSync(join(directory, filename), "", { flag: "wx" });
  return directory;
}
/** Execute one explicit local evaluation; operational caps are not authorization. */
export async function runEvaluation(suite: EvaluationSuite, options: EvaluationOptions): Promise<EvaluationRun> {
  if (options.mode === "live") {
    if (process.env.CI?.trim() || process.env.VERCEL?.trim() || process.env.VERCEL_ENV?.trim()) throw new Error("Live evaluation is forbidden in CI/Vercel processes.");
    if (!Number.isSafeInteger(options.maxRequests) || Number(options.maxRequests) <= 0 || !Number.isFinite(options.maxSpendUsd) || Number(options.maxSpendUsd) <= 0) throw new Error("Live requires explicit positive request and spend caps: --max-requests N --max-spend-usd USD.");
    if (!process.env.TYPESAFE_API_KEY?.trim()) throw new Error("TYPESAFE_API_KEY is absent; see docs/operations/jev.md.");
  }
  if (options.retryUnknown?.length && !options.resume) throw new Error("--retry-unknown requires --resume; start a new run otherwise.");
  safeName.parse(suite.id); safeName.parse(suite.questionVersion); safeName.parse(suite.policyVersion);
  if (!suite.cases.length || new Set(suite.cases.map(c => c.id)).size !== suite.cases.length) throw new Error("Suite requires distinct cases.");
  for (const item of suite.cases) { safeName.parse(item.id); safeName.parse(item.split); json.parse(item.input); json.parse(item.expected); json.parse(item.baseline); }
  if (options.caseId && !suite.cases.some(c => c.id === options.caseId)) throw new Error("Unknown case ID; use --list.");
  const identity = identitySchema.parse({ suiteId: suite.id, task: suite.task, model: JEV_MODEL, questionVersion: suite.questionVersion, policyVersion: suite.policyVersion,
    questionIdentity: suite.questionIdentity, questionDigest: hashJev(suite.questionIdentity), caseSetHash: hashJev(suite.cases.map(caseIdentity)), pricePolicy: PRICE_POLICY, source: sourceIdentity() });
  const previous = options.resume ? readResume(options.resume) : null;
  if (previous && (previous.evidenceKind !== options.mode || hashJev(previous.identity) !== hashJev(identity))) throw new Error("Resume identity changed (source/model/questions/cases); start a new run.");
  const inherited = previous?.attempts ?? [];
  const unknown = inherited.filter(e => e.event === "reserved" && !inherited.some(c => c.event === "completed" && c.attemptId === e.attemptId));
  if ((options.retryUnknown ?? []).some(id => !unknown.some(e => e.attemptId === id))) throw new Error("Unknown retry selection; select recorded unknown-completion attempt IDs or start a new run.");
  const priorAccounting = accounting(inherited, "none");
  if (options.mode === "live" && (priorAccounting.totalRequests > options.maxRequests! || priorAccounting.settledUsd + priorAccounting.reservedUsd > options.maxSpendUsd!)) throw new Error("Cumulative caps must cover all prior settled and reserved attempts; start a new capped run.");
  const directory = initializeDirectory(options.outputRoot ?? "test-results/jev");
  const runId = `jev-${randomUUID()}`;
  const run: EvaluationRun = { schemaVersion: 1, runId, createdAt: new Date().toISOString(), directory, evidenceKind: options.mode, importedFrom: null,
    resumedFrom: previous?.directory ?? null, identity, qualification: suite.qualification, attempts: [...inherited], complete: false, missingCount: suite.cases.length, failedCount: 0,
    budget: { maxRequests: options.maxRequests ?? null, maxSpendUsd: options.maxSpendUsd ?? null, ...accounting(inherited, runId) },
    cases: suite.cases.map(c => {
      const old = previous?.cases.find(item => item.id === c.id);
      return old ? { ...old, latencyKind: "replayed" as const } : { id: c.id, split: c.split, input: c.input, inputHash: hashJev(c.input), expected: c.expected, baseline: c.baseline,
        requests: c.requests as unknown as JevJsonValue[], status: "missing" as const, outcome: null, passed: null, reason: null, attemptIds: [], latencyMs: null,
        latencyKind: options.mode === "fixture" ? "fixture" as const : "fresh" as const, usage: null, costUsd: null, sourceRunId: runId };
    }) };
  for (const event of run.attempts) durableAppend(join(directory, "attempts.jsonl"), event);
  for (const item of run.cases) durableAppend(join(directory, "cases.jsonl"), item);
  checkpoint(run); options.onDirectory?.(directory);
  const originalKey = process.env.TYPESAFE_API_KEY;
  if (options.mode === "fixture") process.env.TYPESAFE_API_KEY = "jev-local-fixture-only";
  try {
    for (const item of suite.cases) {
      const row = run.cases.find(c => c.id === item.id)!;
      if ((options.caseId && item.id !== options.caseId) || row.status === "complete") continue;
      const pendingUnknown = unknown.filter(e => e.caseId === item.id);
      if (pendingUnknown.some(e => !options.retryUnknown?.includes(e.attemptId))) { row.status = "unknown_completion"; row.reason = "Explicit --retry-unknown selection is required; prior reservation retained."; durableAppend(join(directory, "cases.jsonl"), row); continue; }
      let requestIndex = 0, active = true, budgetBlocked = false;
      const caseAttemptIds: string[] = [];
      const transport: typeof globalThis.fetch = async (url, init) => {
        if (!active) throw new Error("Evaluation case already ended.");
        if (String(url) !== "https://api.typesafe.ai/v1/systemone") throw new Error("Only the pinned Jev endpoint is permitted.");
        const request = requestSchema.parse(JSON.parse(String(init?.body)));
        const planned = item.requests[requestIndex];
        if (!planned || hashJev(request) !== hashJev(requestBody(planned))) throw new Error("Actual request differs from frozen request plan.");
        refresh(run);
        if (options.mode === "live" && (run.budget.totalRequests + 1 > options.maxRequests! || run.budget.settledUsd + run.budget.reservedUsd + JEV_REQUEST_RESERVATION_USD > options.maxSpendUsd!)) { budgetBlocked = true; throw new Error("Budget exhausted before dispatch."); }
        const event: z.infer<typeof reservedSchema> = { schemaVersion: 1, event: "reserved", attemptId: `attempt-${randomUUID()}`, runId, caseId: item.id, requestIndex,
          requestHash: hashJev(request), request, recordedAt: new Date().toISOString(), evidenceKind: options.mode,
          reservedUsd: options.mode === "live" ? JEV_REQUEST_RESERVATION_USD : 0 };
        durableAppend(join(directory, "attempts.jsonl"), event); run.attempts.push(event); caseAttemptIds.push(event.attemptId); checkpoint(run);
        const fixture = item.fixtureResponses[requestIndex++];
        const response = options.mode === "fixture" ? (fixture ? Response.json(fixture.body, { status: fixture.status }) : (() => { throw new Error("Missing fixture HTTP response"); })()) : await (options.fetch ?? globalThis.fetch)(url, init);
        const text = await response.clone().text();
        let body: JevJsonValue;
        try { body = json.parse(JSON.parse(text)); } catch { body = text; }
        if (!active || init?.signal?.aborted) return response;
        const validated = response.status >= 200 && response.status < 300 ? validateJevResponse(body, request.questions as unknown as JevQuestions) : null;
        const usage = validated?.usage ?? null;
        const complete: z.infer<typeof completedSchema> = { schemaVersion: 1, event: "completed", attemptId: event.attemptId, runId, caseId: item.id, recordedAt: new Date().toISOString(),
          status: response.status, response: body, usage, costUsd: validated?.estimatedCostUsd ?? null };
        durableAppend(join(directory, "attempts.jsonl"), complete); run.attempts.push(complete); checkpoint(run);
        return response;
      };
      const start = performance.now();
      let result: EvaluationOutcome;
      try { result = await suite.evaluate(structuredClone(item.input), { fetch: transport }); json.parse(result.value); }
      catch { result = { value: null, unavailable: true, reason: "Evaluation failed; inspect the recorded case and request identity." }; }
      active = false;
      const incomplete = caseAttemptIds.some(id => !run.attempts.some(e => e.event === "completed" && e.attemptId === id));
      row.status = budgetBlocked ? "missing" : incomplete ? "unknown_completion" : result.unavailable ? "unavailable" : requestIndex !== item.requests.length ? "unavailable" : "complete";
      row.outcome = result.value; row.reason = budgetBlocked ? "Request/spend cap exhausted before dispatch; resume with explicit cumulative caps." : result.reason ?? (row.status === "unavailable" ? "Not every frozen request was completed." : null);
      row.passed = row.status === "complete" ? (suite.compare?.(result.value, item.expected) ?? hashJev(result.value) === hashJev(item.expected)) : null;
      row.attemptIds = caseAttemptIds; row.latencyMs = Math.max(0, performance.now() - start); row.latencyKind = options.mode === "fixture" ? "fixture" : "fresh"; row.sourceRunId = runId;
      const completions = run.attempts.filter(e => e.event === "completed" && caseAttemptIds.includes(e.attemptId)) as z.infer<typeof completedSchema>[];
      row.usage = completions.length && completions.every(e => e.usage?.inputTokens != null && e.usage.outputTokens != null) ? {
        inputTokens: completions.reduce((sum, e) => sum + (e.usage?.inputTokens ?? 0), 0), outputTokens: completions.reduce((sum, e) => sum + (e.usage?.outputTokens ?? 0), 0) } : null;
      row.costUsd = completions.length && completions.every(e => e.costUsd != null) ? completions.reduce((sum, e) => sum + (e.costUsd ?? 0), 0) : null;
      durableAppend(join(directory, "cases.jsonl"), row); checkpoint(run);
      if (budgetBlocked) break;
    }
  } finally {
    if (options.mode === "fixture") { if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = originalKey; }
  }
  checkpoint(run); writeFileSync(join(directory, "report.html"), renderJevReport(run));
  return run;
}
/** Imported records are inspectable claims, never authenticated provider evidence. */
export function inspectEvaluation(filename: string, outputRoot = "test-results/jev"): EvaluationRun {
  const record = readEvaluationRecord(resolve(filename));
  const directory = initializeDirectory(outputRoot);
  const imported: EvaluationRun = { ...record, directory, runId: `jev-${randomUUID()}`, createdAt: new Date().toISOString(), evidenceKind: "imported", importedFrom: record.evidenceKind,
    resumedFrom: null, cases: record.cases.map(c => ({ ...c, latencyKind: "imported" })) };
  refresh(imported);
  for (const event of imported.attempts) durableAppend(join(directory, "attempts.jsonl"), event);
  for (const item of imported.cases) durableAppend(join(directory, "cases.jsonl"), item);
  durableJson(join(directory, "run.json"), imported); writeFileSync(join(directory, "report.html"), renderJevReport(imported)); return imported;
}
