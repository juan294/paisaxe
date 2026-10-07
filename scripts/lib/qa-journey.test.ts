// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { collectJourneyRun, type JourneyOptions } from "./qa-journey";

const roots: string[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

async function fixture(): Promise<JourneyOptions> {
  const directory = mkdtempSync(join(tmpdir(), "qa-journey-"));
  roots.push(directory);
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(request.url === "/api/health/live"
      ? { status: "live" } : { build: { commit: "candidate", tree: "0123456789ab" } }));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  return {
    directory, target: `http://127.0.0.1:${address.port}`, identity: { commit: "candidate", tree: "0123456789abcdef" },
    cronSecret: "fixture-secret", enabled: true,
    command: [process.execPath, "-e", 'require("node:fs").writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME, JSON.stringify({stats:{expected:2,unexpected:0,flaky:0,skipped:0}}))'],
  };
}

describe("collectJourneyRun", () => {
  it("records a real subprocess pass with target and candidate", async () => {
    const options = await fixture();
    const result = await collectJourneyRun(options);
    expect(result).toMatchObject({ status: "passed", passed: 2, failed: 0, flaky: 0, failures: 0, identity: options.identity, target: options.target });
  });

  it.each([
    ["missing", "", "invalid_report"],
    ["malformed", "not-json", "invalid_report"],
    ["all-skipped", JSON.stringify({ stats: { skipped: 4 } }), "invalid_report"],
    ["negative-count", JSON.stringify({ stats: { expected: -1 } }), "invalid_report"],
    ["wrong-type", JSON.stringify({ stats: { expected: "2" } }), "invalid_report"],
    ["zero-nonzero", JSON.stringify({ stats: {} }), "invalid_report"],
    ["assertion", JSON.stringify({ stats: { expected: 1, unexpected: 1 } }), "tests_failed"],
  ])("fails closed for %s and names a recovery action", async (name, report, status) => {
    const options = await fixture();
    options.command = [process.execPath, "-e", `const fs=require('node:fs'); ${report ? `fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME,${JSON.stringify(report)});` : ""} process.exit(${name === "zero-nonzero" || name === "assertion" ? 1 : 0})`];
    const result = await collectJourneyRun(options);
    expect(result.status).toBe(status);
    expect(result.failures).toBeGreaterThan(0);
    expect(result.action).toMatch(/report|assertion/i);
    expect((await collectJourneyRun(await fixture())).status).toBe("passed");
  });

  it("discloses retries instead of calling them clean passes", async () => {
    const options = await fixture();
    options.command = [process.execPath, "-e", 'require("node:fs").writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME,JSON.stringify({stats:{expected:1,flaky:1}}))'];
    expect(await collectJourneyRun(options)).toMatchObject({ status: "passed", passed: 1, flaky: 1, action: expect.stringMatching(/retry|flaky/i) });
  });

  it("marks disabled as unverified without spawning", async () => {
    const options = await fixture();
    options.enabled = false;
    options.command = ["does-not-exist"];
    expect(await collectJourneyRun(options)).toMatchObject({ status: "disabled", failures: 1, action: expect.stringMatching(/enable/i) });
  });

  it("rejects a wrong artifact before any command runs", async () => {
    const options = await fixture();
    options.identity.commit = "another-candidate";
    options.command = ["does-not-exist"];
    expect(await collectJourneyRun(options)).toMatchObject({ status: "startup_failed", action: expect.stringMatching(/candidate|artifact/i) });
  });

  it("retains bounded redacted build/startup diagnostics through cleanup", async () => {
    const options = await fixture();
    options.target = "http://127.0.0.1:1";
    options.startupTimeoutMs = 500;
    options.startCommand = [process.execPath, "-e", 'console.error("Authorization: Bearer super-secret"); console.error("ANTHROPIC_API_KEY=top-secret"); console.error(\'API_KEY="quoted-secret"\'); console.error(JSON.stringify({PASSWORD:"json-secret"})); process.exit(1)'];
    const result = await collectJourneyRun(options);
    expect(result.status).toBe("startup_failed");
    expect(result.action).toContain(result.logPath);
    const diagnostic = readFileSync(result.logPath, "utf8");
    expect(diagnostic).not.toMatch(/super-secret|top-secret|quoted-secret|json-secret/);
    expect(diagnostic).toContain("[REDACTED]");
    expect(diagnostic.length).toBeLessThanOrEqual(16_384);
  });

  it("startup timeout has a retained log and never executes tests", async () => {
    const options = await fixture();
    options.target = "http://127.0.0.1:1";
    options.startupTimeoutMs = 100;
    options.startCommand = [process.execPath, "-e", 'console.log("booting");setInterval(()=>{},1000)'];
    options.command = ["does-not-exist"];
    const result = await collectJourneyRun(options);
    expect(result).toMatchObject({ status: "startup_failed", failures: 1, action: expect.stringMatching(/start|build/i) });
    expect(readFileSync(result.logPath, "utf8")).toContain("booting");
  });

  it("does not reuse a stale JSON report on a failed command", async () => {
    const options = await fixture();
    writeFileSync(join(options.directory, "playwright.json"), JSON.stringify({ stats: { expected: 8 } }));
    options.command = [process.execPath, "-e", "process.exit(1)"];
    expect((await collectJourneyRun(options)).status).toBe("invalid_report");
  });

  it("cancels before launching tests when signalled during the identity probe", async () => {
    const options = await fixture();
    const server = servers.at(-1)!;
    server.removeAllListeners("request");
    server.on("request", (request, response) => {
      if (request.url === "/api/health/live") response.end(JSON.stringify({ status: "live" }));
      else {
        process.emit("SIGTERM", "SIGTERM");
        setTimeout(() => response.end(JSON.stringify({ build: { commit: "candidate", tree: "0123456789ab" } })), 10);
      }
    });
    const result = await collectJourneyRun(options);
    expect(result).toMatchObject({ status: "startup_failed", failures: 1 });
    expect(() => readFileSync(result.reportPath)).toThrow();
  });

  it("bounds noisy startup output and redacts secrets split across chunks", async () => {
    const options = await fixture();
    options.target = "http://127.0.0.1:1";
    options.startupTimeoutMs = 1000;
    options.startCommand = [process.execPath, "-e", 'process.stdout.write("x".repeat(100000)); console.log(); process.stdout.write("API_KEY=split-");setTimeout(()=>{console.log("secret");process.exit(1)},10)'];
    const result = await collectJourneyRun(options);
    const log = readFileSync(result.logPath, "utf8");
    expect(log.length).toBeLessThanOrEqual(16_384);
    expect(log).not.toContain("split-secret");
    expect(log).toContain("[REDACTED]");
  });

  it.each([false, true])("verifies every served client script against the completed build stamp (wrong route=%s)", async wrongRoute => {
    const options = await fixture();
    options.artifactRoot = options.directory;
    mkdirSync(join(options.directory, ".next"));
    writeFileSync(join(options.directory, ".next/BUILD_ID"), "fixture-build");
    const assets = { "/_next/static/runtime.js": "runtime", "/_next/static/route.js": "candidate-route" };
    writeFileSync(join(options.directory, ".next/qa-journey-candidate.json"), JSON.stringify({
      ...options.identity, buildId: "fixture-build", assets: Object.fromEntries(Object.entries(assets).map(([path, content]) => [path, createHash("sha256").update(content).digest("hex")])),
    }));
    const server = servers.at(-1)!;
    server.removeAllListeners("request");
    server.on("request", (request, response) => {
      const path = request.url!;
      if (path === "/immersive") response.end(Object.keys(assets).map(asset => `<script src="${asset}"></script>`).join(""));
      else if (path in assets) response.end(wrongRoute && path.endsWith("route.js") ? "stale-route" : assets[path as keyof typeof assets]);
      else response.end(JSON.stringify(path === "/api/health/live" ? { status: "live" } : { build: { commit: "candidate", tree: "0123456789ab" } }));
    });
    expect((await collectJourneyRun(options)).status).toBe(wrongRoute ? "startup_failed" : "passed");
  });

  it("discards an entire oversized line, including a credential split at the overflow boundary", async () => {
    const options = await fixture();
    options.target = "http://127.0.0.1:1";
    options.startupTimeoutMs = 1000;
    options.startCommand = [process.execPath, "-e", 'process.stdout.write("x".repeat(17000)+"API_KEY=first-half-"); setTimeout(()=>{console.log("secret-tail");process.exit(1)},30)'];
    const result = await collectJourneyRun(options);
    expect(readFileSync(result.logPath, "utf8")).not.toContain("secret-tail");
  });

  it("redacts JSON-escaped quotes in exported and child-only secrets", async () => {
    const options = await fixture();
    options.target = "http://127.0.0.1:1";
    options.startupTimeoutMs = 1000;
    options.env = { ...process.env, QA_PASSWORD: 'exported"secret-tail' };
    options.startCommand = [process.execPath, "-e", 'console.log(JSON.stringify({QA_PASSWORD:process.env.QA_PASSWORD,API_KEY:\'child"private-tail\'}));process.exit(1)'];
    const result = await collectJourneyRun(options);
    expect(readFileSync(result.logPath, "utf8")).not.toMatch(/secret-tail|private-tail/);
  });
});
