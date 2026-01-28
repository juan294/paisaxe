/**
 * Chat safety module for input/output filtering and validation.
 * Provides protection against prompt injection, off-topic queries, and output leakage.
 *
 * NOTE: This is a stub file. The full implementation will be merged from
 * the feature/chat-safety-module branch.
 */

/** Maximum allowed input message length */
export const MAX_INPUT_LENGTH = 2000;

/** Maximum conversation turns before suggesting a fresh start */
export const MAX_CONVERSATION_TURNS = 20;

/** Topic relevance classification for analytics */
export type TopicRelevance = "likely_relevant" | "uncertain" | "likely_off_topic";

/** Patterns that indicate potential prompt injection attempts */
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|your)\s+instructions/i,
  /forget\s+(everything|your\s+instructions)/i,
  /new\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now/i,
  /act\s+as\s+(a|an)\s+(?!tourist|guide|local)/i,
  /developer\s+mode/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /bypass\s+(your|the)\s+(rules|filters)/i,
  /repeat\s+(your|the)\s+instructions/i,
  /what\s+are\s+your\s+instructions/i,
  /reveal\s+(your|the)\s+prompt/i,
];

/** Keywords indicating Asturias tourism relevance */
const ASTURIAS_KEYWORDS = [
  "asturias",
  "oviedo",
  "gijón",
  "gijon",
  "avilés",
  "aviles",
  "covadonga",
  "picos",
  "sidra",
  "fabada",
  "cachopo",
  "playa",
  "beach",
  "camino",
  "santiago",
  "prerrománico",
  "naranco",
  "senda",
  "cares",
  "lagos",
  "restaurante",
  "restaurant",
  "hotel",
  "visitar",
  "visit",
  "turismo",
  "tourism",
  "viajar",
  "travel",
  "viaje",
  "trip",
  "vacaciones",
  "vacation",
];

/** Keywords indicating off-topic queries */
const OFF_TOPIC_KEYWORDS = [
  "receta",
  "recipe",
  "cocinar",
  "cook",
  "ingredientes",
  "ingredients",
  "preparar",
  "prepare",
  "código",
  "code",
  "programar",
  "programming",
  "python",
  "javascript",
  "bitcoin",
  "crypto",
  "inversión",
  "investment",
];

/** Fragments that indicate system prompt leakage */
const LEAKED_PROMPT_INDICATORS = [
  "system prompt",
  "my instructions",
  "i was told to",
  "i am programmed to",
  "my programming",
  "IDENTITY",
  "SCOPE",
  "SECURITY RULES",
  "INVIOLABLE",
  "FORBIDDEN topics",
  "ALLOWED topics",
];

/**
 * Detects potential prompt injection attempts in user input.
 * @param input - The user's message
 * @returns true if injection attempt detected
 */
export function detectInjectionAttempt(input: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Sanitizes user input by removing potential delimiter injection and limiting length.
 * @param input - The user's message
 * @param maxLength - Maximum allowed length (default: MAX_INPUT_LENGTH)
 * @returns Sanitized input string
 */
export function sanitizeInput(
  input: string,
  maxLength: number = MAX_INPUT_LENGTH
): string {
  let sanitized = input
    // Remove potential delimiter injection
    .replace(/```/g, "")
    .replace(/---+/g, "")
    .replace(/<\/?system>/gi, "")
    .replace(/<\/?instructions?>/gi, "")
    .replace(/<\/?prompt>/gi, "");

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Assesses whether the input is likely related to Asturias tourism.
 * Used for analytics and logging, not for blocking.
 * @param input - The user's message
 * @returns Topic relevance classification
 */
export function assessTopicRelevance(input: string): TopicRelevance {
  const lower = input.toLowerCase();

  const hasAsturiasKeyword = ASTURIAS_KEYWORDS.some((k) => lower.includes(k));
  const hasOffTopicKeyword = OFF_TOPIC_KEYWORDS.some((k) => lower.includes(k));

  if (hasAsturiasKeyword && !hasOffTopicKeyword) return "likely_relevant";
  if (hasOffTopicKeyword && !hasAsturiasKeyword) return "likely_off_topic";
  return "uncertain";
}

/**
 * Detects if the output contains leaked system prompt content.
 * @param output - The assistant's response
 * @returns true if prompt leakage detected
 */
export function detectPromptLeakage(output: string): boolean {
  const lowerOutput = output.toLowerCase();
  return LEAKED_PROMPT_INDICATORS.some((indicator) =>
    lowerOutput.includes(indicator.toLowerCase())
  );
}
