// @vitest-environment node
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import http from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertStripeLocalInputs } from "./run-stripe-e2e";
import { managedCallerFixture, assertManagedPreflight, stripeWorkloadFixture } from "./test-fixtures/managed-caller.mjs";

it("Stripe rejects a failed server root even when its child settles only after intentional stop", async () => {
  const fixture = await stripeWorkloadFixture(process.cwd(), { failedServerRootWithChild: true });
  const readyFile = join(fixture.env.HOME!, "server-child-ready");
  try {
    const child = spawnSync(process.execPath, ["--import", "tsx", resolve("scripts/run-stripe-e2e.ts")], {
      cwd: process.cwd(), env: fixture.env, encoding: "utf8", timeout: 15000,
    });
    expect(child.error).toBeUndefined();
    const ready = JSON.parse(readFileSync(readyFile, "utf8"));
    const stopped = JSON.parse(readFileSync(join(fixture.env.HOME!, "server-child-stopped"), "utf8"));
    expect(stopped).toEqual({ pid: ready.pid, signal: "SIGTERM" });
    expect(fixture.read().some(call => call.tool === "npx")).toBe(true);
    expect(child.status, child.stdout + child.stderr).toBe(1);
    expect(child.stderr).toMatch(/server.*(?:exit|code).*7/i);
  } finally {
    if (existsSync(readyFile)) {
      const { pid } = JSON.parse(readFileSync(readyFile, "utf8"));
      let absent = false;
      try { process.kill(pid, 0); } catch (error) { absent = (error as NodeJS.ErrnoException).code === "ESRCH"; }
      if (!absent) throw new Error(`Fixture server child absence unproven; retained ${fixture.env.HOME}`);
    }
    fixture.close();
  }
}, 20000);

for (const earlyServerExit of [0, 7]) {
  it(`Stripe rejects premature owned server exit ${earlyServerExit} despite another ready listener`, async () => {
    const fixture = await stripeWorkloadFixture(process.cwd(), { earlyServerExit });
    const foreignListener = http.createServer((_request, response) => response.end("separate fixture listener"));
    try {
      await new Promise<void>(resolve => foreignListener.listen(Number(fixture.env.PLAYWRIGHT_PORT), resolve));
      const result = await new Promise<{ status: number | null; stdout: string; stderr: string }>((resolveResult, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", resolve("scripts/run-stripe-e2e.ts")], {
          cwd: process.cwd(), env: fixture.env, stdio: ["ignore", "pipe", "pipe"], timeout: 15000,
        });
        let stdout = "", stderr = "";
        child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
        child.once("error", reject); child.once("close", status => resolveResult({ status, stdout, stderr }));
      });
      expect(result.status, result.stdout + result.stderr).toBe(1);
      expect(result.stderr).toMatch(/server.*(?:premature|unexpected|before|code)/i);
      expect(result.stderr).toContain(String(earlyServerExit));
      expect(foreignListener.listening).toBe(true);
    } finally {
      if (foreignListener.listening) await new Promise<void>(resolve => foreignListener.close(() => resolve()));
      fixture.close();
    }
  }, 20000);
}

for (const exit of [0, 7]) {
  it(`Stripe overlapping server and browser keep independent ownership after browser exit ${exit}`, async () => {
    const fixture = await stripeWorkloadFixture(process.cwd(), { exit });
    try {
      const child = spawnSync(process.execPath, ["--import", "tsx", resolve("scripts/run-stripe-e2e.ts")], {
        cwd: process.cwd(), env: fixture.env, encoding: "utf8", timeout: 15000,
      });
      expect(child.error).toBeUndefined(); expect(child.status, child.stderr).toBe(exit === 0 ? 0 : 1);
      if (exit !== 0) expect(child.stderr).toMatch(/code 7/);
      const calls = fixture.read();
      const build = calls.find(call => call.tool === "npm" && call.args[1] === "build");
      const browser = calls.find(call => call.tool === "npx");
      expect(build).toBeDefined(); expect(browser).toBeDefined();
      expect(Object.values(build.commands)).toHaveLength(1);
      const commands = Object.values(browser.commands) as { id: string; leaseId: string; settlement: string }[];
      expect(commands).toHaveLength(2);
      expect(new Set(commands.map(command => command.id)).size).toBe(2);
      expect(commands.map(command => command.settlement).sort()).toEqual(["explicit-consumer", "process-group"]);
      expect(new Set(commands.map(command => command.leaseId)).size).toBe(1);
      const after = fixture.receipt(); expect(after.leases).toHaveLength(0);
      const retained = Object.values(after.commandTracking.commands) as { settlement: string; state: string }[];
      expect(retained).toHaveLength(1); expect(retained[0]?.settlement).toBe("explicit-consumer");
      expect(retained[0]?.state).toBe("unsettled");
      expect(child.stdout + child.stderr).toMatch(/retained|unproven/);
    } finally { fixture.close(); }
  }, 20000);
}

