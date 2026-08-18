import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type PackageJson = {
  scripts: Record<string, string>;
};

type GateStep = {
  name: string;
  command: readonly string[];
};

type ProcessLike = {
  on(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): ProcessLike;
  on(event: "error", listener: (error: Error) => void): ProcessLike;
};

export type SpawnLike = (
  command: string,
  args: string[],
  options: { stdio: "inherit"; shell: boolean }
) => ProcessLike;

const root = process.cwd();

export const LOCAL_PRELAUNCH_STEPS: readonly GateStep[] = [
  {
    // QA-M3 (#874): typecheck, lint, and the unit suite are the cheapest
    // steps in this gate — they must run first so a fast, local failure
    // surfaces before the gate burns time on the ~4-minute build or the
    // browser E2E suite. Previously this gate did not run them at all,
    // so `npm run prelaunch` could pass with broken types, lint errors,
    // or failing unit tests that were never checked.
    name: "typecheck",
    command: ["npm", "run", "typecheck"],
  },
  {
    name: "lint",
    command: ["npm", "run", "lint"],
  },
  {
    name: "unit test suite",
    command: ["npm", "run", "test"],
  },
  {
    name: "verification coverage",
    command: ["npm", "run", "check-verification-coverage"],
  },
  {
    name: "environment documentation",
    command: ["npm", "run", "check-env"],
  },
  {
    name: "migration validation",
    command: ["npm", "run", "check-migrations"],
  },
  {
    name: "production build",
    command: ["npm", "run", "build"],
  },
  {
    name: "browser E2E",
    command: ["npm", "run", "test:e2e"],
  },
] as const;

export const LIVE_GATE_SCRIPT = "prelaunch:live";
export const LIVE_GATE_COMMAND = "REQUIRE_LIVE_INTEGRATION=true npm run test:e2e:stripe";

function readPackageJson(): PackageJson {
  return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as PackageJson;
}

export function validatePackageScripts(pkg: PackageJson): void {
  for (const step of LOCAL_PRELAUNCH_STEPS) {
    const scriptName = step.command.at(-1);
    if (!scriptName || !pkg.scripts[scriptName]) {
      throw new Error(`Missing required pre-launch script: ${scriptName ?? step.command.join(" ")}`);
    }
  }

  if (pkg.scripts[LIVE_GATE_SCRIPT] !== LIVE_GATE_COMMAND) {
    throw new Error(
      `${LIVE_GATE_SCRIPT} must remain the explicit live Stripe/Supabase gate: ${LIVE_GATE_COMMAND}`
    );
  }
}

function runCommand(command: readonly string[], spawnImpl: SpawnLike): Promise<void> {
  const [executable, ...args] = command;

  return new Promise((resolve, reject) => {
    const child = spawnImpl(executable, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command.join(" ")} exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}`
        )
      );
    });

    child.on("error", reject);
  });
}

export async function runPrelaunchGate(
  pkg: PackageJson = readPackageJson(),
  spawnImpl: SpawnLike = spawn as SpawnLike
): Promise<void> {
  validatePackageScripts(pkg);

  console.log("Running local pre-launch release gate.");
  console.log(`Live Stripe/Supabase gate is explicit: npm run ${LIVE_GATE_SCRIPT}`);
  console.log("This command does not run the live gate by default.\n");

  for (const step of LOCAL_PRELAUNCH_STEPS) {
    console.log(`> ${step.name}: ${step.command.join(" ")}`);
    await runCommand(step.command, spawnImpl);
  }

  console.log("\nLocal pre-launch gate passed.");
  console.log(`Run npm run ${LIVE_GATE_SCRIPT} separately when live QA credentials are available.`);
}

function isMain(): boolean {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isMain()) {
  runPrelaunchGate().catch((error) => {
    console.error("[prelaunch-gate] Failed:", error);
    process.exit(1);
  });
}
