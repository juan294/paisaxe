import { execFile } from "node:child_process";
import http from "node:http";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

let server: http.Server;
let baseUrl: string;
let healthBody: unknown;
let healthStatus = 200;

async function runReadinessCheck(args: string[] = []) {
  return execFileAsync("node", ["scripts/check-health-readiness.mjs", baseUrl, ...args], {
    cwd: process.cwd(),
  });
}

describe("check-health-readiness", () => {
  beforeEach(async () => {
    healthBody = { status: "healthy", timestamp: "2026-06-13T00:00:00.000Z" };
    healthStatus = 200;

    server = http.createServer((request, response) => {
      if (request.url === "/api/health") {
        response.writeHead(healthStatus, { "Content-Type": "application/json" });
        response.end(JSON.stringify(healthBody));
        return;
      }

      if (request.url === "/api/health/live") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ status: "live" }));
        return;
      }

      response.writeHead(404);
      response.end();
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("Expected test server to listen on a TCP port");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("passes when /api/health returns HTTP 200 with status healthy", async () => {
    await expect(runReadinessCheck()).resolves.toMatchObject({
      stdout: expect.stringContaining("Health readiness passed"),
    });
  });

  it("fails when /api/health returns degraded even though liveness is up", async () => {
    healthBody = { status: "degraded", timestamp: "2026-06-13T00:00:00.000Z" };

    await expect(runReadinessCheck()).rejects.toMatchObject({
      stderr: expect.stringContaining('status="degraded"'),
    });
  });

  it("fails when /api/health returns a non-200 HTTP status", async () => {
    healthStatus = 503;

    await expect(runReadinessCheck()).rejects.toMatchObject({
      stderr: expect.stringContaining("HTTP 503"),
    });
  });

  it("optionally requires sentry.status to be configured", async () => {
    healthBody = {
      status: "healthy",
      timestamp: "2026-06-13T00:00:00.000Z",
      sentry: { status: "unconfigured" },
    };

    await expect(runReadinessCheck(["--require-sentry"])).rejects.toMatchObject({
      stderr: expect.stringContaining('sentry.status="unconfigured"'),
    });
  });
});
