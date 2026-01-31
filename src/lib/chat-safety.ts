/**
 * Chat safety module for input/output filtering and validation.
 * Provides protection against prompt injection, off-topic queries, and output leakage.
 */

/** Maximum allowed input message length */
export const MAX_INPUT_LENGTH = 2000;

/** Maximum conversation turns before suggesting a fresh start */
export const MAX_CONVERSATION_TURNS = 20;

/** Topic relevance classification for analytics */
export type TopicRelevance = "likely_relevant" | "uncertain" | "likely_off_topic";

/** Patterns that indicate potential prompt injection attempts */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(your\s+)?(previous|all)\s+instructions/i,
  /ignore\s+your\s+instructions/i,
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
  /pretend\s+(you're|you\s+are|to\s+be)/i,
  /roleplay\s+as/i,
  /override\s+(your|the|all)/i,
  /disregard\s+(your|the|all|previous)/i,
];

/**
 * Keywords indicating tourism relevance for this location.
 *
 * LOCATION-SPECIFIC: Replace all keywords with your location's:
 * - Place names (cities, landmarks, regions)
 * - Local food and drinks
 * - Activities and attractions
 * - Cultural terms
 */
const ASTURIAS_KEYWORDS: string[] = [
  // LOCATION-SPECIFIC: Place names
  "asturias", "oviedo", "gijón", "gijon", "avilés", "aviles",
  "covadonga", "picos", "europa", "lagos", "cangas", "onís", "onis",
  "llanes", "ribadesella", "cudillero", "luarca", "tapia", "navia",
  // LOCATION-SPECIFIC: Food & drink
  "sidra", "cider", "fabada", "cachopo", "cabrales", "queso", "cheese",
  "sidrería", "sidreria", "espicha", "culín", "culin",
  // LOCATION-SPECIFIC: Activities and landmarks
  "senda", "cares", "ruta", "route", "hiking", "senderismo", "playa", "beach",
  "surf", "camino", "santiago", "prerrománico", "preromanico", "naranco",
  // General tourism (not location-specific)
  "restaurante", "restaurant", "hotel", "hostel", "albergue",
  "visitar", "visit", "turismo", "tourism", "tourist",
  "viajar", "travel", "viaje", "trip", "vacaciones", "vacation", "holiday",
  // LOCATION-SPECIFIC: Cultural terms
  "asturiano", "asturian", "bable", "gaita", "hórreo", "horreo",
];

/** Keywords indicating off-topic queries */
const OFF_TOPIC_KEYWORDS: string[] = [
  // Cooking
  "receta", "recipe", "cocinar", "cook", "cooking",
  "ingredientes", "ingredients", "preparar", "prepare",
  "hornear", "bake", "freír", "fry", "hervir", "boil",
  // Tech
  "código", "code", "programar", "programming", "program",
  "python", "javascript", "java", "html", "css", "api",
  "software", "hardware", "computer", "ordenador",
  // Finance
  "bitcoin", "crypto", "cryptocurrency", "inversión", "investment",
  "acciones", "stocks", "trading", "forex",
  // Other
  "homework", "tarea", "essay", "ensayo", "exam", "examen",
];

/** Fragments that indicate system prompt leakage */
const LEAKED_PROMPT_INDICATORS: string[] = [
  "system prompt",
  "my instructions",
  "i was told to",
  "i am programmed to",
  "my programming",
  "my guidelines say",
  "according to my instructions",
  "IDENTITY",
  "SCOPE",
  "SECURITY RULES",
  "INVIOLABLE",
  "FORBIDDEN topics",
  "ALLOWED topics",
  "RESPONSE PROCESS",
  "REDIRECTS",
];

/**
 * Detects potential prompt injection attempts in user input.
 * @param input - The user's message
 * @returns true if injection attempt detected
 */
export function detectInjectionAttempt(input: string): boolean {
  if (!input || typeof input !== "string") {
    return false;
  }
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
  if (!input || typeof input !== "string") {
    return "";
  }

  let sanitized = input
    // Remove potential code block delimiters
    .replace(/```/g, "")
    // Remove horizontal rules that could be used as delimiters
    .replace(/---+/g, "")
    // Remove XML-like tags that could be used for injection
    .replace(/<\/?system>/gi, "")
    .replace(/<\/?instructions?>/gi, "")
    .replace(/<\/?prompt>/gi, "")
    .replace(/<\/?user>/gi, "")
    .replace(/<\/?assistant>/gi, "")
    .replace(/<\/?human>/gi, "")
    // Remove potential markdown headers used as delimiters
    .replace(/^#{1,6}\s*(SYSTEM|INSTRUCTIONS?|PROMPT)/gim, "");

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
  if (!input || typeof input !== "string") {
    return "uncertain";
  }

  const lower = input.toLowerCase();

  const hasAsturiasKeyword = ASTURIAS_KEYWORDS.some((k) => lower.includes(k));
  const hasOffTopicKeyword = OFF_TOPIC_KEYWORDS.some((k) => lower.includes(k));

  if (hasAsturiasKeyword && !hasOffTopicKeyword) {
    return "likely_relevant";
  }
  if (hasOffTopicKeyword && !hasAsturiasKeyword) {
    return "likely_off_topic";
  }
  return "uncertain";
}

/**
 * Detects if the output contains leaked system prompt content.
 * @param output - The assistant's response
 * @returns true if prompt leakage detected
 */
export function detectPromptLeakage(output: string): boolean {
  if (!output || typeof output !== "string") {
    return false;
  }

  const lowerOutput = output.toLowerCase();
  return LEAKED_PROMPT_INDICATORS.some((indicator) =>
    lowerOutput.includes(indicator.toLowerCase())
  );
}

/**
 * Validates that a message meets basic requirements.
 * @param message - The message to validate
 * @returns Validation result with error message if invalid
 */
export function validateMessage(message: unknown): {
  valid: boolean;
  error?: string;
} {
  if (message === null || message === undefined) {
    return { valid: false, error: "Message is required" };
  }

  if (typeof message !== "string") {
    return { valid: false, error: "Message must be a string" };
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Message cannot be empty" };
  }

  if (trimmed.length > MAX_INPUT_LENGTH) {
    return {
      valid: false,
      error: `Message exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
    };
  }

  return { valid: true };
}
