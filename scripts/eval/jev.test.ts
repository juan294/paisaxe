// @vitest-environment node
import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
function cli(args: string[]) { return spawnSync(process.execPath, ["--import", "tsx", "--conditions=react-server", "scripts/eval/jev.ts", ...args], { encoding: "utf8", env: { ...process.env, TYPESAFE_API_KEY: "", JEV_ENABLED_TASKS: "", CI: "", VERCEL: "", VERCEL_ENV: "" } }); }
it("INSPECT-01 actual CLI list, fixture and inspect work without credentials", () => {
  const list = cli(["--list"]); expect(list.status).toBe(0); expect(list.stdout).toContain("provider-contract");
  const fixture = cli(["fixture", "--suite", "provider-contract"]); expect(fixture.status).toBe(0);
  const runPath = fixture.stdout.trim().split("\n").find(line => line.startsWith("record: "))?.slice(8);
  expect(runPath).toBeTruthy();
  const original = JSON.parse(readFileSync(runPath!, "utf8")); expect(original.evidenceKind).toBe("fixture");
  const inspected = cli(["inspect", "--input", runPath!]); expect(inspected.status).toBe(0); expect(inspected.stdout).toContain("imported");
}, 15000);
it("live missing caps and unknown commands exit nonzero without any provider request", () => {
  expect(cli(["live", "--suite", "provider-contract"]).status).not.toBe(0);
  expect(cli(["unknown"]).status).not.toBe(0);
});
