import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf-8")) as T;
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

describe("verification coverage config", () => {
  it("typechecks app, scripts, E2E, and edge function TypeScript surfaces", () => {
    const pkg = readJson<{ scripts: Record<string, string> }>("package.json");

    expect(pkg.scripts["typecheck:app"]).toBe("tsc --noEmit");
    expect(pkg.scripts["typecheck:scripts"]).toBe("tsc --noEmit -p scripts/tsconfig.json");
    expect(pkg.scripts["typecheck:e2e"]).toBe("tsc --noEmit -p e2e/tsconfig.json");
    expect(pkg.scripts["typecheck:edge"]).toBe("tsc --noEmit -p supabase/functions/tsconfig.json");
    expect(pkg.scripts.typecheck).toContain("npm run typecheck:app");
    expect(pkg.scripts.typecheck).toContain("npm run typecheck:scripts");
    expect(pkg.scripts.typecheck).toContain("npm run typecheck:e2e");
    expect(pkg.scripts.typecheck).toContain("npm run typecheck:edge");
  });

  it("lints non-src TypeScript scripts through the default lint gate", () => {
    const pkg = readJson<{ scripts: Record<string, string> }>("package.json");

    expect(pkg.scripts["lint:src"]).toBe("eslint src/");
    expect(pkg.scripts["lint:scripts"]).toBe("eslint scripts --max-warnings=0");
    expect(pkg.scripts.lint).toContain("npm run lint:src");
    expect(pkg.scripts.lint).toContain("npm run lint:scripts");
  });

  it("uses webpack for bundle analyzer builds", () => {
    const pkg = readJson<{ scripts: Record<string, string> }>("package.json");

    expect(pkg.scripts.analyze).toBe(
      "ANALYZE=true NODE_OPTIONS='--disable-warning=ExperimentalWarning' next build --webpack"
    );
    expect(pkg.scripts["build:analyze"]).toBe(pkg.scripts.analyze);
  });

  it("keeps tsconfig exclusions paired with dedicated verification surfaces", () => {
    const rootTsconfig = readJson<{ exclude: string[] }>("tsconfig.json");
    const scriptsTsconfig = readJson<{ exclude: string[] }>("scripts/tsconfig.json");

    expect(rootTsconfig.exclude).toEqual(
      expect.arrayContaining(["scripts", "e2e", "supabase/functions"])
    );
    expect(scriptsTsconfig.exclude).not.toContain("seed-database.ts");
    expect(scriptsTsconfig.exclude).not.toContain("seed-images.ts");
    expect(scriptsTsconfig.exclude).not.toContain("seed-database.test.ts");
    expect(scriptsTsconfig.exclude).not.toContain("seed-images.test.ts");
  });

  it("defines a pre-launch live integration gate that fails instead of skipping", () => {
    const pkg = readJson<{ scripts: Record<string, string> }>("package.json");
    const workflow = readText(".github/workflows/e2e-stripe-integration.yml");

    expect(pkg.scripts.prelaunch).toBe("tsx scripts/run-prelaunch-gate.ts");
    expect(pkg.scripts["prelaunch:live"]).toBe(
      "REQUIRE_LIVE_INTEGRATION=true npm run test:e2e:stripe"
    );
    expect(workflow).toContain("require_live_gate");
    expect(workflow).toContain("REQUIRE_LIVE_INTEGRATION");
    expect(workflow).toContain("Live gate requires all Stripe/Supabase QA secrets");
  });

  it("checks the verification wiring itself in CI", () => {
    const pkg = readJson<{ scripts: Record<string, string> }>("package.json");
    const workflow = readText(".github/workflows/ci.yml");

    expect(pkg.scripts["check-verification-coverage"]).toBe(
      "tsx scripts/check-verification-coverage.ts"
    );
    expect(pkg.scripts.prelaunch).toContain("run-prelaunch-gate");
    expect(workflow).toContain("npm run check-verification-coverage");
  });

  it("uses the body-parsing readiness monitor for Vercel health smoke checks", () => {
    const ciWorkflow = readText(".github/workflows/ci.yml");
    const previewSmokeWorkflow = readText(".github/workflows/preview-smoke.yml");

    expect(ciWorkflow).toContain('node scripts/check-health-readiness.mjs "$PREVIEW_URL"');
    expect(previewSmokeWorkflow).toContain(
      'node scripts/check-health-readiness.mjs "$PREVIEW_URL" --require-sentry'
    );
  });
});
