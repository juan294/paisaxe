import { request as httpRequest } from "node:http";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assertTestsExecuted } from "./lib/playwright-report";
import { isMain } from "./lib/is-main";
import { assertLocalDatastore } from "./release/probe-guards";
import { validateManifest, validateKeys, inspectStack, localDockerEnvironment, dockerSql, schemaDigest, migrationInventory, runStackCommand, type StackCommandExecutor } from "./run-contracts.mjs";
import { leaseForCaller, createReceiptCommandTracker, type ReceiptCommandTracker } from "./contract-stack-lifecycle.mjs";
import { createOwnedProcessScope } from "./contract-owned-process.mjs";

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

async function runCommand(
  scope: ReturnType<typeof createOwnedProcessScope>,
  commandTracker: ReceiptCommandTracker | null | undefined,
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const result = await scope.run(command, args, { env, stdio: "inherit", commandTracker });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with code ${result.status ?? "null"}${result.signal ? ` (signal ${result.signal})` : ""}`, { cause: result.error });
  }
  scope.checkpoint();
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

async function verifyStripeLocalStack(manifest: ReturnType<typeof assertStripeLocalInputs>, command: StackCommandExecutor) {
  const env = { ...localDockerEnvironment(), NODE_ENV: process.env.NODE_ENV ?? "test" };
  await inspectStack(manifest, env);
  if (migrationInventory(process.cwd()).digest !== manifest.migrationDigest ||
      await schemaDigest(manifest.projectId, env, command) !== manifest.schemaDigest ||
      await dockerSql(manifest.projectId, "SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database();", env, command) !==
        `paisaxe-contracts:${manifest.nonce}:${manifest.migrationDigest}`) {
    throw new Error("Stripe integration owned local database identity mismatch");
  }
  const status = JSON.parse(await command("supabase", ["status", "--workdir", manifest.taskDir, "--output", "json"],
    { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000, maxBuffer: 1024 * 1024 }));
  const keys = validateKeys(status, manifest);
  if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== keys.anon || process.env.SUPABASE_SERVICE_KEY !== keys.service) {
    throw new Error("Stripe integration requires the owned local Supabase credentials");
  }
  return manifest;
}

async function main() {
  const manifest = assertStripeLocalInputs();
  // The prepared stack is reusable: hold a consumer lease so scheduled disposal leaves it alone.
  const lease = leaseForCaller(manifest.projectId, "stripe-e2e");
  try {
    const scope = createOwnedProcessScope();
    try {
      const command: StackCommandExecutor = (binary, args, options) => runStackCommand(scope, lease.commandTracker, binary, args, options);
      await verifyStripeLocalStack(manifest, command);
    } finally { scope.close(); }
    await runStripeIntegration(lease);
  } finally {
    lease.release();
  }
}

async function runStripeIntegration(lease: ReturnType<typeof leaseForCaller>) {
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

  const workScope = createOwnedProcessScope();
  const serverScope = createOwnedProcessScope();
  let serverRun: ReturnType<typeof serverScope.run> | undefined;
  let workloadFailure: unknown;
  let serverFailure: unknown;
  let cleanupFailure: unknown;
  let intentionalServerStop = false;
  let browserStarted = false;
  const configuredReportPath = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME?.trim();
  const reportPath = configuredReportPath ?? join(tmpdir(), `stripe-e2e-report-${process.pid}.json`);
  try {
    await runCommand(workScope, lease.commandTracker, "npm", ["run", "build"], sharedEnv);
    serverRun = serverScope.run("npm", ["run", "start", "--", "--port", port], {
      env: sharedEnv, stdio: "inherit", commandTracker: lease.commandTracker,
    }).then(result => {
      if (!intentionalServerStop) serverFailure = new Error(`Stripe server completed unexpectedly before intentional stop with code ${result.status ?? "null"}${result.signal ? ` (signal ${result.signal})` : ""}`, { cause: result.error });
      return result;
    }, error => {
      if (!intentionalServerStop) serverFailure = error;
      throw error;
    });
    // Keep a rejected launch observed while readiness runs; finally awaits the
    // original promise so the server failure cannot be hidden.
    void serverRun.catch(() => {});
    mkdirSync(dirname(reportPath), { recursive: true });
    await waitForServer(baseUrl, 120_000);
    const browserTracker = lease.id ? createReceiptCommandTracker(lease.root, lease.projectId, {
      purpose: "stripe-browser", leaseId: lease.id, settlement: "explicit-consumer",
    }) : null;
    browserStarted = true;
    await runCommand(workScope, browserTracker, "npx",
      ["playwright", "test", "--project=stripe-integration", "--reporter=json"],
      { ...sharedEnv, PLAYWRIGHT_PORT: port, PLAYWRIGHT_REUSE_SERVER: "true", PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath },
    );
    // A zero exit with no executed cases still fails the existing report gate.
    assertTestsExecuted(readReport(reportPath), "Stripe integration");
  } catch (error) {
    workloadFailure = error;
  } finally {
    if (serverRun) {
      try {
        intentionalServerStop = true;
        serverScope.stop("SIGTERM");
        const stopped = await serverRun;
        const expectedStop = (stopped.status === 0 && stopped.signal === null) ||
          (stopped.status === null && stopped.signal === "SIGTERM");
        if (!expectedStop && !serverFailure) serverFailure = new Error(`Stripe server exited with code ${stopped.status ?? "null"}${stopped.signal ? ` (signal ${stopped.signal})` : ""}`);
        if (stopped.error || !stopped.child.settled) throw new Error("Stripe server cleanup failed; owned child settlement is unproven", { cause: stopped.error });
        serverScope.checkpoint();
      } catch (error) { cleanupFailure = error; }
    }
    workScope.close(); serverScope.close();
    if (browserStarted) console.error("Browser consumer closure is unproven; task resources are retained for inspection.");
    if (!configuredReportPath) {
      try { rmSync(reportPath, { force: true }); }
      catch (error) { cleanupFailure = cleanupFailure ? new AggregateError([cleanupFailure, error], "Stripe server and report cleanup failed") : error; }
    }
  }
  const failures = [...new Set([workloadFailure, serverFailure, cleanupFailure].filter(Boolean))];
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    const describe = (error: unknown) => error instanceof Error ? error.message : String(error);
    throw new AggregateError(failures, failures.map(describe).join("; "));
  }
}

if (isMain(import.meta.url)) main().catch((error) => {
  console.error("[stripe-e2e] Failed:", error);
  process.exit(1);
});
