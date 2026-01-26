import { describe, it, expect } from "vitest";
import { fisherYatesShuffle } from "./shuffle";

describe("fisherYatesShuffle", () => {
  it("should return a new array (not mutate original)", () => {
    const original = [1, 2, 3, 4, 5];
    const originalCopy = [...original];
    const shuffled = fisherYatesShuffle(original, 42);

    expect(original).toEqual(originalCopy);
    expect(shuffled).not.toBe(original);
  });

  it("should contain all original elements", () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = fisherYatesShuffle(original, 42);

    expect(shuffled).toHaveLength(original.length);
    expect(shuffled.sort((a, b) => a - b)).toEqual(
      original.sort((a, b) => a - b)
    );
  });

  it("should produce deterministic output with the same seed", () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result1 = fisherYatesShuffle(array, 123);
    const result2 = fisherYatesShuffle(array, 123);

    expect(result1).toEqual(result2);
  });

  it("should produce different output with different seeds", () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result1 = fisherYatesShuffle(array, 1);
    const result2 = fisherYatesShuffle(array, 2);

    expect(result1).not.toEqual(result2);
  });

  it("should handle empty arrays", () => {
    const result = fisherYatesShuffle([], 42);
    expect(result).toEqual([]);
  });

  it("should handle single-element arrays", () => {
    const result = fisherYatesShuffle([42], 99);
    expect(result).toEqual([42]);
  });

  it("should produce non-identical output for arrays > 2 elements (statistical)", () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const runs = 20;
    let identicalCount = 0;

    for (let i = 0; i < runs; i++) {
      const shuffled = fisherYatesShuffle(array);
      if (JSON.stringify(shuffled) === JSON.stringify(array)) {
        identicalCount++;
      }
    }

    // It is statistically nearly impossible for all 20 random shuffles
    // to produce the original order (1 in 10!^20).
    // Allow at most 1 identical result as a generous margin.
    expect(identicalCount).toBeLessThan(runs);
  });
});
