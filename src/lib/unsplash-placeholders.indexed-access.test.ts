import { describe, expect, it } from "vitest";
import { getPlaceholderForStory, UNSPLASH_POOLS } from "./unsplash-placeholders";

describe("placeholder pool indexed boundary", () => {
  it("reports an absent selected image and succeeds after the pool is restored", () => {
    const original = UNSPLASH_POOLS.nature;
    const expected = getPlaceholderForStory("", "nature");
    try {
      UNSPLASH_POOLS.nature = [];
      expect(() => getPlaceholderForStory("", "nature")).toThrow("Missing placeholder image for category nature");
    } finally { UNSPLASH_POOLS.nature = original; }
    expect(getPlaceholderForStory("", "nature")).toEqual(expected);
  });
});
