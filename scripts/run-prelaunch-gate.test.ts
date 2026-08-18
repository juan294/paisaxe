import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import {
  LIVE_GATE_COMMAND,
  LIVE_GATE_SCRIPT,
  LOCAL_PRELAUNCH_STEPS,
  type SpawnLike,
  runPrelaunchGate,
  validatePackageScripts,
} from "./run-prelaunch-gate";

const validScripts = Object.fromEntries([
  ...LOCAL_PRELAUNCH_STEPS.map((step) => [step.command.at(-1) ?? "", "present"]),
  [LIVE_GATE_SCRIPT, LIVE_GATE_COMMAND],
]);

describe("run-prelaunch-gate", () => {
  it("runs every local release-critical gate in order and leaves live integration explicit", async () => {
    const calls: string[][] = [];
    const spawnMock: SpawnLike = vi.fn((command: string, args: string[]) => {
      calls.push([command, ...args]);
      const child = new EventEmitter();
      process.nextTick(() => child.emit("exit", 0, null));
      return child;
    });

    await runPrelaunchGate({ scripts: validScripts }, spawnMock);

    expect(calls).toEqual(LOCAL_PRELAUNCH_STEPS.map((step) => step.command));
    expect(calls).not.toContainEqual(["npm", "run", LIVE_GATE_SCRIPT]);
  });

  it("checks the live Stripe/Supabase gate intent without running it by default", () => {
    expect(() => validatePackageScripts({ scripts: validScripts })).not.toThrow();

    expect(() =>
      validatePackageScripts({
        scripts: {
          ...validScripts,
          [LIVE_GATE_SCRIPT]: "npm run test:e2e:stripe",
        },
      })
    ).toThrow(/explicit live Stripe\/Supabase gate/);
  });

  it("runs the unit suite, typecheck, and lint as part of the gate (QA-M3, #874)", () => {
    // Previously LOCAL_PRELAUNCH_STEPS only ran verification-coverage,
    // check-env, check-migrations, build, and E2E — an operator could run
    // `npm run prelaunch`, see it pass, and still have broken types, lint
    // errors, or failing unit tests that were never checked.
    const stepCommands = LOCAL_PRELAUNCH_STEPS.map((step) => step.command);

    expect(stepCommands).toContainEqual(["npm", "run", "test"]);
    expect(stepCommands).toContainEqual(["npm", "run", "typecheck"]);
    expect(stepCommands).toContainEqual(["npm", "run", "lint"]);
  });

  it("runs typecheck, lint, and the unit suite before the expensive build and E2E steps (QA-M3, #874)", () => {
    // Cheap, fast-failing checks (typecheck/lint/unit tests) must surface a
    // regression before the ~4-minute build or the browser E2E suite burns
    // time on a candidate that was already broken.
    const indexOf = (command: readonly string[]): number =>
      LOCAL_PRELAUNCH_STEPS.findIndex((step) => step.command.join(" ") === command.join(" "));

    const typecheckIndex = indexOf(["npm", "run", "typecheck"]);
    const lintIndex = indexOf(["npm", "run", "lint"]);
    const testIndex = indexOf(["npm", "run", "test"]);
    const buildIndex = indexOf(["npm", "run", "build"]);
    const e2eIndex = LOCAL_PRELAUNCH_STEPS.findIndex((step) => step.name === "browser E2E");

    expect(typecheckIndex).toBeGreaterThanOrEqual(0);
    expect(lintIndex).toBeGreaterThanOrEqual(0);
    expect(testIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThan(-1);
    expect(e2eIndex).toBeGreaterThan(-1);

    expect(typecheckIndex).toBeLessThan(buildIndex);
    expect(lintIndex).toBeLessThan(buildIndex);
    expect(testIndex).toBeLessThan(buildIndex);
    expect(typecheckIndex).toBeLessThan(e2eIndex);
    expect(lintIndex).toBeLessThan(e2eIndex);
    expect(testIndex).toBeLessThan(e2eIndex);
  });

  it("fails the whole gate when the unit suite, typecheck, or lint step fails (QA-M3, #874)", async () => {
    for (const failingScriptName of ["test", "typecheck", "lint"] as const) {
      const spawnMock: SpawnLike = vi.fn((_command: string, args: string[]) => {
        const child = new EventEmitter();
        const isFailingStep = args.at(-1) === failingScriptName;
        process.nextTick(() => child.emit("exit", isFailingStep ? 1 : 0, null));
        return child;
      });

      await expect(runPrelaunchGate({ scripts: validScripts }, spawnMock)).rejects.toThrow(
        `npm run ${failingScriptName} exited with code 1`
      );
    }
  });
});
