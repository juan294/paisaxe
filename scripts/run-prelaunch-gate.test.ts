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
});
