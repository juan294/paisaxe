import "server-only";
import { randomUUID } from "node:crypto";
import { APIError, APITimeoutError, TypeSafeClient, type SystemOneResult } from "@typesafe-ai/sdk";
import { logger } from "@/lib/logger";
import { getJevConfiguration } from "./config";
import {
  JEV_MODEL, JEV_INPUT_USD_PER_MILLION, JEV_MAX_PAYLOAD_BYTES,
  JEV_INTERACTIVE_DEADLINE_MS, JEV_EVALUATION_DEADLINE_MS,
  type JevContext, type JevMetadata, type JevQuestionSet, type JevQuestions,
  type JevResult, type JevState, type JevUnavailableReason, type JevUsage,
} from "./contracts";

export interface JevOptions {
  /** Provider boundary injection for deterministic local tests; no environment endpoint override. */
  fetch?: typeof globalThis.fetch;
  /** Can shorten, never extend, the mode's total deadline. */
  timeoutMs?: number;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function probability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function sameKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function validJson(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(validJson);
  return record(value) && Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every(validJson);
}
function nonempty(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 :
    Array.isArray(value) ? value.length > 0 : record(value) && Object.keys(value).length > 0;
}
function validAnswers(answers: unknown, questions: JevQuestions): boolean {
  if (!record(answers) || !sameKeys(answers, Object.keys(questions))) return false;
  return Object.entries(questions).every(([key, question]) => {
    const answer = answers[key];
    if (!record(answer) || answer.type !== question.type) return false;
    if (question.type === "noul") return sameKeys(answer, ["type", "noul"]) && probability(answer.noul);
    const ids = Object.keys(question.criteria);
    if (!record(answer.probabilities) || !sameKeys(answer.probabilities, ids) || !Object.values(answer.probabilities).every(probability)) return false;
    if (Math.abs(Object.values(answer.probabilities).reduce<number>((sum, value) => sum + Number(value), 0) - 1) > 0.001) return false;
    if (!probability(answer.confidence)) return false;
    return sameKeys(answer, ["type", "choice", "confidence", "probabilities"]) && typeof answer.choice === "string" && ids.includes(answer.choice);
  });
}
function parseUsage(raw: unknown): JevUsage | null | false {
  if (raw == null) return null;
  if (!record(raw)) return false;
  const token = (value: unknown) => value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
  if (!token(raw.input_tokens) || !token(raw.output_tokens)) return false;
  return { inputTokens: raw.input_tokens as number | null, outputTokens: raw.output_tokens as number | null };
}

/** Shared strict protocol validation for the adapter and offline spend settlement. */
export function validateJevResponse<Q extends JevQuestions>(response: unknown, questions: Q): { answers: SystemOneResult<Q>["answers"]; usage: JevUsage | null; estimatedCostUsd: number | null } | null {
  if (!record(response) || response.model !== JEV_MODEL || !validAnswers(response.answers, questions)) return null;
  const usage = parseUsage(response.usage);
  if (usage === false || (usage?.inputTokens != null && usage.inputTokens > 65536)) return null;
  return { answers: response.answers as SystemOneResult<Q>["answers"], usage,
    estimatedCostUsd: usage?.inputTokens == null ? null : usage.inputTokens * JEV_INPUT_USD_PER_MILLION / 1_000_000 };
}

/** Bound even a custom transport that fails to observe cancellation. */
function untilAborted<T>(start: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("aborted")); return; }
    const onAbort = () => reject(new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(start()).then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/** One no-retry SDK request; transport errors never become semantic false. */
export async function askJev<Q extends JevQuestions>(
  questionSet: JevQuestionSet<Q>, state: JevState, context: JevContext,
  signal?: AbortSignal, options: JevOptions = {},
): Promise<JevResult<Q>> {
  const start = performance.now();
  const metadata: JevMetadata = {
    model: JEV_MODEL, questionVersion: /^[a-zA-Z0-9_.-]{1,100}$/.test(questionSet.version) ? questionSet.version : "invalid",
    requestId: randomUUID(), elapsedMs: 0, usage: null, estimatedCostUsd: null,
  };
  const finish = (result: JevResult<Q>): JevResult<Q> => {
    result.elapsedMs = Math.max(0, performance.now() - start);
    logger.info("[JEV_DECISION]", {
      task: ["booking_intake", "experience_match", "provider_contract", "call_outcome", "evidence"].includes(context.task) ? context.task : "invalid",
      question_version: metadata.questionVersion, model: JEV_MODEL, request_id: metadata.requestId,
      latency_ms: result.elapsedMs, outcome: result.status,
      reason: result.status === "unavailable" ? result.reason : null,
      input_tokens: result.usage?.inputTokens ?? null, output_tokens: result.usage?.outputTokens ?? null,
      estimated_cost_usd: result.estimatedCostUsd,
    });
    return result;
  };
  const unavailable = (reason: JevUnavailableReason, message: string) => finish({ ...metadata, status: "unavailable", reason, message });
  if (signal?.aborted) return unavailable("aborted", "Jev request cancelled.");
  const config = getJevConfiguration();
  if (!config.available) return unavailable(config.reason, config.message);
  if (context.mode === "runtime" && !config.tasks.includes(context.task)) return unavailable("disabled", "JEV_ENABLED_TASKS does not enable this task. See docs/operations/jev.md.");
  if (context.mode !== "runtime" && (context.mode !== "evaluation" || context.authorized !== true)) return unavailable("disabled", "Explicit evaluation context is required.");
  try {
    if (!nonempty(state) || !validJson(state) || metadata.questionVersion === "invalid" || !nonempty(questionSet.questions) || !validJson(questionSet.questions)) {
      return unavailable("invalid_config", "Jev requires nonempty JSON state and a versioned text question set. See docs/operations/jev.md.");
    }
    if (Object.values(questionSet.questions).some(question => !["noul", "choice"].includes(question.type))) {
      return unavailable("invalid_config", "Jev accepts text Noul and Choice questions only.");
    }
    if (Buffer.byteLength(JSON.stringify({ state, questions: questionSet.questions }), "utf8") > JEV_MAX_PAYLOAD_BYTES) {
      return unavailable("invalid_config", `Jev state and questions exceed the ${JEV_MAX_PAYLOAD_BYTES} byte UTF-8 limit; reduce the supplied input.`);
    }
  } catch {
    return unavailable("invalid_config", "Jev requires acyclic JSON input within the 32768 byte UTF-8 limit.");
  }
  const modeLimit = context.mode === "runtime" ? JEV_INTERACTIVE_DEADLINE_MS : JEV_EVALUATION_DEADLINE_MS;
  const requestedLimit = Math.min(modeLimit, options.timeoutMs ?? modeLimit);
  const limit = requestedLimit - (performance.now() - start);
  if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) return unavailable("invalid_config", "Jev deadline must be a positive finite number.");
  if (limit <= 0) return unavailable("deadline", "Jev preflight exceeded its total deadline.");
  const controller = new AbortController();
  let deadline = false;
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(() => { deadline = true; controller.abort(); }, limit);
  try {
    const client = new TypeSafeClient({
      apiKey: config.apiKey, baseURL: "https://api.typesafe.ai", defaultModel: JEV_MODEL,
      logLevel: "off", retry: { maxRetries: 0 }, timeout: limit,
      compression: false, fetch: options.fetch,
    });
    const response: unknown = await untilAborted(() => client.systemOne({ model: JEV_MODEL, state, questions: questionSet.questions }, { signal: controller.signal, timeout: limit, retry: { maxRetries: 0 } }), controller.signal);
    if (controller.signal.aborted) return unavailable(deadline ? "deadline" : "aborted", "Jev request ended before a valid response.");
    const validated = validateJevResponse(response, questionSet.questions);
    if (!validated) return unavailable("invalid_response", "Jev returned invalid model, answers, candidate IDs, probabilities or usage.");
    return finish({ ...metadata, status: "answered", ...validated });
  } catch (error) {
    if (controller.signal.aborted || signal?.aborted) return unavailable(deadline ? "deadline" : "aborted", "Jev request ended before a valid response.");
    if (error instanceof APITimeoutError) return unavailable("deadline", "Jev request exceeded its deadline.");
    if (error instanceof APIError && error.status === 429) return unavailable("rate_limited", "Jev rate limited this request; retry only with a new explicit request.");
    return unavailable("provider_error", "Jev provider request failed; no semantic answer is available.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
