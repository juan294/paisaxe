import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import vm from "node:vm";

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

    expect(pkg.scripts["lint:src"]).toBe("eslint src/ --max-warnings=0");
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

  it("runs coverage merge after successful shards even when the push-source job is skipped", () => {
    const workflow = readText(".github/workflows/ci.yml");

    const parsed = parse(workflow) as { jobs: Record<string, { needs: string[]; if: string }> };
    const merge = parsed.jobs["coverage-merge"];
    expect(merge.needs).toContain("coverage-shard");
    const expression = merge.if.replace(/^\$\{\{\s*|\s*\}\}$/g, "")
      .replace(/needs\.([A-Za-z_][A-Za-z0-9_-]*)/g, (_match: string, key: string) => `needs[${JSON.stringify(key)}]`);
    for (const result of ["success", "failure", "skipped", "cancelled"]) {
      const actual = vm.runInNewContext(expression, {
        always: () => true,
        format: (template: string, ref: string) => template.replace("{0}", ref),
        inputs: { profile: "", source_sha: "", invocation_id: "" },
        vars: { CI_CADENCE_MODE: "legacy" },
        github: { event_name: "push", ref: "refs/heads/develop", workflow_ref: "juan294/paisaxe/.github/workflows/ci.yml@refs/heads/develop" },
        needs: { "coverage-shard": { result }, "callable-source": { result: "skipped" }, "cadence-route": { result: "skipped", outputs: {} } },
      }, { timeout: 100 });
      expect(Boolean(actual)).toBe(result === "success");
    }
  });

  it("runs secret-free E2E coverage for Dependabot while preserving authenticated checks elsewhere", () => {
    const workflow = readText(".github/workflows/e2e.yml");

    expect(workflow).toContain("SECRETS_WITHHELD_PR:");
    expect(workflow).toContain("github.event.pull_request.user.login == 'dependabot[bot]'");
    expect(workflow).toContain("if: env.SECRETS_WITHHELD_PR != 'true'");
    expect(workflow).toContain("if: env.SECRETS_WITHHELD_PR == 'true'");
    expect(workflow).toContain("--grep-invert=\"QA Journey: Authenticated User\"");
    expect(workflow).toContain("NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co");
    expect(workflow).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy_key_for_e2e");
  });

  it("gates release PRs on a secret-free local artifact smoke that fails without candidate identity, and does not run the dead develop-push smoke job (DO-H1)", () => {
    const ciWorkflow = readText(".github/workflows/ci.yml");
    const previewSmokeWorkflow = readText(".github/workflows/preview-smoke.yml");

    type Step = { name?: string; if?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, unknown> };
    const parsed = parse(previewSmokeWorkflow) as { on: Record<string, { branches: string[] }>; permissions: Record<string, string>; jobs: Record<string, { name: string; if?: string; "timeout-minutes": number; permissions: Record<string, string>; steps: Step[] }> };
    // Release PRs only, one job, and its name is the required check context.
    expect(Object.keys(parsed.on)).toEqual(["pull_request"]);
    expect(parsed.on.pull_request.branches).toEqual(["main"]);
    expect(Object.keys(parsed.jobs)).toEqual(["preview-smoke"]);
    const job = parsed.jobs["preview-smoke"];
    expect(job.name).toBe("Release artifact smoke");
    // Unconditional: a skipped required context would satisfy branch protection.
    expect(job.if).toBeUndefined();
    expect(job["timeout-minutes"]).toBeLessThanOrEqual(20);
    // Read-only token and no secrets, so fork/Dependabot release PRs run the same job.
    expect(parsed.permissions).toEqual({ contents: "read" });
    expect(job.permissions).toEqual({ contents: "read" });
    expect(previewSmokeWorkflow).not.toMatch(/secrets\.|github\.token|pull_request_target/);
    expect(previewSmokeWorkflow).not.toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    // No deployment is created or awaited.
    expect(previewSmokeWorkflow).not.toMatch(/deployments|vercel deploy|PREVIEW_URL/);

    const steps = job.steps;
    const index = (name: string) => {
      const found = steps.findIndex(step => step.name === name);
      expect(found, name).toBeGreaterThanOrEqual(0);
      return found;
    };
    const checkout = steps[index("Checkout release candidate")];
    expect(checkout.with).toEqual({ ref: "${{ github.sha }}", "persist-credentials": false });
    // Identity comes from the physical checkout and must precede the build that embeds it.
    const identity = steps[index("Bind candidate identity")];
    expect(identity.run).toContain('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"');
    expect(identity.run).toContain('echo "VERCEL_GIT_COMMIT_SHA=$GITHUB_SHA"');
    expect(identity.run).toContain("BUILD_TREE_HASH=$(git rev-parse 'HEAD^{tree}')");
    const order = ["Start local Supabase", "Provision synthetic smoke environment", "Bind candidate identity", "Build release candidate", "Record build manifest", "Smoke production server on loopback"].map(index);
    expect(order).toEqual([...order].sort((left, right) => left - right));
    expect(steps[index("Build release candidate")].run).toBe("npm run build");
    expect(steps[index("Record build manifest")].run).toBe('node scripts/ci-cadence-artifact.mjs "$GITHUB_SHA" "$RELEASE_ARTIFACT_MANIFEST"');
    expect(steps[index("Smoke production server on loopback")].run).toBe("npm run test:e2e:release-artifact");
    // Every gating step is unconditional; only evidence upload uses always().
    for (const step of steps) if (step.name !== "Upload smoke evidence") expect(step.if, step.name).toBeUndefined();

    // The smoke runs the mutating local release probes plus the identity spec,
    // against the production server Playwright boots under CI.
    const scripts = JSON.parse(readText("package.json")).scripts as Record<string, string>;
    expect(scripts["test:e2e:release-artifact"]).toBe("playwright test --project=release-required-local --project=release-artifact-smoke");
    const playwrightConfig = readText("playwright.config.ts");
    expect(playwrightConfig).toContain('name: "release-artifact-smoke"');
    expect(playwrightConfig).toContain('testMatch: "release-artifact-smoke.spec.ts"');
    expect(playwrightConfig).toContain('"**/release-artifact-smoke.spec.ts",');

    // Identity, readiness and hydration are asserted, and absence throws rather than skips.
    const probe = readText("e2e/release-artifact-smoke.spec.ts");
    expect(probe).toContain("if (!manifestPath || !cronSecret) {\n    throw new Error(");
    expect(probe).not.toMatch(/test\.skip|test\.fixme|\.skip\(/);
    expect(probe).toContain("assertLocalDatastore(process.env.NEXT_PUBLIC_SUPABASE_URL)");
    expect(probe).toContain('expect(body.status).toBe("healthy")');
    expect(probe).toContain("commit: manifest.candidateSha");
    expect(probe).toContain("tree: manifest.treeSha.slice(0, 12)");
    expect(probe).toContain('await page.waitForURL("**/immersive")');
    expect(probe).toContain("toBe(recorded?.sha256)");
    // DO-H4: --require-sentry deliberately stays off the required release gate.
    // sentry.status: "configured" is derived purely from NEXT_PUBLIC_SENTRY_DSN
    // being non-empty (src/app/api/health/route.ts checkSentry()) — it proves
    // the env var is set, not that error delivery works (DO-B1: a 90-day Sentry
    // query returned zero issues despite "configured", spanning a known outage).
    // Hard-gating on an unverified signal would also be unsafe operationally:
    // `vercel env ls preview` confirms the Preview environment does not carry
    // NEXT_PUBLIC_SENTRY_DSN, so adding the flag today would fail this required
    // check on every PR targeting main, including incident hotfixes. Revisit
    // once DO-B1 confirms live Sentry delivery and Preview provisions the DSN.
    expect(previewSmokeWorkflow).not.toContain("--require-sentry");

    // DO-H1: the develop-push smoke job waited on a Vercel preview that
    // vercel.json's ignoreCommand ensures never exists, then always
    // reported success via its timeout branch without probing anything.
    // It was removed; assert it doesn't come back.
    expect(ciWorkflow).not.toContain("Develop smoke check");
    expect(ciWorkflow).not.toContain("develop-smoke");
  });

  it("preflights Voyage AI before running QA LLM tests", () => {
    const qaAgent = readText("scripts/qa-agent.sh");

    expect(qaAgent).toContain("VOYAGE_API_KEY_VALUE");
    expect(qaAgent).toContain("Checking Voyage AI embedding availability");
    expect(qaAgent).toContain("QA PREFLIGHT: Voyage AI embedding availability failed");
    expect(qaAgent.indexOf("export VOYAGE_API_KEY")).toBeLessThan(
      qaAgent.indexOf("npm run build")
    );
  });

  // QA-H3 (#870): the weekly QA gate now runs a production build instead of
  // `npm run dev`, so it exercises the Anthropic SDK transport (the code
  // path production traffic actually takes) instead of the curl-subprocess
  // dev/test transport. See src/lib/claude.ts USE_CURL.
  it("runs the QA suite against a production build, not the dev server", () => {
    const qaAgent = readText("scripts/qa-agent.sh");

    expect(qaAgent).toContain('npm run build > "$SERVER_LOG"');
    expect(qaAgent).toContain('npm run start -- --port 3006');
    // Build must complete (and be checked for failure) before start is launched.
    expect(qaAgent.indexOf("npm run build")).toBeLessThan(
      qaAgent.indexOf("npm run start -- --port 3006")
    );
    expect(qaAgent).toContain("Production build failed");
  });

  // QA-H3 (#870): the SSE endpoint real users hit, not the legacy
  // non-streaming JSON endpoint.
  it("targets the streaming chat endpoint real users hit", () => {
    const llmQualityTest = readText("src/tests/qa/llm-quality.test.ts");
    const llmQualityHelpers = readText("src/tests/qa/llm-quality-helpers.ts");

    expect(llmQualityTest).toContain("`${API_URL}/api/chat/stream`");
    expect(llmQualityHelpers).toContain("parseStreamResponse");
    expect(llmQualityHelpers).toContain("text/event-stream");
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

  // 2026-10-01: a single `degraded` reading with no body detail could not be triaged.
  it("retries a non-healthy app health probe once and keeps both full bodies", () => {
    const qaAgent = readText("scripts/qa-agent.sh");

    expect(qaAgent).toContain("App health probe not healthy — retrying once after 5s");
    expect(qaAgent).toContain("HEALTH_RESPONSE_FIRST");
    expect(qaAgent).toContain("first probe:");
    expect(qaAgent.indexOf("HEALTH_RESPONSE_FIRST")).toBeLessThan(
      qaAgent.indexOf("App health: FAILED")
    );
  });

  it("holds only the voice-SDK chunk to the larger chunk budget and reads route first-load stats", () => {
    const perfAgent = readText("scripts/performance-agent.sh");

    expect(perfAgent).toContain("BUDGET_LARGEST_CHUNK_KB=650");
    expect(perfAgent).toContain("BUDGET_VOICE_CHUNK_MARKER=livekit");
    expect(perfAgent).toContain("BUDGET_VOICE_CHUNK_KB=800");
    expect(perfAgent).toContain(
      'largest_chunk_budget_violation "$LARGEST_CHUNKS" "$BUDGET_LARGEST_CHUNK_KB" "$BUDGET_VOICE_CHUNK_MARKER" "$BUDGET_VOICE_CHUNK_KB"'
    );
    expect(perfAgent).toContain(".next/diagnostics/route-bundle-stats.json");
    expect(perfAgent).toContain('first_load_budget_violation "$ROUTE_STATS_FILE" "$BUDGET_INITIAL_JS_KB"');
  });

  // 2026-10-01: an exact-version override blocks `npm audit fix`, yet the audit's
  // fixAvailable flag still said "fixable". The metric must come from a dry run.
  it("counts fixable vulnerabilities from an npm audit fix dry run, not fixAvailable", () => {
    const securityAgent = readText("scripts/security-agent.sh");

    expect(securityAgent).toContain("npm audit fix --dry-run --json");
    expect(securityAgent).toContain("REMAINING_AFTER_FIX");
    expect(securityAgent).not.toContain("fixAvailable == true");
    expect(securityAgent).toContain("remaining after npm audit fix dry run");
  });

  // 2026-10-02: vitest 5 moved blob reports from .vitest-reports to .vitest/blob. The
  // shard upload then found nothing (only warned) and the merge found no blobs.
  it("uploads and merges coverage blobs from vitest's default blob directory and fails on a missing blob", () => {
    const workflow = readText(".github/workflows/ci.yml");

    expect(workflow).toContain("path: .vitest/blob/*");
    expect(workflow).toContain("path: .vitest/blob\n");
    expect(workflow).not.toContain(".vitest-reports");
    expect(workflow).toContain("if-no-files-found: error");
    expect(readText(".gitignore")).toContain(".vitest/");
  });

  // 2026-10-02: Vercel Preview is not a place this project provisions secrets. The
  // ElevenLabs preflight needs HEALTH_PROBE_SECRET on the target, so running it
  // against a preview deployment made the required check unpassable. It is already a
  // required deployed-readonly probe (quality/required-probes.yaml) run post-deploy
  // against production (release checklist step 5). The release artifact smoke that
  // replaced the preview smoke is secret-free and keeps the same boundary.
  it("keeps the required release smoke free of the secret-dependent ElevenLabs preflight", () => {
    const previewSmoke = readText(".github/workflows/preview-smoke.yml");
    const probes = readText("quality/required-probes.yaml");

    expect(previewSmoke).not.toContain("check-elevenlabs-voice-preflight");
    expect(previewSmoke).not.toContain("HEALTH_PROBE_SECRET");
    // The preflight must stay a required production probe, not disappear.
    expect(probes).toContain("id: elevenlabs-voice-preflight");
    expect(probes).toContain("npm run check-elevenlabs-voice");
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

  it("fails the Vercel env safety job when its secret is missing outside secret-withheld PRs", () => {
    const workflow = readText(".github/workflows/security.yml");

    // DO-M2 (#829): the job used to skip its only assertion whenever
    // VERCEL_TOKEN was unset and still report success on every push/
    // schedule run — requiredness without evidence, the same pattern
    // rejected for Dependabot in preview-smoke.yml. Skip-to-pass must now
    // be scoped to PRs where GitHub genuinely withholds secrets: forks and
    // Dependabot. Every other trigger with a missing secret must fail.
    expect(workflow).toContain("Fail when Vercel credentials are unavailable (trusted event)");
    expect(workflow).toContain("Skip when Vercel credentials are unavailable (secret-withheld PR)");

    // The fail step's run body ends in `exit 1` right after its distinctive
    // error line — proves the missing-secret/trusted-event path actually fails.
    expect(workflow).toContain(
      '          echo "::error::This is the only automated check on deployed Vercel environment state in this repo (DO-M2 / issue #829) — it must fail rather than silently report success while checking nothing."\n' +
        "          exit 1"
    );

    // The skip step's last echo line is immediately followed by the next
    // step (no `exit 1` in between) — proves the secret-withheld path passes.
    const parsed = parse(workflow) as { jobs: Record<string, { steps: { name: string; if?: string; run?: string }[] }> };
    const steps = parsed.jobs["vercel-env-safety"].steps;
    const skipIndex = steps.findIndex(step => step.name === "Skip when Vercel credentials are unavailable (secret-withheld PR)");
    const skip = steps[skipIndex];
    const fail = steps.find(step => step.name === "Fail when Vercel credentials are unavailable (trusted event)")!;
    expect(skip.run).toContain('echo "Skipping the Vercel env safety assertion in this secret-withheld PR context."');
    expect(skip.run).not.toMatch(/exit\s+1/);
    expect(fail.run?.trim()).toMatch(/exit 1$/);
    expect(steps[skipIndex + 1].name).toBe("Assert legacy agent override is absent from Vercel env");
    for (const withheld of ["true", "false"]) {
      const context = { env: { VERCEL_TOKEN: "", VERCEL_PROJECT_ID: "", VERCEL_ORG_ID: "", SECRETS_WITHHELD_PR: withheld } };
      const evaluate = (condition: string) => Boolean(vm.runInNewContext(condition.replace(/^\$\{\{\s*|\s*\}\}$/g, ""), context, { timeout: 100 }));
      expect(evaluate(fail.if!)).toBe(withheld === "false");
      expect(evaluate(skip.if!)).toBe(withheld === "true");
    }

    // The fail path must exclude only fork and Dependabot PRs; the skip path
    // must accept only those same secret-withheld cases. If these conditions
    // were ever widened, the job could silently pass on trusted events.
    expect(workflow).toContain(
      "github.event.pull_request.user.login == 'dependabot[bot]'"
    );
    expect(workflow).toContain(
      "github.event.pull_request.head.repo.fork == true"
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
