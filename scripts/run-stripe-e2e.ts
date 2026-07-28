import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertTestsExecuted } from "./lib/playwright-report";

const REQUIRED_ENV_KEYS = [
  "STRIPE_TEST_SECRET_KEY",
  "STRIPE_TEST_DAY_PASS_PRICE_ID",
  "NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY",
  "STRIPE_TEST_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_KEY",
  "QA_TEST_USER_EMAIL",
  "QA_TEST_USER_PASSWORD",
] as const;

function getEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const req = httpRequest(url, (res) => {
        res.resume();
        const code = res.statusCode ?? 0;
        if (code >= 200 && code < 400) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(
            new Error(
              `Server at ${url} returned HTTP ${code} after ${timeoutMs}ms`,
            ),
          );
          return;
        }
        setTimeout(check, 1000);
      });

      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for server at ${url}`));
          return;
        }

        setTimeout(check, 1000);
      });

      req.end();
    };

    check();
  });
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}`,
        ),
      );
    });

    child.on("error", reject);
  });
}

/** Returns undefined when no report exists — the guard treats that as a failure. */
function readReport(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

async function main() {
  for (const key of REQUIRED_ENV_KEYS) {
    getEnv(key);
  }

  const port = process.env.PLAYWRIGHT_PORT?.trim() || "3101";
  const baseUrl = `http://127.0.0.1:${port}`;
  const sharedEnv = {
    ...process.env,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY?.trim() || "dummy_key_for_e2e",
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY?.trim() || "dummy_key_for_e2e",
    MAINTENANCE_MODE: "false",
    NEXT_PUBLIC_SITE_URL: baseUrl,
    STRIPE_SECRET_KEY: getEnv("STRIPE_TEST_SECRET_KEY"),
    STRIPE_DAY_PASS_PRICE_ID: getEnv("STRIPE_TEST_DAY_PASS_PRICE_ID"),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: getEnv("NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY"),
    STRIPE_WEBHOOK_SECRET: getEnv("STRIPE_TEST_WEBHOOK_SECRET"),
  };

  await runCommand("npm", ["run", "build"], sharedEnv);

  const server = spawn("npm", ["run", "start", "--", "--port", port], {
    env: sharedEnv,
    stdio: "inherit",
  });

  // Playwright exits 0 when every selected test was skipped, so the run's exit
  // code alone cannot distinguish "the integration passed" from "nothing ran".
  // Capture the JSON report and assert that tests actually executed.
  const reportPath = join(tmpdir(), `stripe-e2e-report-${process.pid}.json`);

  try {
    await waitForServer(baseUrl, 120_000);
    await runCommand(
      "npx",
      ["playwright", "test", "--project=stripe-integration", "--reporter=json"],
      {
        ...sharedEnv,
        PLAYWRIGHT_PORT: port,
        PLAYWRIGHT_REUSE_SERVER: "true",
        PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
      },
    );

    assertTestsExecuted(readReport(reportPath), "Stripe integration");
  } finally {
    server.kill("SIGTERM");
    rmSync(reportPath, { force: true });
  }
}

main().catch((error) => {
  console.error("[stripe-e2e] Failed:", error);
  process.exit(1);
});
