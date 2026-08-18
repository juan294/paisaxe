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
    // Missing secrets now fail unconditionally. The former require_live_gate
    // input chose between failing and silently passing, so the job could report
    // success having run zero tests; both the input and the skip path are gone.
    expect(workflow).not.toContain("require_live_gate");
    expect(workflow).not.toContain("Skip when secrets are unavailable");
    expect(workflow).toContain(
      "refusing to report success without running any test"
    );

    // Playwright exits 0 when every selected test is skipped, so the runner
    // must additionally assert that tests actually executed.
    expect(readText("scripts/run-stripe-e2e.ts")).toContain("assertTestsExecuted");
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
    expect(previewSmokeWorkflow).toContain('node scripts/check-health-readiness.mjs "$PREVIEW_URL"');
    expect(previewSmokeWorkflow).not.toContain("--require-sentry");
  });

  it("preflights Voyage AI before running QA LLM tests", () => {
    const qaAgent = readText("scripts/qa-agent.sh");

    expect(qaAgent).toContain("VOYAGE_API_KEY_VALUE");
    expect(qaAgent).toContain("Checking Voyage AI embedding availability");
    expect(qaAgent).toContain("QA PREFLIGHT: Voyage AI embedding availability failed");
    expect(qaAgent.indexOf("export VOYAGE_API_KEY")).toBeLessThan(
      qaAgent.indexOf("npm run dev")
    );
    expect(qaAgent).toContain('VOYAGE_API_KEY="$VOYAGE_API_KEY_VALUE" npm run dev');
  });

  it("preflights Anthropic before running QA LLM tests", () => {
    const qaAgent = readText("scripts/qa-agent.sh");

    expect(qaAgent).toContain("ANTHROPIC_API_KEY_VALUE");
    expect(qaAgent).toContain("Checking Anthropic generation availability");
    expect(qaAgent).toContain("https://api.anthropic.com/v1/messages");
    expect(qaAgent).toContain("ANTHROPIC_HEALTH_STATUS");
    expect(qaAgent).toContain("QA PREFLIGHT: Anthropic generation availability failed");
    expect(qaAgent).toContain(
      '"$VOYAGE_HEALTH_STATUS" == "PASS" && "$ANTHROPIC_HEALTH_STATUS" == "PASS"'
    );
  });

  it("writes a report and shared-context entry when the QA wrapper aborts", () => {
    const qaAgent = readText("scripts/qa-agent.sh");

    expect(qaAgent).toContain("write_abnormal_exit_report");
    expect(qaAgent).toContain("RUN_COMPLETED=false");
    expect(qaAgent).toContain("RUN_COMPLETED=true");
    expect(qaAgent).toContain("write_shared_context");
    expect(qaAgent).toContain("handle_exit");
    expect(qaAgent).toContain('CURRENT_PHASE="phase 5 report generation"');
  });

  it("fails (not silently skips) the Vercel env safety job when its secret is missing outside fork PRs", () => {
    const workflow = readText(".github/workflows/security.yml");

    // DO-M2 (#829): the job used to skip its only assertion whenever
    // VERCEL_TOKEN was unset and still report success on every push/
    // schedule run — requiredness without evidence, the same pattern
    // rejected for Dependabot in preview-smoke.yml. Skip-to-pass must now
    // be scoped to fork PRs only (GitHub genuinely withholds secrets
    // there); every other trigger with a missing secret must fail.
    expect(workflow).toContain("Fail when Vercel credentials are unavailable (not a fork PR)");
    expect(workflow).toContain("Skip when Vercel credentials are unavailable (fork PR)");

    // The fail step's run body ends in `exit 1` right after its distinctive
    // error line — proves the missing-secret/non-fork-PR path actually fails.
    expect(workflow).toContain(
      '          echo "::error::This is the only automated check on deployed Vercel environment state in this repo (DO-M2 / issue #829) — it must fail rather than silently report success while checking nothing."\n' +
        "          exit 1"
    );

    // The skip step's last echo line is immediately followed by the next
    // step (no `exit 1` in between) — proves the fork-PR path still passes.
    expect(workflow).toContain(
      '          echo "Skipping the Vercel env safety assertion — this is expected sandboxing, not a missing-secret gap."\n' +
        "\n" +
        "      - name: Assert legacy agent override is absent from Vercel env"
    );

    // The fail path must be gated on NOT being a fork PR; the skip path
    // must be gated on genuinely being one. If these conditions were ever
    // swapped, the job would go back to silently passing everywhere.
    expect(workflow).toContain(
      "!(github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == true)"
    );
    expect(workflow).toContain(
      "github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork == true"
    );
  });

  it("includes chat API response bodies in QA LLM failures", () => {
    const llmQualityTest = readText("src/tests/qa/llm-quality.test.ts");
    const llmQualityHelpers = readText("src/tests/qa/llm-quality-helpers.ts");

    expect(llmQualityTest).toContain("formatChatApiError");
    expect(llmQualityHelpers).toContain("errorBody.error");
    expect(llmQualityHelpers).toContain("errorBody.debug");
    expect(llmQualityTest).toContain("RepeatedServerFailureCircuit");
  });
});
