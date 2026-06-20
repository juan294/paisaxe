import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("next.config.ts voyageai module resolution", () => {
  it("does not list voyageai as external", () => {
    // The voyageai 0.2.x ESM build used bare directory imports that neither
    // Node native ESM (ERR_UNSUPPORTED_DIR_IMPORT) nor Turbopack could resolve.
    // 0.4.x ships a fixed ESM build (dist/esm/extended/index.mjs with explicit
    // file references), but we still let the bundler handle it — keep voyageai
    // out of serverExternalPackages.
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf-8");
    expect(config).not.toMatch(/serverExternalPackages:\s*\[[^\]]*voyageai/);
  });

  it("voyageai is pinned to a 0.4.x release in package.json", () => {
    // Upgraded from 0.1.0 to 0.4.x (#627): the broken 0.2.x ESM build is fixed
    // in 0.4.0 (ships dist/esm/extended/ExtendedClient.mjs). 0.4.x also changed
    // the contextualizedEmbed response shape (results[].embeddings + totalTokens).
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
    expect(pkg.dependencies.voyageai).toMatch(/^\^?0\.4\./);
  });
});
