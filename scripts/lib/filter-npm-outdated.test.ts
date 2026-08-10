import { describe, expect, it } from "vitest";
import { filterOutdatedPackages, formatOutdatedPackages } from "./filter-npm-outdated";

describe("filterOutdatedPackages", () => {
  it("keeps real upgrades and removes installed-ahead-of-latest dist-tag artifacts", () => {
    const filtered = filterOutdatedPackages({
      next: { current: "16.2.7", wanted: "16.2.9", latest: "16.2.9" },
      jsdom: { current: "29.1.1", wanted: "29.1.1", latest: "27.0.1" },
      vitest: { current: "4.1.8", wanted: "4.1.8", latest: "3.2.6" },
      "custom-range": { current: "workspace:*", wanted: "workspace:*", latest: "workspace:*" },
    });

    expect(filtered).toEqual({
      next: { current: "16.2.7", wanted: "16.2.9", latest: "16.2.9" },
      "custom-range": { current: "workspace:*", wanted: "workspace:*", latest: "workspace:*" },
    });
  });

  it("formats package names the same way the security report expects", () => {
    expect(formatOutdatedPackages({
      next: { current: "16.2.7", latest: "16.2.9" },
    })).toBe("next: 16.2.7 -> 16.2.9");
  });
});
