import { describe, it, expect } from "vitest";
import { revalidate } from "./layout";

describe("TermsLayout", () => {
  it("should export revalidate set to 3600 (1 hour ISR)", () => {
    expect(revalidate).toBe(3600);
  });
});