for (const boundary of ["schema", "status"]) {
  it(`Stripe leases and records durable ${boundary} preflight before external execution`, () => {
    const fixture = managedCallerFixture(process.cwd(), boundary);
    try {
      const child = spawnSync(process.execPath, ["--import", "tsx", resolve("scripts/run-stripe-e2e.ts")], {
        cwd: process.cwd(), env: fixture.env, encoding: "utf8", timeout: 15000,
      });
      expect(child.error).toBeUndefined(); expect(child.status, child.stderr).toBe(1);
      assertManagedPreflight(fixture, "stripe-e2e", boundary);
    } finally { fixture.close(); }
  });
}

// Exercise the actual entrypoint. The only available npm is a harmless sentinel;
// the old runner reaches it before checking whether its datastore is production.
function rejectedRun(url: string, fixtureMismatch = false) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "paisaxe-contracts-stripe-test-")));
  try {
    const marker = join(dir, "build-started");
    const npm = join(dir, "npm");
    writeFileSync(npm, `#!/bin/sh\n: > '${marker}'\nexit 47\n`); chmodSync(npm, 0o700);
    const manifest = {version:1,taskDir:dir,projectId:"paisaxe-contracts-abcdef123456",nonce:"12345678-abcd-1234-abcd-123456789012",apiUrl:"http://127.0.0.1:31351",dbPort:31352,migrationDigest:"a".repeat(64),schemaDigest:"b".repeat(64)};
    writeFileSync(join(dir,"contracts-stack.json"),JSON.stringify(manifest));
    writeFileSync(join(dir,"stripe-qa.json"),JSON.stringify({project:manifest.projectId,nonce:manifest.nonce,email:"qa-test-owned@paisaxe.dev",password:"synthetic-password"}));
    const result = spawnSync(process.execPath,["--import","tsx",resolve("scripts/run-stripe-e2e.ts")],{
      cwd:process.cwd(),encoding:"utf8",timeout:15_000,
      env:{NODE_ENV:"test",PATH:dir,HOME:dir,CONTRACT_STACK_DIR:dir,NEXT_PUBLIC_SUPABASE_URL:url,NEXT_PUBLIC_SUPABASE_ANON_KEY:"synthetic-anon",SUPABASE_SERVICE_KEY:"synthetic-service",QA_TEST_USER_EMAIL:fixtureMismatch?"qa-test-other@paisaxe.dev":"qa-test-owned@paisaxe.dev",QA_TEST_USER_PASSWORD:"synthetic-password",STRIPE_TEST_SECRET_KEY:"sk_test_synthetic",STRIPE_TEST_DAY_PASS_PRICE_ID:"price_synthetic",NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY:"pk_test_synthetic",STRIPE_TEST_WEBHOOK_SECRET:"whsec_synthetic"}
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(existsSync(marker)).toBe(false);
    expect(result.stderr).toMatch(/mutating probe|owned local|Shared\/default/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
}

describe("Stripe integration datastore safety",()=>{
  it("rejects a hosted Supabase before build or provider calls",()=>rejectedRun("https://production.supabase.co"));
  it("rejects a shared default local endpoint before build",()=>rejectedRun("http://127.0.0.1:54321"));
  it("rejects a different loopback endpoint before build",()=>rejectedRun("http://127.0.0.1:31359"));
  it("rejects QA credentials outside the manifest fixture before build",()=>rejectedRun("http://127.0.0.1:31351",true));
  it("keeps hosted datastore secrets out of the Stripe workflow",()=>{
    const workflow=readFileSync(resolve(".github/workflows/e2e-stripe-integration.yml"),"utf8");
    expect(workflow).not.toMatch(/secrets\.(?:NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE|QA_TEST_USER|STRIPE_TEST_WEBHOOK_SECRET)/);
    expect(workflow).toContain("prepareStack");
    expect(workflow).toContain("stopOwnedStack");
  });
});


describe("Stripe test-mode and collection safety", () => {
  for (const secret of ["sk_test_synthetic", "rk_test_synthetic"]) {
    it(`accepts owned local inputs with ${secret.slice(0, 8)} credentials`, () => {
      const dir = realpathSync(mkdtempSync(join(tmpdir(), "paisaxe-contracts-stripe-positive-")));
      try {
        const manifest = { version: 1, taskDir: dir, projectId: "paisaxe-contracts-abcdef123456", nonce: "12345678-abcd-1234-abcd-123456789012", apiUrl: "http://127.0.0.1:31351", dbPort: 31352, migrationDigest: "a".repeat(64), schemaDigest: "b".repeat(64) };
        const fixture = { project: manifest.projectId, nonce: manifest.nonce, email: "qa-test-owned@paisaxe.dev", password: "synthetic-password" };
        writeFileSync(join(dir, "contracts-stack.json"), JSON.stringify(manifest));
        writeFileSync(join(dir, "stripe-qa.json"), JSON.stringify(fixture));
        expect(assertStripeLocalInputs({ NODE_ENV: "test", CONTRACT_STACK_DIR: dir, NEXT_PUBLIC_SUPABASE_URL: manifest.apiUrl, QA_TEST_USER_EMAIL: fixture.email, QA_TEST_USER_PASSWORD: fixture.password, STRIPE_TEST_SECRET_KEY: secret, NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY: "pk_test_synthetic" })).toEqual(manifest);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
  }

  for (const [secret, publishable] of [
    ["sk_live_synthetic", "pk_test_synthetic"],
    ["rk_live_synthetic", "pk_test_synthetic"],
    ["sk_test_synthetic", "pk_live_synthetic"],
    ["sk_test_", "pk_test_synthetic"],
    [" sk_test_synthetic", "pk_test_synthetic"],
  ]) {
    it(`rejects unsafe credential prefixes ${secret?.slice(0, 8)} / ${publishable?.slice(0, 8)} before datastore inspection`, () => {
      expect(() => assertStripeLocalInputs({ NODE_ENV: "test", STRIPE_TEST_SECRET_KEY: secret, NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY: publishable }))
        .toThrow(/Stripe integration requires test-mode credentials/);
    });
  }

  for (const selection of [[], ["--project=*"], ["stripe-real-checkout.spec.ts"]]) {
    it(`rejects hosted datastore during actual collection: ${selection.join(" ") || "all projects"}`, () => {
      const dir = realpathSync(mkdtempSync(join(tmpdir(), "paisaxe-stripe-collection-")));
      try {
        // A minimal real config isolates this spec from unrelated projects.
        // --list loads the spec but never runs auth fixtures or provider calls.
        const config = join(dir, "playwright.config.cjs");
        writeFileSync(config, `module.exports = ${JSON.stringify({ testDir: resolve("e2e"), testMatch: "stripe-real-checkout.spec.ts", projects: [{ name: "stripe-integration" }] })};`);
        const result = spawnSync(process.execPath, [resolve("node_modules/@playwright/test/cli.js"), "test", "--config", config, "--list", ...selection], {
          cwd: process.cwd(), encoding: "utf8", timeout: 20_000,
          env: { NODE_ENV: "test", PATH: dir, HOME: dir, NEXT_PUBLIC_SUPABASE_URL: "https://production.supabase.co", STRIPE_TEST_SECRET_KEY: "sk_test_synthetic", NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY: "pk_test_synthetic" },
        });
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stderr + result.stdout).toMatch(/Refusing to run a mutating probe/);
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
  }
});


for (const project of ["desktop", "mobile", "qa-journey", "release-required", "release-required-local"]) {
  it(`collects ${project} without Stripe provider credentials`, () => {
    const result = spawnSync(process.execPath, [resolve("node_modules/@playwright/test/cli.js"), "test", `--project=${project}`, "--list"], {
      cwd: process.cwd(), encoding: "utf8", timeout: 20_000,
      env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: tmpdir(), ...(project === "release-required" ? { RELEASE_TARGET_URL: "https://example.invalid" } : {}) },
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(result.stdout).not.toContain("grants voice access end-to-end in Stripe test mode");
  });
}
