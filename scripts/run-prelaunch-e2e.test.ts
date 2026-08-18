// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { PlaywrightJsonReport } from "./lib/playwright-report";
import { type RunCommand, runGatedPrelaunchE2E } from "./run-prelaunch-e2e";

const FAKE_REPORT_PATH = "/tmp/paisaxe-run-prelaunch-e2e-test-report.json";

describe("run-prelaunch-e2e", () => {
  it("fails when the JSON report shows zero executed tests, even though playwright exited 0", async () => {
    // This is the exact failure mode QA-M2 (#873) describes: the authenticated
    // journeys silently skip, every other test also happens to be skipped,
    // and `playwright test` still exits 0 because nothing failed.
    const runCommand: RunCommand = vi.fn(async () => ({ code: 0 }));
    const readReport = vi.fn(
      (): PlaywrightJsonReport | undefined => ({
        stats: { expected: 0, skipped: 42 },
      })
    );

    await expect(
      runGatedPrelaunchE2E({
        runCommand,
        readReport,
        reportPath: FAKE_REPORT_PATH,
      })
    ).rejects.toThrow(/zero tests executed/);
  });

  it("passes when the JSON report shows tests actually executed", async () => {
    const runCommand: RunCommand = vi.fn(async () => ({ code: 0 }));
    const readReport = vi.fn(
      (): PlaywrightJsonReport | undefined => ({
        stats: { expected: 12, skipped: 3 },
      })
    );

    await expect(
      runGatedPrelaunchE2E({
        runCommand,
        readReport,
        reportPath: FAKE_REPORT_PATH,
      })
    ).resolves.toBeUndefined();
  });

  it("passes --reporter=json and a JSON output path to playwright, like run-stripe-e2e.ts", async () => {
    let capturedArgs: string[] | undefined;
    let capturedEnv: NodeJS.ProcessEnv | undefined;
    const runCommand: RunCommand = vi.fn(async (_command, args, env) => {
      capturedArgs = args;
      capturedEnv = env;
      return { code: 0 };
    });
    const readReport = () => ({ stats: { expected: 5 } });

    await runGatedPrelaunchE2E({
      runCommand,
      readReport,
      reportPath: FAKE_REPORT_PATH,
    });

    expect(capturedArgs).toContain("--reporter=json");
    expect(capturedEnv?.PLAYWRIGHT_JSON_OUTPUT_NAME).toBe(FAKE_REPORT_PATH);
  });

  it("forces REQUIRE_AUTH_JOURNEYS so the authenticated-journey suite cannot silently skip under this gate", async () => {
    let capturedEnv: NodeJS.ProcessEnv | undefined;
    const runCommand: RunCommand = vi.fn(async (_command, _args, env) => {
      capturedEnv = env;
      return { code: 0 };
    });
    const readReport = () => ({ stats: { expected: 5 } });

    await runGatedPrelaunchE2E({
      runCommand,
      readReport,
      reportPath: FAKE_REPORT_PATH,
    });

    expect(capturedEnv?.REQUIRE_AUTH_JOURNEYS).toBe("true");
  });

  it("propagates a real playwright failure even when tests executed", async () => {
    const runCommand: RunCommand = vi.fn(async () => ({ code: 1 }));
    const readReport = () => ({ stats: { expected: 5, unexpected: 1 } });

    await expect(
      runGatedPrelaunchE2E({
        runCommand,
        readReport,
        reportPath: FAKE_REPORT_PATH,
      })
    ).rejects.toThrow(/exited with code 1/);
  });

  it("rejects a missing report rather than assuming success", async () => {
    const runCommand: RunCommand = vi.fn(async () => ({ code: 0 }));
    const readReport = () => undefined;

    await expect(
      runGatedPrelaunchE2E({
        runCommand,
        readReport,
        reportPath: FAKE_REPORT_PATH,
      })
    ).rejects.toThrow(/no Playwright JSON report was produced/);
  });
});
