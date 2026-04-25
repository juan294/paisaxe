import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("next.config.ts serverExternalPackages", () => {
  it("does not list voyageai as external", () => {
    // voyageai v0.2.x ESM build (dist/esm/extended/index.mjs) uses `export * from "../api"` —
    // a bare directory import that Node.js native ESM cannot resolve (ERR_UNSUPPORTED_DIR_IMPORT).
    // Listing it in serverExternalPackages forces Node to load the ESM build directly, causing 500s.
    // The bundler handles directory imports fine, so it must stay off this list.
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf-8");
    expect(config).not.toMatch(/serverExternalPackages[\s\S]*?voyageai/);
  });
});
