// Strip control chars except \n, and strip zero-width characters
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B\u200C\u200D\uFEFF]/g;
// Collapse 2+ whitespace chars to single space
const COLLAPSE_WHITESPACE_REGEX = /\s{2,}/g;

/**
 * Normalize user-supplied text: trim, strip control/zero-width chars, and
 * collapse runs of whitespace. Used by the chat Zod schema (BE-L3 #524) to
 * sanitize message/context in a single validation path.
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(COLLAPSE_WHITESPACE_REGEX, ' ');
}
