import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("next.config.ts voyageai module resolution", () => {
  it("does not list voyageai as external", () => {
    // voyageai v0.2.x ESM build (dist/esm/extended/index.mjs) uses bare directory
    // imports that both Node.js native ESM (ERR_UNSUPPORTED_DIR_IMPORT) and Turbopack
    // cannot resolve. voyageai is pinned to 0.1.0 which has no ESM build, so the
    // bundler handles it safely. It must stay out of serverExternalPackages.
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf-8");
    expect(config).not.toMatch(/serverExternalPackages:\s*\[[^\]]*voyageai/);
  });

  it("voyageai is pinned to 0.1.0 in package.json", () => {
    // v0.2.x has a broken ESM build — do not bump until the upstream issue is fixed.
    // See: https://github.com/voyage-ai/typescript-sdk/issues (bare dir imports in .mjs)
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
    expect(pkg.dependencies.voyageai).toBe("0.1.0");
  });
});
