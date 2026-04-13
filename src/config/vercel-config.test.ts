import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard for issue #239.
// Multi-region function deployment requires the Enterprise plan; paisaxe
// is on Pro, so vercel.json must list exactly one region. If this test
// fails, Vercel's PR status check will go red and may mask real deploy
// failures.
describe("vercel.json", () => {
  const vercelConfig = JSON.parse(
    readFileSync(join(process.cwd(), "vercel.json"), "utf-8"),
  ) as { regions?: unknown };

  it("declares exactly one region (Pro plan limit)", () => {
    expect(Array.isArray(vercelConfig.regions)).toBe(true);
    expect(vercelConfig.regions as unknown[]).toHaveLength(1);
  });

  it("uses cdg1 (Paris) — closest to Asturias users", () => {
    expect(vercelConfig.regions).toEqual(["cdg1"]);
  });
});
