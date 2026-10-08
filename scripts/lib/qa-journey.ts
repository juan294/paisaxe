import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { assertTestsExecuted, type PlaywrightJsonReport } from "./playwright-report";

export interface JourneyOptions {
  directory: string;
  target: string;
  identity: { commit: string; tree: string };
  cronSecret: string;
  enabled: boolean;
  command: string[];
  startCommand?: string[];
  startupTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  artifactRoot?: string;
}

export interface JourneyResult {
  status: "disabled" | "startup_failed" | "invalid_report" | "tests_failed" | "passed";
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  failures: number;
  exitCode: number | null;
  target: string;
  identity: JourneyOptions["identity"];
  logPath: string;
  reportPath: string;
  action: string;
}

function redact(text: string, env: NodeJS.ProcessEnv): string {
  let safe = text;
  for (const [name, value] of Object.entries(env)) {
    if (value && /KEY|TOKEN|SECRET|PASSWORD/i.test(name)) {
      safe = safe.split(JSON.stringify(value).slice(1, -1)).join("[REDACTED]").split(value).join("[REDACTED]");
    }
  }
  return safe.replace(/(Bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/(["']?[A-Z_]*(?:KEY|TOKEN|SECRET|PASSWORD)["']?\s*[=:]\s*)(?:"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|[^\s,}]+)/gi, "$1[REDACTED]");
}

/** Own only the subprocess groups started here, including build/server grandchildren. */
async function stop(child: ChildProcess | undefined): Promise<void> {
  if (!child?.pid) return;
  const signal = (value: NodeJS.Signals) => {
    try { process.kill(-child.pid!, value); } catch { /* Already exited. */ }
  };
  signal("SIGTERM");
  await delay(100);
  signal("SIGKILL");
}

/** JSON results and a separately verified server are required; console counts are never evidence. */
export async function collectJourneyRun(options: JourneyOptions): Promise<JourneyResult> {
  mkdirSync(options.directory, { recursive: true });
  const logPath = join(options.directory, "diagnostics.log");
  const reportPath = join(options.directory, "playwright.json");
  const env = {
    ...process.env, ...options.env,
    PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
    PLAYWRIGHT_REUSE_SERVER: "true",
    REQUIRE_AUTH_JOURNEYS: "true",
  };
  let diagnostics = "";
  let pendingLine = "";
  let discardLine = false;
  const secrets = { ...env, CRON_SECRET: options.cronSecret };
  const appendLine = (line: string) => {
    diagnostics = (diagnostics + redact(line, secrets)).slice(-16_384);
  };
  const capture = (chunk: Buffer | string) => {
    pendingLine += String(chunk);
    let newline: number;
    while ((newline = pendingLine.indexOf("\n")) !== -1) {
      if (!discardLine) appendLine(pendingLine.slice(0, newline + 1));
      discardLine = false;
      pendingLine = pendingLine.slice(newline + 1);
    }
    // Do not retain unbounded lines or a potentially truncated credential.
    if (pendingLine.length > 16_384) { appendLine("[Oversized diagnostic line omitted]\n"); pendingLine = ""; discardLine = true; }
  };
  const launch = (command: string[]) => spawn(command[0], command.slice(1), {
    env, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  const result: JourneyResult = {
    status: "disabled", passed: 0, failed: 0, flaky: 0, skipped: 0, failures: 1,
    exitCode: null, target: options.target, identity: { ...options.identity }, logPath, reportPath,
    action: "Enable journey tests and run again; disabled is unverified.",
  };
  let server: ChildProcess | undefined;
  let testProcess: ChildProcess | undefined;
  let interrupted = false;
  const interrupt = () => { interrupted = true; void stop(server); void stop(testProcess); };
  const checkInterrupted = () => { if (interrupted) throw new Error("Journey verification interrupted; rerun before accepting evidence."); };
  process.once("SIGTERM", interrupt);
  process.once("SIGINT", interrupt);
  rmSync(reportPath, { force: true });

  try {
    if (!options.enabled) return result;
    result.status = "startup_failed";
    result.action = `Start the configured journey server/build at ${options.target} for this candidate; inspect ${logPath} and rerun.`;
    const url = new URL(options.target);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.protocol !== "http:") {
      throw new Error("Journey runner requires an HTTP loopback target.");
    }
    const probe = async () => {
      try {
        const response = await fetch(new URL("/api/health/live", url), { signal: AbortSignal.timeout(500) });
        return response.ok && (await response.json()).status === "live";
      } catch { return false; }
    };
    if (!await probe()) {
      if (!options.startCommand) throw new Error("Configured journey server is not ready.");
      checkInterrupted();
      server = launch(options.startCommand);
      server.stdout?.on("data", capture);
      server.stderr?.on("data", capture);
      let startupError: Error | undefined;
      server.on("error", error => { startupError = error; });
      const deadline = Date.now() + (options.startupTimeoutMs ?? 240_000);
      while (!await probe()) {
        if (interrupted || startupError || server.exitCode !== null || Date.now() >= deadline) {
          throw startupError ?? new Error("Journey build/server failed or startup timeout expired.");
        }
        await delay(50);
      }
    }
    checkInterrupted();
    const response = await fetch(new URL("/api/health", url), {
      headers: { authorization: `Bearer ${options.cronSecret}` }, signal: AbortSignal.timeout(15_000),
    });
    const health = await response.json();
    checkInterrupted();
    // Dependency readiness can be degraded; identity must still match exactly.
    if (health?.build?.commit !== options.identity.commit || health?.build?.tree !== options.identity.tree.slice(0, 12)) {
      throw new Error("Wrong or unidentified candidate artifact at the configured journey target.");
    }
    if (options.artifactRoot) {
      const manifest = JSON.parse(readFileSync(join(options.artifactRoot, ".next/qa-journey-candidate.json"), "utf8")) as {
        commit: string; tree: string; buildId: string; assets: Record<string, string>;
      };
      if (manifest.commit !== options.identity.commit || manifest.tree !== options.identity.tree ||
        manifest.buildId !== readFileSync(join(options.artifactRoot, ".next/BUILD_ID"), "utf8").trim()) {
        throw new Error("Production build stamp does not match the candidate; rebuild the artifact.");
      }
      const html = await (await fetch(new URL("/immersive", url), { signal: AbortSignal.timeout(15_000) })).text();
      const assets = [...new Set([...html.matchAll(/src="(\/_next\/static\/[A-Za-z0-9_./%-]+\.js)"/g)].map(match => match[1]))];
      if (!assets.length) throw new Error("Candidate artifact has no verifiable served client bundle.");
      for (const asset of assets) {
        checkInterrupted();
        if (asset.includes("..") || !manifest.assets[asset]) throw new Error("Unrecorded candidate client asset.");
        const served = await fetch(new URL(asset, url), { signal: AbortSignal.timeout(15_000) });
        if (!served.ok || createHash("sha256").update(new Uint8Array(await served.arrayBuffer())).digest("hex") !== manifest.assets[asset]) {
          throw new Error("Wrong candidate artifact: served client bundle differs from the recorded production build.");
        }
      }
    }
    checkInterrupted();
    result.status = "invalid_report";
    result.action = `Inspect ${reportPath} and ${logPath}; correct the JSON reporter/selection and rerun real non-skipped tests.`;
    testProcess = launch(options.command);
    testProcess.stdout?.on("data", capture);
    testProcess.stderr?.on("data", capture);
    result.exitCode = await new Promise<number | null>((resolve, reject) => {
      testProcess!.once("error", reject);
      testProcess!.once("close", code => resolve(code));
    });
    checkInterrupted();
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as PlaywrightJsonReport;
    assertTestsExecuted(report, "QA browser journeys");
    const stats = report.stats!;
    for (const count of [stats.expected, stats.unexpected, stats.flaky, stats.skipped]) {
      if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) throw new Error("Invalid Playwright report count.");
    }
    result.passed = stats.expected ?? 0;
    result.failed = stats.unexpected ?? 0;
    result.flaky = stats.flaky ?? 0;
    result.skipped = stats.skipped ?? 0;
    result.failures = result.exitCode === 0 && result.failed === 0 && result.skipped === 0 ? 0 : Math.max(1, result.failed);
    result.status = result.failures ? "tests_failed" : "passed";
    result.action = result.failures
      ? `Inspect assertion failures or skipped required journeys in ${reportPath}; repair fixtures/assertions and rerun.`
      : result.flaky ? `${result.flaky} flaky retry passes; investigate retries before treating this as clean evidence.` : "All selected journeys executed successfully.";
  } catch (error) {
    capture(`\n${error instanceof Error ? error.message : String(error)}\n`);
  } finally {
    await stop(testProcess);
    await stop(server);
    process.removeListener("SIGTERM", interrupt);
    process.removeListener("SIGINT", interrupt);
    if (!discardLine) appendLine(pendingLine);
    writeFileSync(logPath, diagnostics);
    writeFileSync(join(options.directory, "result.json"), JSON.stringify(result, null, 2));
  }
  return result;
}
