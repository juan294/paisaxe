import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("next.config.ts voyageai module resolution", () => {
  let config: string;

  beforeEach(() => {
    config = readFileSync(join(process.cwd(), "next.config.ts"), "utf-8");
  });

  it("does not list voyageai as external", () => {
    // voyageai v0.2.x ESM build uses bare directory/extensionless imports that
    // Node.js native ESM cannot resolve (ERR_UNSUPPORTED_DIR_IMPORT). The package
    // must not be in serverExternalPackages — the bundler must own resolution.
    expect(config).not.toMatch(/serverExternalPackages:\s*\[[^\]]*voyageai/);
  });

  it("aliases voyageai to its CJS build via turbopack", () => {
    // Turbopack also cannot resolve the broken ESM entry point. The resolveAlias
    // forces it to use dist/cjs/extended/index.js which uses require() and handles
    // directory imports correctly.
    expect(config).toMatch(/resolveAlias[\s\S]*?voyageai[\s\S]*?dist\/cjs\/extended\/index\.js/);
  });
});
