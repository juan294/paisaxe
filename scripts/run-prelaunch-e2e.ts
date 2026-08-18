import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertTestsExecuted,
  type PlaywrightJsonReport,
} from "./lib/playwright-report";

/**
 * Gated runner for the prelaunch gate's browser-E2E step (QA-M2, #873).
 *
 * `npm run test:e2e` on its own has no zero-test guard: `playwright test`
 * exits 0 when every selected test is skipped, so `npm run prelaunch` could
 * print "Local pre-launch gate passed" having verified nothing. This mirrors
 * the exact pattern scripts/run-stripe-e2e.ts already uses for the Stripe
 * gate: run with `--reporter=json` + `PLAYWRIGHT_JSON_OUTPUT_NAME`, then call
 * the shared `assertTestsExecuted` guard against the resulting report.
 *
 * That guard alone cannot detect a *partial* skip — dozens of anonymous
 * tests executing while the authenticated-journey suite silently skips still
 * yields a non-zero executed count. So this runner also sets
 * `REQUIRE_AUTH_JOURNEYS=true`, which makes e2e/qa-journey.spec.ts's
 * authenticated suite fail closed (throw) instead of skipping when QA test
 * credentials are absent, rather than silently omitting that test class.
 */
export const PRELAUNCH_E2E_ARGS = [
  "playwright",
  "test",
  "--project=desktop",
  "--project=mobile",
  "--project=qa-journey",
  "--reporter=json",
] as const;

export type RunCommand = (
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
) => Promise<{ code: number | null }>;

export type ReadReport = (path: string) => PlaywrightJsonReport | undefined;

function defaultRunCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<{ code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });

    child.on("exit", (code) => resolve({ code }));
    child.on("error", reject);
  });
}

function defaultReadReport(path: string): PlaywrightJsonReport | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

export interface RunGatedPrelaunchE2EOptions {
  runCommand?: RunCommand;
  readReport?: ReadReport;
  reportPath?: string;
}

export async function runGatedPrelaunchE2E(
  options: RunGatedPrelaunchE2EOptions = {}
): Promise<void> {
  const runCommand = options.runCommand ?? defaultRunCommand;
  const readReport = options.readReport ?? defaultReadReport;
  const configuredReportPath =
    options.reportPath ?? process.env.PLAYWRIGHT_JSON_OUTPUT_NAME?.trim();
  const reportPath =
    configuredReportPath ??
    join(tmpdir(), `prelaunch-e2e-report-${process.pid}.json`);

  mkdirSync(dirname(reportPath), { recursive: true });

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
    REQUIRE_AUTH_JOURNEYS: "true",
  };

  try {
    const result = await runCommand("npx", [...PRELAUNCH_E2E_ARGS], env);

    // Playwright exits 0 when every selected test was skipped, so the exit
    // code alone cannot distinguish "the gate passed" from "nothing ran".
    // Assert real execution first so a partial/total skip is reported as
    // exactly that, even when the exit code looks clean.
    assertTestsExecuted(readReport(reportPath), "Prelaunch browser E2E");

    if (result.code !== 0) {
      throw new Error(
        `Prelaunch browser E2E exited with code ${result.code ?? "null"}`
      );
    }
  } finally {
    if (!configuredReportPath) {
      rmSync(reportPath, { force: true });
    }
  }
}

function isMain(): boolean {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;
}

if (isMain()) {
  runGatedPrelaunchE2E().catch((error) => {
    console.error("[prelaunch-e2e] Failed:", error);
    process.exit(1);
  });
}
