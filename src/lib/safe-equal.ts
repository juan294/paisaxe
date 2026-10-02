import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison, safe for multibyte-character input.
 *
 * DO-H6: `timingSafeEqual` throws a `RangeError` when its two buffers differ
 * in BYTE length. Several call sites across this repo guarded the call by
 * comparing JS string `.length` (UTF-16 code units) instead. A multibyte
 * character (e.g. "€") is one UTF-16 code unit but three UTF-8 bytes, so an
 * attacker-supplied header of the right *code-unit* count but wrong *byte*
 * count slips past the `.length` guard and crashes `timingSafeEqual` with an
 * unhandled `RangeError`. On `/api/health` this happened before the route's
 * `try` block even opened, turning an unauthenticated request into an
 * HTTP 500 on an endpoint whose entire contract is "always 200".
 *
 * This compares `Buffer` byte length first. Buffers of unequal byte length
 * are trivially distinguishable without calling `timingSafeEqual` — the
 * short-circuit only leaks that the lengths differ (which the original
 * `.length` check already exposed), never anything about the secret's
 * content, so this stays genuinely constant-time for the equal-length case
 * that actually matters: comparing candidate values against the real secret.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
