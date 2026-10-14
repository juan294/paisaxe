import { execFileSync, spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assertTestsExecuted } from "./lib/playwright-report";
import { isMain } from "./lib/is-main";
import { assertLocalDatastore } from "./release/probe-guards";
import { validateManifest, validateKeys, inspectStack, localDockerEnvironment, dockerSql, schemaDigest, migrationInventory } from "./run-contracts.mjs";

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

/** Cheap fail-closed guard also used by direct Playwright project invocation. */
export function assertStripeLocalInputs(env: NodeJS.ProcessEnv = process.env) {
  if (!/^(?:sk_test_|rk_test_)[A-Za-z0-9]+$/.test(env.STRIPE_TEST_SECRET_KEY ?? "") ||
      !/^pk_test_[A-Za-z0-9]+$/.test(env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY ?? "")) {
    throw new Error("Stripe integration requires test-mode credentials (sk_test_/rk_test_ and pk_test_)");
  }
  assertLocalDatastore(env.NEXT_PUBLIC_SUPABASE_URL);
  const task = env.CONTRACT_STACK_DIR;
  if (!task) throw new Error("Stripe integration requires an owned local CONTRACT_STACK_DIR");
  const manifest = validateManifest(JSON.parse(readFileSync(join(task, "contracts-stack.json"), "utf8")), task);
  if (env.NEXT_PUBLIC_SUPABASE_URL !== manifest.apiUrl) throw new Error("Stripe integration requires the exact owned local API endpoint");
  const fixture = JSON.parse(readFileSync(join(task, "stripe-qa.json"), "utf8"));
  if (fixture.project !== manifest.projectId || fixture.nonce !== manifest.nonce ||
      !/^qa-test-[a-z0-9]+@paisaxe\.dev$/.test(fixture.email) ||
      !fixture.password || fixture.email !== env.QA_TEST_USER_EMAIL || fixture.password !== env.QA_TEST_USER_PASSWORD) {
    throw new Error("Stripe integration requires the owned local QA fixture");
  }
  return manifest;
}

async function verifyStripeLocalStack() {
  const manifest = assertStripeLocalInputs();
  const env = { ...localDockerEnvironment(), NODE_ENV: process.env.NODE_ENV ?? "test" };
  await inspectStack(manifest, env);
  if (migrationInventory(process.cwd()).digest !== manifest.migrationDigest ||
      schemaDigest(manifest.projectId, env) !== manifest.schemaDigest ||
      dockerSql(manifest.projectId, "SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database();", env) !==
        `paisaxe-contracts:${manifest.nonce}:${manifest.migrationDigest}`) {
    throw new Error("Stripe integration owned local database identity mismatch");
  }
  const status = JSON.parse(execFileSync("supabase", ["status", "--workdir", manifest.taskDir, "--output", "json"],
    { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 }));
  const keys = validateKeys(status, manifest);
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== keys.anon || process.env.SUPABASE_SERVICE_KEY !== keys.service) {
    throw new Error("Stripe integration requires the owned local Supabase credentials");
  }
}

async function main() {
  await verifyStripeLocalStack();
  for (const key of REQUIRED_ENV_KEYS) {
    getEnv(key);
  }

  const port = process.env.PLAYWRIGHT_PORT?.trim() || "3101";
  // Keep this identical to playwright.config.ts. Mixing 127.0.0.1 here with
  // localhost in the browser changes the Origin and correctly trips CSRF.
  const baseUrl = `http://localhost:${port}`;
  const sharedEnv = {
    ...process.env,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY?.trim() || "dummy_key_for_e2e",
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY?.trim() || "dummy_key_for_e2e",
    MAINTENANCE_MODE: "false",
    NEXT_PUBLIC_SITE_URL: baseUrl,
    // This runner boots `next start` itself instead of Playwright's webServer,
    // so it must explicitly allow its localhost origin through the shared
    // CORS/CSRF gate.
    PLAYWRIGHT_TEST_ORIGIN: baseUrl,
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
  const configuredReportPath =
    process.env.PLAYWRIGHT_JSON_OUTPUT_NAME?.trim();
  const reportPath =
    configuredReportPath ??
    join(tmpdir(), `stripe-e2e-report-${process.pid}.json`);
  mkdirSync(dirname(reportPath), { recursive: true });

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
    // CI supplies a repository-relative output path so the JSON proof can be
    // uploaded even when the clean run creates no screenshots or traces.
    // Ad-hoc local runs keep using a disposable report in the system temp dir.
    if (!configuredReportPath) {
      rmSync(reportPath, { force: true });
    }
  }
}

if (isMain(import.meta.url)) main().catch((error) => {
  console.error("[stripe-e2e] Failed:", error);
  process.exit(1);
});
