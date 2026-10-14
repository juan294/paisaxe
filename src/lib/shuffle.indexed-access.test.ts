import { afterEach, describe, expect, it, vi } from "vitest";
import { fisherYatesShuffle } from "./shuffle";

afterEach(() => { vi.restoreAllMocks(); });

describe("generic shuffle indexed boundary", () => {
  it("preserves legitimate undefined values and densifies sparse slots as before", () => {
    const input: Array<number | undefined> = [1, undefined, 2];
    input.length = 4;
    const result = fisherYatesShuffle(input, 42);
    expect(result).toHaveLength(4);
    expect(result.filter(value => value === undefined)).toHaveLength(2);
    expect(result.filter((value): value is number => value !== undefined).sort()).toEqual([1, 2]);
    expect(3 in result).toBe(true);
    expect(3 in input).toBe(false);
  });

  it("rejects an out-of-range random selection without mutation, then recovers", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(1);
    const input = [1, 2, 3];
    expect(() => fisherYatesShuffle(input)).toThrow("Shuffle selected an out-of-range index");
    expect(input).toEqual([1, 2, 3]);
    random.mockReturnValue(0);
    expect(fisherYatesShuffle(input)).toEqual([2, 3, 1]);
  });
});
