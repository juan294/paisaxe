import { describe, expect, it } from "vitest";
import { getPlaceholderForStory, UNSPLASH_POOLS } from "./unsplash-placeholders";
import { NEUTRAL_CREDIT, NEUTRAL_IMAGE } from "./image-provenance";

describe("retired placeholder pool boundary", () => {
  it("keeps the disclosed neutral asset even if the legacy pool is empty or restored", () => {
    const original = UNSPLASH_POOLS.nature;
    const expected = { image: NEUTRAL_IMAGE, imageSource: NEUTRAL_CREDIT };
    expect(getPlaceholderForStory("", "nature")).toEqual(expected);
    try {
      UNSPLASH_POOLS.nature = [];
      expect(getPlaceholderForStory("", "nature")).toEqual(expected);
    } finally { UNSPLASH_POOLS.nature = original; }
    expect(getPlaceholderForStory("", "nature")).toEqual(expected);
  });
});
