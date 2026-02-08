import { describe, expect, it } from "vitest";
import { buildDomainFilter } from "./analytics-filter";

describe("buildDomainFilter", () => {
  it("returns empty string when includeDev is true", () => {
    expect(buildDomainFilter(true)).toBe("");
  });

  it("returns production-only filter when includeDev is false", () => {
    const filter = buildDomainFilter(false);
    expect(filter).toContain("paisaxe.es");
    expect(filter).toContain("paisaxe.com");
    expect(filter).toMatch(/^AND \(/);
  });

  it("excludes localhost when includeDev is false", () => {
    const filter = buildDomainFilter(false);
    // The filter only includes production domains, so localhost is implicitly excluded
    expect(filter).not.toContain("localhost");
  });

  it("excludes tunnel domains when includeDev is false", () => {
    const filter = buildDomainFilter(false);
    // Tunnel domains are excluded because only production domains match
    expect(filter).not.toContain("tunnelfor");
  });

  it("uses OR to match any production domain", () => {
    const filter = buildDomainFilter(false);
    expect(filter).toContain(" OR ");
  });
});
