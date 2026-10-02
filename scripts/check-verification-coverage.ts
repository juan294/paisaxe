import fs from "node:fs";
import path from "node:path";

type PackageJson = {
  scripts: Record<string, string>;
};

type Tsconfig = {
  exclude?: string[];
};

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf-8")) as T;
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertScriptIncludes(
  scripts: Record<string, string>,
  scriptName: string,
  requiredText: string
): void {
  assert(
    scripts[scriptName]?.includes(requiredText),
    `${scriptName} must include "${requiredText}"`
  );
}

function main(): void {
  const pkg = readJson<PackageJson>("package.json");
  const rootTsconfig = readJson<Tsconfig>("tsconfig.json");
  const scriptsTsconfig = readJson<Tsconfig>("scripts/tsconfig.json");
  const stripeWorkflow = readText(".github/workflows/e2e-stripe-integration.yml");
  const ciWorkflow = readText(".github/workflows/ci.yml");

  assertScriptIncludes(pkg.scripts, "typecheck", "npm run typecheck:app");
  assertScriptIncludes(pkg.scripts, "typecheck", "npm run typecheck:scripts");
  assertScriptIncludes(pkg.scripts, "typecheck", "npm run typecheck:e2e");
  assertScriptIncludes(pkg.scripts, "typecheck", "npm run typecheck:edge");
  assert(pkg.scripts["typecheck:app"] === "tsc --noEmit", "typecheck:app must run root tsc");
  assert(
    pkg.scripts["typecheck:scripts"] === "tsc --noEmit -p scripts/tsconfig.json",
    "typecheck:scripts must run scripts/tsconfig.json"
  );
  assert(
    pkg.scripts["typecheck:e2e"] === "tsc --noEmit -p e2e/tsconfig.json",
    "typecheck:e2e must run e2e/tsconfig.json"
  );
  assert(
    pkg.scripts["typecheck:edge"] === "tsc --noEmit -p supabase/functions/tsconfig.json",
    "typecheck:edge must run supabase/functions/tsconfig.json"
  );

  assertScriptIncludes(pkg.scripts, "lint", "npm run lint:src");
  assertScriptIncludes(pkg.scripts, "lint", "npm run lint:scripts");
  assert(
    pkg.scripts["lint:src"] === "eslint src/ --max-warnings=0",
    "lint:src must lint src/ with warnings as failures (AR-L1/#863)"
  );
  assert(
    pkg.scripts["lint:scripts"] === "eslint scripts --max-warnings=0",
    "lint:scripts must lint scripts with warnings as failures"
  );

  for (const excluded of ["scripts", "e2e", "supabase/functions"]) {
    assert(
      rootTsconfig.exclude?.includes(excluded),
      `root tsconfig exclusion "${excluded}" must remain explicit`
    );
  }

  const scriptExclusions = scriptsTsconfig.exclude ?? [];
  for (const coveredScript of [
    "seed-database.ts",
    "seed-images.ts",
    "seed-database.test.ts",
    "seed-images.test.ts",
  ]) {
    assert(
      !scriptExclusions.includes(coveredScript),
      `${coveredScript} must stay in the scripts typecheck surface`
    );
  }

  assert(
    pkg.scripts["prelaunch:live"] === "REQUIRE_LIVE_INTEGRATION=true npm run test:e2e:stripe",
    "prelaunch:live must require the live integration gate"
  );
  assert(
    pkg.scripts.prelaunch === "tsx scripts/run-prelaunch-gate.ts",
    "prelaunch must run the safe local release gate"
  );
  // Missing secrets now fail unconditionally. The former live-gate input chose
  // between failing and silently passing, so the job could report success
  // having run zero tests; both the input and the skip path are gone.
  assert(
    !stripeWorkflow.includes("require_live_gate") &&
      !stripeWorkflow.includes("Skip when secrets are unavailable") &&
      stripeWorkflow.includes("refusing to report success without running any test"),
    "Stripe workflow must fail on missing secrets with no skip-and-pass path"
  );
  assert(
    readText("scripts/run-stripe-e2e.ts").includes("assertTestsExecuted"),
    "Stripe runner must assert tests actually executed (Playwright exits 0 when all are skipped)"
  );
  assert(
    ciWorkflow.includes("npm run check-verification-coverage"),
    "CI must run check-verification-coverage"
  );

  console.log("Verification coverage wiring is explicit and checked.");
}

main();
