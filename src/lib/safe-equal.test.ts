import { timingSafeEqual } from "crypto";
import { describe, expect, it } from "vitest";
import { safeEqual } from "./safe-equal";

/**
 * DO-H6: a multibyte character (e.g. "€") is a single UTF-16 code unit but
 * three UTF-8 bytes. Guarding `timingSafeEqual` with JS string `.length`
 * (code units) instead of Buffer byte length lets such input slip past the
 * length check and crash `timingSafeEqual` with an unhandled `RangeError`.
 */
const REAL_SECRET = "a".repeat(24);
const SAME_CODE_UNIT_COUNT_DIFFERENT_BYTE_LENGTH = "€".repeat(REAL_SECRET.length);

describe("the pre-fix `.length` guard pattern (regression proof)", () => {
  it("throws RangeError for multibyte input whose UTF-16 length matches the secret's", () => {
    const provided = SAME_CODE_UNIT_COUNT_DIFFERENT_BYTE_LENGTH;

    // Sanity: the vulnerable pattern's length guard passes...
    expect(provided.length).toBe(REAL_SECRET.length);
    // ...but the actual byte lengths differ, which is exactly what crashes it.
    expect(Buffer.from(provided).length).not.toBe(Buffer.from(REAL_SECRET).length);

    // This is the literal buggy comparison pattern that shipped in
    // cron-auth.ts, mcp-auth.ts, csrf.ts, health/route.ts, and the webhook
    // routes before this fix: guard on string `.length`, then call
    // timingSafeEqual unconditionally.
    const runVulnerablePattern = () => {
      if (provided.length !== REAL_SECRET.length) {
        return false;
      }
      return timingSafeEqual(Buffer.from(provided), Buffer.from(REAL_SECRET));
    };

    expect(runVulnerablePattern).toThrow(RangeError);
  });
});

describe("safeEqual", () => {
  it("returns true for the exact correct secret", () => {
    expect(safeEqual(REAL_SECRET, REAL_SECRET)).toBe(true);
  });

  it("returns false for a wrong value of the same byte length", () => {
    expect(safeEqual("b".repeat(24), REAL_SECRET)).toBe(false);
  });

  it("returns false, not throw, for values of different lengths", () => {
    expect(() => safeEqual("short", REAL_SECRET)).not.toThrow();
    expect(safeEqual("short", REAL_SECRET)).toBe(false);
  });

  it("returns false, not throw, for multibyte input with the same UTF-16 length as the secret", () => {
    const provided = SAME_CODE_UNIT_COUNT_DIFFERENT_BYTE_LENGTH;

    expect(() => safeEqual(provided, REAL_SECRET)).not.toThrow();
    expect(safeEqual(provided, REAL_SECRET)).toBe(false);
  });

  it("returns false, not throw, for multibyte input with the same UTF-8 byte length as the secret", () => {
    // "é" is 2 bytes in UTF-8. 12 of them = 24 bytes, matching REAL_SECRET's
    // byte length exactly — this exercises the real timingSafeEqual call
    // (equal byte length) rather than the length short-circuit.
    const sameByteLength = "é".repeat(12);
    expect(Buffer.from(sameByteLength).length).toBe(Buffer.from(REAL_SECRET).length);

    expect(() => safeEqual(sameByteLength, REAL_SECRET)).not.toThrow();
    expect(safeEqual(sameByteLength, REAL_SECRET)).toBe(false);
  });

  it("returns false for empty vs non-empty", () => {
    expect(safeEqual("", REAL_SECRET)).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(safeEqual("", "")).toBe(true);
  });
});
