import { describe, expect, it } from "vitest";
import { requiredValue } from "./required-value";

describe("requiredValue fixture boundary", () => {
  it("preserves the exact existing value, including falsy values and object identity", () => {
    const fixture = { value: "original" };
    expect(requiredValue(fixture, "fixture object")).toBe(fixture);
    expect(requiredValue(0, "zero")).toBe(0);
    expect(requiredValue(false, "false")).toBe(false);
    expect(requiredValue("", "empty string")).toBe("");
  });

  it("preserves null because only a missing indexed value is rejected", () => {
    expect(requiredValue(null, "nullable fixture")).toBeNull();
  });

  it("throws a contextual failure for missing fixture data and accepts corrected data", () => {
    const fixtures: string[] = [];
    expect(() => requiredValue(fixtures[0], "bookings fixture[0]")).toThrow(
      "Missing required fixture value: bookings fixture[0]",
    );
    fixtures.push("recovered");
    expect(requiredValue(fixtures[0], "bookings fixture[0]")).toBe("recovered");
  });
});
