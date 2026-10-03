// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The production corpus was embedded with voyage-context-3 (contextualized endpoint). Query embeddings
 * (src/lib/embeddings.ts) and re-seeding (scripts/seed-database.ts) must use that same model, or the
 * vectors live in different spaces: match_chunks then returns nothing and every chat answer ships with
 * zero sources, with no error anywhere. Two copies of the constant drifted apart once (2026-01-29).
 */
function contextualizedModel(relativePath: string): string {
  const source = readFileSync(join(process.cwd(), relativePath), "utf8");
  const match = source.match(/const CONTEXTUALIZED_MODEL = "([^"]+)"/);
  if (!match) throw new Error(`CONTEXTUALIZED_MODEL not found in ${relativePath}`);
  return match[1];
}

describe("embedding model consistency", () => {
  it("queries and the seed script use the same contextualized model", () => {
    expect(contextualizedModel("src/lib/embeddings.ts")).toBe(
      contextualizedModel("scripts/seed-database.ts")
    );
  });

  it("that model is voyage-context-3, the one the production corpus was embedded with", () => {
    expect(contextualizedModel("src/lib/embeddings.ts")).toBe("voyage-context-3");
  });
});
