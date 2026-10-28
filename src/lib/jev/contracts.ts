/** Shared, secret-free Jev contracts; runtime decisions remain in domain code. */
import type { ChoiceQuestion, NoulQuestion, SystemOneResult } from "@typesafe-ai/sdk";

export const JEV_MODEL = "jev-1.14.0";
export const JEV_POLICY_VERSION = "jev-conservative-v1";
export const JEV_INPUT_USD_PER_MILLION = 0.042;
export const JEV_MAX_PAYLOAD_BYTES = 32 * 1024;
export const JEV_INTERACTIVE_DEADLINE_MS = 1200;
export const JEV_EVALUATION_DEADLINE_MS = 10_000;
export const JEV_POSITIVE_THRESHOLD = 0.90;
export const JEV_NEGATIVE_THRESHOLD = 0.10;
export const JEV_CHOICE_MARGIN = 0.20;

export type JevRuntimeTask = "booking_intake" | "experience_match";
export type JevTask = JevRuntimeTask | "provider_contract" | "call_outcome" | "evidence";
export type JevQuestions = Record<string, NoulQuestion | ChoiceQuestion>;
export type JevState = string | { [key: string]: JevJsonValue } | JevJsonValue[];
export type JevJsonValue = string | number | boolean | null | JevJsonValue[] | { [key: string]: JevJsonValue };
export interface JevQuestionSet<Q extends JevQuestions = JevQuestions> { version: string; questions: Q }
export type JevContext =
  | { mode: "runtime"; task: JevRuntimeTask }
  | { mode: "evaluation"; task: JevTask; authorized: true };
export type JevUnavailableReason = "disabled" | "not_configured" | "invalid_config" | "deadline" | "aborted" | "rate_limited" | "provider_error" | "invalid_response";
export interface JevUsage { inputTokens: number | null; outputTokens: number | null }
export interface JevMetadata {
  model: typeof JEV_MODEL;
  questionVersion: string;
  elapsedMs: number;
  usage: JevUsage | null;
  estimatedCostUsd: number | null;
  requestId: string;
}
export type JevResult<Q extends JevQuestions = JevQuestions> =
  | (JevMetadata & { status: "answered"; answers: SystemOneResult<Q>["answers"] })
  | (JevMetadata & { status: "unavailable"; reason: JevUnavailableReason; message: string });
