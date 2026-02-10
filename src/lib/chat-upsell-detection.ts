/**
 * Upsell marker detection for chat responses.
 *
 * Claude embeds [[VOICE_UPSELL:reason]] markers in responses when it detects
 * that the user's question would benefit from voice agent capabilities.
 * This utility extracts the marker and cleans the response content.
 */

/** Reasons that trigger a voice upsell prompt */
export type UpsellReason = "weather" | "booking" | "realtime" | "slow_typing";

/** Result of checking a message for upsell markers */
interface UpsellDetectionResult {
  /** Whether an upsell marker was found */
  hasUpsell: boolean;
  /** The reason for the upsell, if found */
  reason: UpsellReason | null;
  /** The message content with the marker removed */
  cleanContent: string;
}

/** Valid upsell reasons for type narrowing */
const VALID_REASONS = new Set<UpsellReason>([
  "weather",
  "booking",
  "realtime",
  "slow_typing",
]);

/** Regex to match upsell markers at the end of content */
const UPSELL_MARKER_REGEX = /\s*\[\[VOICE_UPSELL:(\w+)\]\]\s*$/;

/**
 * Detects and extracts upsell markers from chat response content.
 *
 * @param content - The raw message content from Claude
 * @returns Detection result with cleaned content and optional reason
 *
 * @example
 * ```ts
 * const result = detectUpsellMarker("I can't check weather... [[VOICE_UPSELL:weather]]");
 * // { hasUpsell: true, reason: "weather", cleanContent: "I can't check weather..." }
 * ```
 */
export function detectUpsellMarker(content: string): UpsellDetectionResult {
  const match = content.match(UPSELL_MARKER_REGEX);

  if (!match) {
    return { hasUpsell: false, reason: null, cleanContent: content };
  }

  const potentialReason = match[1];

  // Validate the reason is one we recognize
  if (!VALID_REASONS.has(potentialReason as UpsellReason)) {
    return { hasUpsell: false, reason: null, cleanContent: content };
  }

  return {
    hasUpsell: true,
    reason: potentialReason as UpsellReason,
    cleanContent: content.replace(UPSELL_MARKER_REGEX, "").trim(),
  };
}
