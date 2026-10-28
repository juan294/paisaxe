// @vitest-environment node
import { expect, it } from "vitest";
import { renderJevReport, summarizeJevRun, quoteJevShellArg } from "./jev-report";
import { runEvaluation, type EvaluationSuite } from "./jev-evaluation";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { providerContractSuite } from "../eval/jev";
import { join } from "node:path";
it("INSPECT-04 escapes hostile text, uses inert expandable details and omits raw state from summary", async () => {
  const secret = '<script src="https://evil.invalid/a.js"></script><img onerror=alert(1)> [link](https://evil.invalid) fixture-credential';
  const suite: EvaluationSuite = { id: "safe", task: "provider_contract", questionVersion: "v1", policyVersion: "v1", questionIdentity: {}, qualification: "plumbing_only", cases: [{ id: "case", split: "contract", input: { text: secret }, expected: secret, baseline: null, requests: [], fixtureResponses: [] }], evaluate: async () => ({ value: secret, unavailable: false }) };
  const run = await runEvaluation(suite, { mode: "fixture", outputRoot: mkdtempSync(join(tmpdir(), "jev-report-")) });
  const html = renderJevReport(run);
  expect(html).toContain("&lt;script"); expect(html).not.toContain("<script"); expect(html).not.toContain("<img"); expect(html).not.toContain('src="https://');
  expect(html).toContain("<details>"); expect(html).toContain("provided");
  expect(JSON.stringify(summarizeJevRun(run))).not.toContain("fixture-credential");
});

it("P2-01 recovery shell quoting makes metacharacters literal", () => {
  const value = "dir'$(printf attack)`printf other` space";
  const result = spawnSync("/bin/sh", ["-c", "printf '%s' " + quoteJevShellArg(value)], { encoding: "utf8" });
  expect(result.status).toBe(0); expect(result.stdout).toBe(value);
});
it("P2-05 generated fixture resume is executable and preserves evidence mode", async () => {
  const suite = providerContractSuite(); suite.cases[0]!.fixtureResponses = [{ status: 529, body: { error: "synthetic failure" } }];
  const run = await runEvaluation(suite, { mode: "fixture", outputRoot: mkdtempSync(join(tmpdir(), "jev-command-")) });
  const html = renderJevReport(run);
  const encoded = html.match(/<pre>(npm run eval:jev -- fixture[^<]*--resume[^<]*)<\/pre>/)?.[1];
  expect(encoded).toBeTruthy();
  const command = encoded!.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  expect(command).not.toContain(" live ");
  const result = spawnSync("/bin/sh", ["-c", command], { encoding: "utf8", env: { ...process.env, TYPESAFE_API_KEY: "", JEV_ENABLED_TASKS: "" } });
  expect(result.status).toBe(0); expect(result.stdout).toContain("evidence: fixture");
}, 15000);
